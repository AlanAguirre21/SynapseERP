"""Genera los asientos contables a partir de una venta, compra o
movimiento de caja ya confirmados — feature `018 · Contabilidad`. Única
capa autorizada para crear `AsientoContable`/`MovimientoContable`: nunca
se crean manualmente desde una vista (ver `plan.md`, Decisiones).

Reparto de responsabilidades para no asentar el mismo hecho económico dos
veces:
- `generar_asiento_venta()`/`reversar_asiento_venta()` solo registran el
  costo de venta y la salida/entrada de inventario — el lado de
  Caja/Ventas de una venta en efectivo ya lo cubre
  `generar_asiento_caja()`, invocado por
  `apps.caja.services.registrar_movimiento_caja()` (única función
  autorizada para insertar un `MovimientoCaja`, según su propio
  docstring) para el ingreso/reverso automático que `011 · Ventas` ya
  registra ahí.
- `generar_asiento_compra()`/`reversar_asiento_compra()` sí registran
  ambos lados (Inventario/Proveedores) porque `010 · Compras` nunca toca
  caja — no hay otro punto de integración que lo cubra.
- `generar_asiento_caja()` cubre el lado de Caja de cualquier
  `MovimientoCaja`, sea automático (venta) o manual (`013 · Caja`).
"""

from decimal import Decimal

from django.db import transaction

from apps.caja.models import MovimientoCaja

from .. import constants
from ..models import AsientoContable, CuentaContable, MovimientoContable


def _cuenta(codigo):
    # Deliberadamente sin filtrar por `activo`: estos códigos son
    # cuentas de sistema (`constants.CODIGOS_CUENTAS_SISTEMA`), protegidas
    # contra desactivación en `CuentaContableViewSet` — si de todos modos
    # llegaran a faltar, es correcto que la operación completa falle
    # (ver `plan.md`, Decisiones) en vez de asentar en la cuenta equivocada.
    return CuentaContable.objects.get(codigo=codigo)


def _crear_asiento(*, concepto, tipo_origen, referencia_id, usuario, lineas):
    """`lineas`: iterable de `(codigo_cuenta, tipo_movimiento, monto)`.
    Valida que la suma de cargos sea igual a la suma de abonos antes de
    confirmar — un asiento descuadrado nunca se guarda.
    """

    total_cargos = sum((monto for _, tipo, monto in lineas if tipo == MovimientoContable.CARGO), Decimal('0.00'))
    total_abonos = sum((monto for _, tipo, monto in lineas if tipo == MovimientoContable.ABONO), Decimal('0.00'))
    if total_cargos != total_abonos:
        raise ValueError(
            f'Asiento descuadrado ({tipo_origen} #{referencia_id}): '
            f'cargos={total_cargos}, abonos={total_abonos}.',
        )

    with transaction.atomic():
        asiento = AsientoContable.objects.create(
            concepto=concepto, tipo_origen=tipo_origen, referencia_id=referencia_id, usuario=usuario,
        )
        MovimientoContable.objects.bulk_create([
            MovimientoContable(
                asiento=asiento, cuenta_contable=_cuenta(codigo), tipo_movimiento=tipo_movimiento, monto=monto,
            )
            for codigo, tipo_movimiento, monto in lineas
        ])

    return asiento


def _costo_total_venta(venta):
    return sum(
        (detalle.cantidad * detalle.producto.costo_produccion for detalle in venta.detalles.select_related('producto').all()),
        Decimal('0.00'),
    )


def generar_asiento_venta(venta):
    costo_total = _costo_total_venta(venta)
    if costo_total == 0:
        return None

    return _crear_asiento(
        concepto=f'Costo de venta #{venta.id}', tipo_origen=AsientoContable.ORIGEN_VENTA, referencia_id=venta.id,
        usuario=venta.usuario,
        lineas=[
            (constants.CODIGO_COSTO_VENTAS, MovimientoContable.CARGO, costo_total),
            (constants.CODIGO_INVENTARIO, MovimientoContable.ABONO, costo_total),
        ],
    )


def reversar_asiento_venta(venta):
    costo_total = _costo_total_venta(venta)
    if costo_total == 0:
        return None

    return _crear_asiento(
        concepto=f'Reverso de costo de venta #{venta.id}', tipo_origen=AsientoContable.ORIGEN_AJUSTE,
        referencia_id=venta.id, usuario=venta.usuario,
        lineas=[
            (constants.CODIGO_INVENTARIO, MovimientoContable.CARGO, costo_total),
            (constants.CODIGO_COSTO_VENTAS, MovimientoContable.ABONO, costo_total),
        ],
    )


def generar_asiento_compra(compra):
    if compra.total == 0:
        return None

    return _crear_asiento(
        concepto=f'Recepción de compra #{compra.id}', tipo_origen=AsientoContable.ORIGEN_COMPRA,
        referencia_id=compra.id, usuario=compra.usuario,
        lineas=[
            (constants.CODIGO_INVENTARIO, MovimientoContable.CARGO, compra.total),
            (constants.CODIGO_PROVEEDORES, MovimientoContable.ABONO, compra.total),
        ],
    )


def reversar_asiento_compra(compra):
    if compra.total == 0:
        return None

    return _crear_asiento(
        concepto=f'Reverso de compra #{compra.id}', tipo_origen=AsientoContable.ORIGEN_AJUSTE,
        referencia_id=compra.id, usuario=compra.usuario,
        lineas=[
            (constants.CODIGO_PROVEEDORES, MovimientoContable.CARGO, compra.total),
            (constants.CODIGO_INVENTARIO, MovimientoContable.ABONO, compra.total),
        ],
    )


def generar_asiento_caja(movimiento_caja):
    if movimiento_caja.motivo == MovimientoCaja.MOTIVO_MANUAL:
        # `013 · Caja` no captura una cuenta contable específica por
        # movimiento manual (solo tipo + monto + observación libre) — se
        # usa una cuenta contraparte genérica según la dirección, editable
        # después por el admin si necesita reclasificar con el contador.
        codigo_contraparte = (
            constants.CODIGO_CAPITAL if movimiento_caja.tipo_movimiento == MovimientoCaja.INGRESO
            else constants.CODIGO_GASTOS_GENERALES
        )
    else:
        # `venta` (ingreso automático) y `ajuste` (único ajuste existente
        # hoy es el reverso de una venta cancelada) afectan la misma
        # cuenta de Ventas, en el sentido que corresponda según la
        # dirección del movimiento.
        codigo_contraparte = constants.CODIGO_VENTAS

    monto = movimiento_caja.monto
    if movimiento_caja.tipo_movimiento == MovimientoCaja.INGRESO:
        lineas = [
            (constants.CODIGO_CAJA, MovimientoContable.CARGO, monto),
            (codigo_contraparte, MovimientoContable.ABONO, monto),
        ]
    else:
        lineas = [
            (codigo_contraparte, MovimientoContable.CARGO, monto),
            (constants.CODIGO_CAJA, MovimientoContable.ABONO, monto),
        ]

    return _crear_asiento(
        # `referencia_id` propaga el mismo `MovimientoCaja.referencia_id`
        # (id de la venta que lo originó, o `None` para un movimiento
        # manual) — no el id del propio `MovimientoCaja` — para que
        # filtrar el libro diario por una referencia encuentre tanto el
        # asiento de costo (`generar_asiento_venta`) como el de caja.
        concepto=movimiento_caja.observacion or f'Movimiento de caja #{movimiento_caja.id}',
        tipo_origen=AsientoContable.ORIGEN_CAJA, referencia_id=movimiento_caja.referencia_id,
        usuario=movimiento_caja.usuario, lineas=lineas,
    )
