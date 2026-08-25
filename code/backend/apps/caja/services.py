from decimal import Decimal

from django.db.models import Sum

from .models import MovimientoCaja


def calcular_saldo_actual():
    ingresos = (
        MovimientoCaja.objects.filter(tipo_movimiento=MovimientoCaja.INGRESO).aggregate(total=Sum('monto'))['total']
        or Decimal(0)
    )
    retiros = (
        MovimientoCaja.objects.filter(tipo_movimiento=MovimientoCaja.RETIRO).aggregate(total=Sum('monto'))['total']
        or Decimal(0)
    )
    return ingresos - retiros


def registrar_movimiento_caja(*, tipo_movimiento, monto, motivo, referencia_id, usuario, observacion=''):
    saldo_actual = calcular_saldo_actual()
    nuevo_saldo = saldo_actual + monto if tipo_movimiento == MovimientoCaja.INGRESO else saldo_actual - monto

    return MovimientoCaja.objects.create(
        monto=monto, tipo_movimiento=tipo_movimiento, motivo=motivo, referencia_id=referencia_id,
        saldo_resultante=nuevo_saldo, observacion=observacion, usuario=usuario,
    )
