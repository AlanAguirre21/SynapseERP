from decimal import Decimal

from apps.contabilidad.services.generador_asientos import generar_asiento_caja

from .models import MovimientoCaja


class SaldoInsuficienteError(Exception):
    """Se lanza si un retiro (manual o el reverso de una venta cancelada)
    dejaría el saldo de caja por debajo de cero — bloqueo estricto exigido
    por `spec.md` de `013 · Caja`, sin excepción ni confirmación posible.
    """


def calcular_saldo_actual():
    """`saldo_resultante` del movimiento más reciente, NUNCA una suma
    recalculada de toda la tabla en cada consulta — criterio de aceptación
    original de `013 · Caja`. Se mantiene sin cambios tras el ajuste de
    "saldo adicional por envío": sigue siendo el saldo GLOBAL (incluye
    envío) — `calcular_saldos()` es la función nueva que separa
    saldo_actual/saldo_adicional/saldo_total para la vista `saldo`.
    """

    ultimo = MovimientoCaja.objects.order_by('-id').first()
    return ultimo.saldo_resultante if ultimo else Decimal('0.00')


def calcular_saldos():
    """Devuelve `{saldo_actual, saldo_adicional, saldo_total}` en una sola
    consulta del último movimiento — mismo criterio de `calcular_saldo_actual()`
    (nunca `SUM()` de toda la tabla). `saldo_total` es el `saldo_resultante`
    global (incluye envío); `saldo_adicional` es el neto acumulado de
    movimientos `motivo=envio`; `saldo_actual` es la resta de ambos.
    """

    ultimo = MovimientoCaja.objects.order_by('-id').first()
    saldo_total = ultimo.saldo_resultante if ultimo else Decimal('0.00')
    saldo_adicional = ultimo.saldo_adicional_resultante if ultimo else Decimal('0.00')
    return {
        'saldo_actual': saldo_total - saldo_adicional,
        'saldo_adicional': saldo_adicional,
        'saldo_total': saldo_total,
    }


def registrar_movimiento_caja(*, tipo_movimiento, monto, motivo, referencia_id, usuario, observacion=''):
    """Única función autorizada para insertar un `MovimientoCaja` — tanto
    el ingreso/reverso automático de `011 · Ventas` como el registro
    manual de `013 · Caja` pasan por aquí, para que el bloqueo de
    concurrencia y el rechazo de saldo negativo cubran ambas rutas por
    igual (no dos implementaciones distintas).

    Debe llamarse dentro de una `transaction.atomic()` ya abierta por
    quien invoca — el `select_for_update()` sobre el último movimiento
    solo tiene efecto de bloqueo dentro de una transacción activa.
    """

    ultimo = MovimientoCaja.objects.select_for_update().order_by('-id').first()
    saldo_anterior = ultimo.saldo_resultante if ultimo else Decimal('0.00')
    saldo_adicional_anterior = ultimo.saldo_adicional_resultante if ultimo else Decimal('0.00')

    if tipo_movimiento == MovimientoCaja.INGRESO:
        nuevo_saldo = saldo_anterior + monto
    else:
        nuevo_saldo = saldo_anterior - monto
        if nuevo_saldo < 0:
            # El bloqueo estricto de saldo negativo se evalúa siempre sobre
            # el saldo GLOBAL (`saldo_resultante`), nunca sobre el adicional
            # por separado — "saldo actual" y "saldo adicional" son
            # categorías informativas del mismo efectivo, no cuentas
            # independientes con su propio límite.
            raise SaldoInsuficienteError(
                f'Este retiro dejaría el saldo de caja en {nuevo_saldo} — el saldo nunca puede ser negativo.',
            )

    # El saldo adicional (envío) solo se mueve con `motivo=envio` — en
    # cualquier otro movimiento se arrastra igual que el anterior.
    if motivo == MovimientoCaja.MOTIVO_ENVIO:
        if tipo_movimiento == MovimientoCaja.INGRESO:
            nuevo_saldo_adicional = saldo_adicional_anterior + monto
        else:
            nuevo_saldo_adicional = saldo_adicional_anterior - monto
    else:
        nuevo_saldo_adicional = saldo_adicional_anterior

    movimiento = MovimientoCaja.objects.create(
        monto=monto, tipo_movimiento=tipo_movimiento, motivo=motivo, referencia_id=referencia_id,
        saldo_resultante=nuevo_saldo, saldo_adicional_resultante=nuevo_saldo_adicional,
        observacion=observacion, usuario=usuario,
    )

    # Único punto de entrada de `MovimientoCaja` (ver docstring de esta
    # función) — generar aquí el asiento contable del lado de Caja cubre
    # por igual el ingreso automático de una venta, su reverso al
    # cancelarse, y el registro manual de `013 · Caja`, sin duplicar la
    # regla contable en cada llamador (`018 · Contabilidad`).
    generar_asiento_caja(movimiento)

    return movimiento
