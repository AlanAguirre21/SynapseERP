from decimal import Decimal

from .models import MovimientoCaja


class SaldoInsuficienteError(Exception):
    """Se lanza si un retiro (manual o el reverso de una venta cancelada)
    dejaría el saldo de caja por debajo de cero — bloqueo estricto exigido
    por `spec.md` de `013 · Caja`, sin excepción ni confirmación posible.
    """


def calcular_saldo_actual():
    """Saldo actual = `saldo_resultante` del movimiento más reciente, NUNCA
    una suma recalculada de toda la tabla en cada consulta — criterio de
    aceptación explícito de `013 · Caja`.
    """

    ultimo = MovimientoCaja.objects.order_by('-id').first()
    return ultimo.saldo_resultante if ultimo else Decimal('0.00')


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

    if tipo_movimiento == MovimientoCaja.INGRESO:
        nuevo_saldo = saldo_anterior + monto
    else:
        nuevo_saldo = saldo_anterior - monto
        if nuevo_saldo < 0:
            raise SaldoInsuficienteError(
                f'Este retiro dejaría el saldo de caja en {nuevo_saldo} — el saldo nunca puede ser negativo.',
            )

    return MovimientoCaja.objects.create(
        monto=monto, tipo_movimiento=tipo_movimiento, motivo=motivo, referencia_id=referencia_id,
        saldo_resultante=nuevo_saldo, observacion=observacion, usuario=usuario,
    )
