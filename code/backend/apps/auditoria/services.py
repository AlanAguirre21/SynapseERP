"""Conciliación de caja y auditoría de inventario — `022 · Auditoría
automatizada`.

Esta app solo LEE `MovimientoCaja`, `MovimientoInventario` y el stock. Su
único efecto sobre otra app es el ajuste aprobado de una discrepancia de
conteo, que se delega a `apps.inventario.services.ajustar_stock()`.
"""

import logging
from decimal import Decimal

from django.db import connection, transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.caja.models import MovimientoCaja
from apps.catalogo.models import MateriaPrima, Producto
from apps.inventario.models import MovimientoInventario
from apps.inventario.services import ajustar_stock

from .models import (
    ConteoFisico,
    CorteCaja,
    DetalleConteoFisico,
    DiscrepanciaAuditoria,
    EjecucionAuditoria,
)

logger = logging.getLogger(__name__)

CERO = Decimal('0.00')

# Claves de `pg_try_advisory_xact_lock`: una por tipo de auditoría, para que
# dos ejecuciones simultáneas del mismo tipo (cron + "Ejecutar ahora") no
# procesen los mismos registros. Las de distinto tipo no se bloquean entre sí.
CLAVES_BLOQUEO = {
    EjecucionAuditoria.TIPO_CAJA: 220_001,
    EjecucionAuditoria.TIPO_INVENTARIO: 220_002,
}


def _tomar_bloqueo(tipo):
    """Bloqueo de PostgreSQL que se libera solo al terminar la transacción.
    Devuelve `False` si otra ejecución del mismo tipo ya lo tiene."""

    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_try_advisory_xact_lock(%s)', [CLAVES_BLOQUEO[tipo]])
        return cursor.fetchone()[0]


# --- Caja ------------------------------------------------------------------


def saldo_caja_al(instante):
    """Saldo total de caja (incluye envíos) al instante dado: el
    `saldo_resultante` del último movimiento registrado hasta entonces —
    mismo criterio de `apps.caja.services.calcular_saldos()`, sin sumar la
    tabla completa."""

    ultimo = MovimientoCaja.objects.filter(fecha__lte=instante).order_by('-id').first()
    return ultimo.saldo_resultante if ultimo else CERO


def _con_signo(movimiento):
    return movimiento.monto if movimiento.tipo_movimiento == MovimientoCaja.INGRESO else -movimiento.monto


def verificar_cadena_caja(desde_id, hasta_id):
    """Revisa los eslabones de `MovimientoCaja` con `desde_id < id <= hasta_id`.

    Cada movimiento debe cumplir `saldo_resultante = anterior ± monto`, y
    `saldo_adicional_resultante` debe moverse igual solo en `motivo=envio`
    (en los demás se arrastra). Tras un eslabón roto se continúa desde el
    valor registrado, para que un solo error no se reporte en cascada.

    Devuelve `(revisados, hallazgos)`, donde cada hallazgo es un dict con
    los campos de una `DiscrepanciaAuditoria` de integridad.
    """

    anterior = MovimientoCaja.objects.filter(id__lte=desde_id).order_by('-id').first() if desde_id else None
    saldo = anterior.saldo_resultante if anterior else CERO
    saldo_adicional = anterior.saldo_adicional_resultante if anterior else CERO

    movimientos = MovimientoCaja.objects.filter(id__lte=hasta_id).order_by('id')
    if desde_id:
        movimientos = movimientos.filter(id__gt=desde_id)

    revisados = 0
    hallazgos = []
    for movimiento in movimientos.iterator():
        revisados += 1
        esperado = saldo + _con_signo(movimiento)
        if movimiento.saldo_resultante != esperado:
            hallazgos.append({
                'movimiento_caja_id': movimiento.id,
                'descripcion': f'Saldo del movimiento de caja #{movimiento.id}',
                'valor_esperado': esperado,
                'valor_registrado': movimiento.saldo_resultante,
            })

        if movimiento.motivo == MovimientoCaja.MOTIVO_ENVIO:
            esperado_adicional = saldo_adicional + _con_signo(movimiento)
        else:
            esperado_adicional = saldo_adicional
        if movimiento.saldo_adicional_resultante != esperado_adicional:
            hallazgos.append({
                'movimiento_caja_id': movimiento.id,
                'descripcion': f'Saldo adicional (envíos) del movimiento de caja #{movimiento.id}',
                'valor_esperado': esperado_adicional,
                'valor_registrado': movimiento.saldo_adicional_resultante,
            })

        saldo = movimiento.saldo_resultante
        saldo_adicional = movimiento.saldo_adicional_resultante

    return revisados, hallazgos


def _crear_discrepancia(ejecucion, categoria, valor_esperado, valor_registrado, **campos):
    return DiscrepanciaAuditoria.objects.create(
        ejecucion=ejecucion, categoria=categoria, valor_esperado=valor_esperado,
        valor_registrado=valor_registrado, diferencia=valor_registrado - valor_esperado, **campos,
    )


def auditar_caja(ejecucion):
    """Compara cada corte pendiente contra el saldo derivado a su instante, y
    verifica la cadena de saldos desde el último movimiento ya verificado.
    Devuelve `(revisados, discrepancias)`."""

    revisados = 0
    discrepancias = 0

    pendientes = (
        CorteCaja.objects.select_for_update(of=('self',))
        .filter(ejecucion__isnull=True, reemplazado_por__isnull=True)
        .order_by('fecha_hora_corte', 'id')
    )
    for corte in pendientes:
        revisados += 1
        esperado = saldo_caja_al(corte.fecha_hora_corte)
        if corte.monto_contado != esperado:
            discrepancias += 1
            _crear_discrepancia(
                ejecucion, DiscrepanciaAuditoria.CATEGORIA_CAJA_CORTE, esperado, corte.monto_contado,
                corte=corte,
                descripcion=f'Corte de caja del {timezone.localtime(corte.fecha_hora_corte):%d/%m/%Y %H:%M}',
            )
        corte.ejecucion = ejecucion
        corte.saldo_esperado = esperado
        corte.save(update_fields=['ejecucion', 'saldo_esperado'])

    previa = (
        EjecucionAuditoria.objects.filter(
            tipo=EjecucionAuditoria.TIPO_CAJA, estado=EjecucionAuditoria.ESTADO_EXITOSA,
            ultimo_movimiento_caja_verificado__isnull=False,
        )
        .exclude(pk=ejecucion.pk)
        .order_by('-ultimo_movimiento_caja_verificado')
        .first()
    )
    desde_id = previa.ultimo_movimiento_caja_verificado if previa else None
    ultimo = MovimientoCaja.objects.order_by('-id').first()
    if ultimo is not None:
        movimientos_revisados, hallazgos = verificar_cadena_caja(desde_id, ultimo.id)
        revisados += movimientos_revisados
        for hallazgo in hallazgos:
            discrepancias += 1
            _crear_discrepancia(
                ejecucion, DiscrepanciaAuditoria.CATEGORIA_CAJA_INTEGRIDAD,
                hallazgo.pop('valor_esperado'), hallazgo.pop('valor_registrado'), **hallazgo,
            )
        ejecucion.ultimo_movimiento_caja_verificado = ultimo.id
    else:
        ejecucion.ultimo_movimiento_caja_verificado = desde_id

    return revisados, discrepancias


# --- Inventario --------------------------------------------------------------


def stock_segun_libro(sucursal, tipo_item, item_id, hasta):
    """Entradas − salidas de `MovimientoInventario` de un ítem en una
    sucursal hasta el instante dado."""

    totales = MovimientoInventario.objects.filter(
        sucursal=sucursal, tipo_item=tipo_item, item_id=item_id, fecha__lte=hasta,
    ).aggregate(
        entradas=Sum('cantidad', filter=Q(tipo_movimiento=MovimientoInventario.ENTRADA)),
        salidas=Sum('cantidad', filter=Q(tipo_movimiento=MovimientoInventario.SALIDA)),
    )
    return (totales['entradas'] or CERO) - (totales['salidas'] or CERO)


def nombre_item(tipo_item, item_id):
    if tipo_item == MovimientoInventario.TIPO_PRODUCTO:
        item = Producto.objects.filter(pk=item_id).first()
        return item.nombre_producto if item else f'Producto #{item_id}'
    item = MateriaPrima.objects.filter(pk=item_id).first()
    return item.nombre_item if item else f'Materia prima #{item_id}'


def auditar_inventario(ejecucion):
    """Compara cada línea de los conteos pendientes contra su stock teórico
    congelado, y ese stock contra el libro de movimientos al instante del
    conteo. Devuelve `(revisados, discrepancias)`."""

    revisados = 0
    discrepancias = 0

    pendientes = (
        ConteoFisico.objects.select_for_update(of=('self',))
        .filter(ejecucion__isnull=True, descartado=False)
        .select_related('sucursal')
        .order_by('fecha_conteo', 'id')
    )
    for conteo in pendientes:
        for detalle in DetalleConteoFisico.objects.filter(conteo=conteo).order_by('id'):
            revisados += 1
            nombre = nombre_item(detalle.tipo_item, detalle.item_id)
            comunes = {
                'detalle_conteo': detalle, 'sucursal': conteo.sucursal,
                'tipo_item': detalle.tipo_item, 'item_id': detalle.item_id,
            }

            if detalle.cantidad_contada != detalle.stock_teorico:
                discrepancias += 1
                _crear_discrepancia(
                    ejecucion, DiscrepanciaAuditoria.CATEGORIA_INVENTARIO_CONTEO,
                    detalle.stock_teorico, detalle.cantidad_contada,
                    descripcion=f'Conteo #{conteo.id}: {nombre}', **comunes,
                )

            libro = stock_segun_libro(conteo.sucursal, detalle.tipo_item, detalle.item_id, conteo.fecha_conteo)
            if libro != detalle.stock_teorico:
                discrepancias += 1
                _crear_discrepancia(
                    ejecucion, DiscrepanciaAuditoria.CATEGORIA_INVENTARIO_INTEGRIDAD,
                    libro, detalle.stock_teorico,
                    descripcion=f'Stock registrado de {nombre} frente a su historial de movimientos',
                    **comunes,
                )

        conteo.ejecucion = ejecucion
        conteo.save(update_fields=['ejecucion'])

    return revisados, discrepancias


# --- Ejecución -----------------------------------------------------------------

def ejecutar_auditoria(tipo, origen, usuario=None):
    """Registra y corre una auditoría. La ejecución se guarda primero (en
    curso) y su trabajo va en una transacción aparte: si algo falla, se
    revierten todas sus discrepancias y la ejecución queda `fallida` con el
    mensaje de error — nunca hay reportes a medias.

    Si otra ejecución del mismo tipo está corriendo, esta termina como
    exitosa con 0 elementos revisados.
    """

    ejecucion = EjecucionAuditoria.objects.create(tipo=tipo, origen=origen, iniciada_por=usuario)

    try:
        with transaction.atomic():
            if _tomar_bloqueo(tipo):
                auditor = auditar_caja if tipo == EjecucionAuditoria.TIPO_CAJA else auditar_inventario
                revisados, discrepancias = auditor(ejecucion)
            else:
                revisados, discrepancias = 0, 0
            ejecucion.elementos_revisados = revisados
            ejecucion.discrepancias_encontradas = discrepancias
            ejecucion.estado = EjecucionAuditoria.ESTADO_EXITOSA
            ejecucion.fecha_fin = timezone.now()
            ejecucion.save()
    except Exception as exc:
        logger.exception('Falló la auditoría %s (ejecución #%s)', tipo, ejecucion.pk)
        ejecucion.refresh_from_db()
        ejecucion.estado = EjecucionAuditoria.ESTADO_FALLIDA
        ejecucion.mensaje_error = str(exc) or exc.__class__.__name__
        ejecucion.fecha_fin = timezone.now()
        ejecucion.save(update_fields=['estado', 'mensaje_error', 'fecha_fin'])

    return ejecucion


# --- Resolución de discrepancias ---------------------------------------------------


def _bloquear_discrepancia_abierta(discrepancia_id):
    discrepancia = DiscrepanciaAuditoria.objects.select_for_update().get(pk=discrepancia_id)
    if discrepancia.estado != DiscrepanciaAuditoria.ESTADO_ABIERTA:
        raise ValidationError({
            'detail': f'Esta discrepancia ya está {discrepancia.get_estado_display().lower()}; '
                      'no se puede volver a resolver.',
        })
    return discrepancia


@transaction.atomic
def ajustar_discrepancia(discrepancia_id, usuario, comentario=''):
    """Aprueba una discrepancia de conteo y genera su ajuste de stock (entrada
    si sobró, salida si faltó) vía `apps.inventario.services.ajustar_stock`."""

    discrepancia = _bloquear_discrepancia_abierta(discrepancia_id)
    if discrepancia.categoria != DiscrepanciaAuditoria.CATEGORIA_INVENTARIO_CONTEO:
        raise ValidationError({
            'detail': 'Solo las discrepancias de conteo físico se pueden ajustar; esta solo se puede justificar.',
        })

    modelo = Producto if discrepancia.tipo_item == MovimientoInventario.TIPO_PRODUCTO else MateriaPrima
    item = modelo.objects.get(pk=discrepancia.item_id)
    movimiento = ajustar_stock(
        sucursal=discrepancia.sucursal, tipo_item=discrepancia.tipo_item, item=item,
        diferencia=discrepancia.diferencia, referencia_id=discrepancia.pk, usuario=usuario,
    )

    discrepancia.estado = DiscrepanciaAuditoria.ESTADO_AJUSTADA
    discrepancia.movimiento_ajuste_id = movimiento.pk
    discrepancia.resuelta_por = usuario
    discrepancia.fecha_resolucion = timezone.now()
    discrepancia.comentario_resolucion = comentario
    discrepancia.save()
    return discrepancia


@transaction.atomic
def justificar_discrepancia(discrepancia_id, usuario, comentario):
    if not comentario.strip():
        raise ValidationError({'comentario': 'La justificación necesita un comentario.'})

    discrepancia = _bloquear_discrepancia_abierta(discrepancia_id)
    discrepancia.estado = DiscrepanciaAuditoria.ESTADO_JUSTIFICADA
    discrepancia.resuelta_por = usuario
    discrepancia.fecha_resolucion = timezone.now()
    discrepancia.comentario_resolucion = comentario.strip()
    discrepancia.save()
    return discrepancia


# --- Resumen para las vistas vinculadas ------------------------------------------


def resumen(limite_cortes=12):
    """Datos de Caja, Inventario, Header y Dashboard en una sola consulta."""

    abiertas = DiscrepanciaAuditoria.objects.filter(estado=DiscrepanciaAuditoria.ESTADO_ABIERTA)

    ultimas = {}
    for tipo, _ in EjecucionAuditoria.TIPO_CHOICES:
        ejecucion = EjecucionAuditoria.objects.filter(tipo=tipo).exclude(
            estado=EjecucionAuditoria.ESTADO_EN_CURSO,
        ).first()
        ultimas[tipo] = None if ejecucion is None else {
            'id': ejecucion.id,
            'fecha': ejecucion.fecha_inicio,
            'estado': ejecucion.estado,
            'discrepancias_encontradas': ejecucion.discrepancias_encontradas,
            'discrepancias_abiertas': abiertas.filter(ejecucion=ejecucion).count(),
        }

    por_sucursal = (
        abiertas.filter(categoria__in=DiscrepanciaAuditoria.CATEGORIAS_INVENTARIO)
        .values('sucursal', 'sucursal__nombre_sucursal')
        .order_by('sucursal__nombre_sucursal')
    )
    conteo_por_sucursal = {}
    for fila in por_sucursal:
        clave = fila['sucursal']
        if clave not in conteo_por_sucursal:
            conteo_por_sucursal[clave] = {
                'sucursal': clave, 'sucursal_nombre': fila['sucursal__nombre_sucursal'], 'abiertas': 0,
            }
        conteo_por_sucursal[clave]['abiertas'] += 1

    cortes = (
        CorteCaja.objects.filter(ejecucion__isnull=False, reemplazado_por__isnull=True)
        .order_by('-fecha_hora_corte', '-id')[:limite_cortes]
    )
    serie_cortes = [
        {
            'id': corte.id,
            'fecha_hora_corte': corte.fecha_hora_corte,
            'saldo_esperado': corte.saldo_esperado,
            'monto_contado': corte.monto_contado,
            'diferencia': corte.monto_contado - (corte.saldo_esperado or CERO),
        }
        for corte in reversed(list(cortes))
    ]

    return {
        'ultima_caja': ultimas[EjecucionAuditoria.TIPO_CAJA],
        'ultima_inventario': ultimas[EjecucionAuditoria.TIPO_INVENTARIO],
        'abiertas_caja': abiertas.filter(categoria__in=DiscrepanciaAuditoria.CATEGORIAS_CAJA).count(),
        'abiertas_inventario': abiertas.filter(categoria__in=DiscrepanciaAuditoria.CATEGORIAS_INVENTARIO).count(),
        'abiertas_por_sucursal': list(conteo_por_sucursal.values()),
        'serie_cortes': serie_cortes,
    }
