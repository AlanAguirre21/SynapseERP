"""Nómina con pago en caja — `008 · RRHH`, "Actualización: nómina con pago en
caja".

Única lógica que cambia el estado de pago de una `SolicitudNomina`. El dinero
siempre pasa por `registrar_movimiento_caja` (único punto de entrada a Caja),
así que el bloqueo de saldo negativo y el asiento contable automático aplican
igual que en ventas y compras. Todas las funciones que escriben abren su
propia `transaction.atomic()`: si un paso falla, nada queda a medias.
"""

import calendar
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from apps.caja.models import MovimientoCaja
from apps.caja.services import (
    SaldoInsuficienteError,
    calcular_saldo_actual,
    registrar_movimiento_caja,
)

from ..models import (
    ESTADO_NOMINA_PAGADO,
    ESTADO_NOMINA_PENDIENTE,
    ESTADO_NOMINA_REVERTIDO,
    ESTADOS_NOMINA_OCUPAN_PERIODO,
    Empleado,
    EmpleadoPosicion,
    SolicitudNomina,
)

CENTAVO = Decimal('0.01')


class ErrorNomina(Exception):
    """Regla de nómina incumplida; la vista la devuelve como `{"detail": ...}`."""


def periodo_quincena(anio, mes, quincena):
    """Quincena 1: del 1 al 15; quincena 2: del 16 al último día del mes."""
    if quincena == 1:
        return date(anio, mes, 1), date(anio, mes, 15)
    return date(anio, mes, 16), date(anio, mes, calendar.monthrange(anio, mes)[1])


def texto_periodo(inicio, fin):
    return f'{inicio:%d/%m/%Y} – {fin:%d/%m/%Y}'


def solicitudes_que_ocupan(empleado_id, inicio, fin, excluir_id=None):
    """Solicitudes del empleado que se traslapan con el periodo y lo ocupan
    (pendiente, pagada o aprobada histórica). Rechazada y revertida no."""
    consulta = SolicitudNomina.objects.filter(
        empleado_id=empleado_id, estado__in=ESTADOS_NOMINA_OCUPAN_PERIODO,
        periodo_inicio__lte=fin, periodo_fin__gte=inicio,
    )
    return consulta.exclude(pk=excluir_id) if excluir_id else consulta


def generar_nomina(*, anio, mes, quincena):
    """Crea una solicitud pendiente por cada empleado activo con posición
    vigente, por la mitad de su salario asignado mensual. Devuelve
    `(creadas, omitidas)`; `omitidas` es una lista de `(empleado, motivo)`.
    """
    inicio, fin = periodo_quincena(anio, mes, quincena)

    # Asignación vigente más reciente por empleado (mismo criterio que el
    # directorio de RRHH ante una asignación vigente duplicada).
    vigentes = {}
    for asignacion in (
        EmpleadoPosicion.objects.filter(fecha_termino__isnull=True, empleado__activo=True)
        .select_related('empleado')
        .order_by('empleado_id', '-fecha_inicio', '-id')
    ):
        vigentes.setdefault(asignacion.empleado_id, asignacion)

    creadas, omitidas = [], []
    with transaction.atomic():
        for empleado in Empleado.objects.filter(activo=True).order_by('nombre_completo'):
            asignacion = vigentes.get(empleado.id)
            if asignacion is None:
                omitidas.append((empleado, 'Sin posición vigente.'))
                continue
            if solicitudes_que_ocupan(empleado.id, inicio, fin).exists():
                omitidas.append((empleado, 'Ya tiene una solicitud de nómina para este periodo.'))
                continue
            monto = (asignacion.salario_asignado / 2).quantize(CENTAVO, rounding=ROUND_HALF_UP)
            creadas.append(SolicitudNomina.objects.create(
                empleado=empleado, periodo_inicio=inicio, periodo_fin=fin, monto=monto,
            ))
    return creadas, omitidas


def pagar_solicitudes(ids, usuario):
    """Aprueba y paga las solicitudes indicadas en una sola transacción: un
    retiro de Caja por cada una. Todo o nada: si alguna ya no está pendiente
    o el saldo no alcanza para el total, no se paga ninguna."""
    ids = sorted(set(ids))
    if not ids:
        raise ErrorNomina('Selecciona al menos una solicitud de nómina.')

    with transaction.atomic():
        solicitudes = list(
            SolicitudNomina.objects.select_for_update(of=('self',))
            .select_related('empleado')
            .filter(pk__in=ids)
            .order_by('id'),
        )
        if len(solicitudes) != len(ids):
            raise ErrorNomina('Alguna de las solicitudes de nómina no existe.')

        no_pendientes = [s for s in solicitudes if s.estado != ESTADO_NOMINA_PENDIENTE]
        if no_pendientes:
            folios = ', '.join(f'#{s.id}' for s in no_pendientes)
            raise ErrorNomina(f'Solo se pueden pagar solicitudes pendientes; ya no lo están: {folios}.')

        # Aviso claro para el pago en bloque; `registrar_movimiento_caja`
        # vuelve a bloquear el saldo negativo en cada retiro de todos modos.
        total = sum((s.monto for s in solicitudes), Decimal('0.00'))
        saldo = calcular_saldo_actual()
        if len(solicitudes) > 1 and total > saldo:
            raise SaldoInsuficienteError(
                f'El total de la nómina (${total:,.2f}) supera el saldo de caja (${saldo:,.2f}); no se pagó ninguna.',
            )

        ahora = timezone.now()
        for solicitud in solicitudes:
            solicitud.movimiento_pago = registrar_movimiento_caja(
                tipo_movimiento=MovimientoCaja.RETIRO, monto=solicitud.monto, motivo=MovimientoCaja.MOTIVO_NOMINA,
                referencia_id=solicitud.id, usuario=usuario,
                observacion=(
                    f'Nómina de {solicitud.empleado.nombre_completo} '
                    f'({texto_periodo(solicitud.periodo_inicio, solicitud.periodo_fin)})'
                ),
            )
            solicitud.estado = ESTADO_NOMINA_PAGADO
            solicitud.fecha_resolucion = ahora
            solicitud.resuelto_por = usuario
            solicitud.save(update_fields=['estado', 'fecha_resolucion', 'resuelto_por', 'movimiento_pago'])
    return solicitudes


def revertir_pago(solicitud_id, motivo, usuario):
    """Registra el ingreso inverso del pago y deja la solicitud `revertido`.
    Caja es insert-only: el retiro original no se toca."""
    motivo = (motivo or '').strip()
    if not motivo:
        raise ErrorNomina('Indica el motivo del reverso.')

    with transaction.atomic():
        solicitud = (
            SolicitudNomina.objects.select_for_update(of=('self',)).select_related('empleado').get(pk=solicitud_id)
        )
        if solicitud.estado != ESTADO_NOMINA_PAGADO:
            raise ErrorNomina('Solo se puede revertir el pago de una solicitud pagada.')

        solicitud.movimiento_reverso = registrar_movimiento_caja(
            tipo_movimiento=MovimientoCaja.INGRESO, monto=solicitud.monto, motivo=MovimientoCaja.MOTIVO_NOMINA,
            referencia_id=solicitud.id, usuario=usuario,
            observacion=(
                f'Reverso de nómina de {solicitud.empleado.nombre_completo} '
                f'({texto_periodo(solicitud.periodo_inicio, solicitud.periodo_fin)}): {motivo}'
            ),
        )
        solicitud.estado = ESTADO_NOMINA_REVERTIDO
        solicitud.motivo_reverso = motivo
        solicitud.fecha_reverso = timezone.now()
        solicitud.revertido_por = usuario
        solicitud.save(update_fields=[
            'estado', 'movimiento_reverso', 'motivo_reverso', 'fecha_reverso', 'revertido_por',
        ])
    return solicitud
