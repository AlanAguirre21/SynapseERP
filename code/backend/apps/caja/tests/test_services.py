from decimal import Decimal

import pytest

from apps.caja.models import MovimientoCaja
from apps.caja.services import calcular_saldo_actual, registrar_movimiento_caja
from apps.usuarios.models import Usuario


@pytest.fixture
def usuario(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123',
    )


@pytest.mark.django_db
def test_saldo_actual_es_cero_sin_movimientos():
    assert calcular_saldo_actual() == Decimal(0)


@pytest.mark.django_db
def test_registrar_ingreso_calcula_saldo_resultante(usuario):
    movimiento = registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('100.00'), motivo=MovimientoCaja.MOTIVO_VENTA,
        referencia_id=1, usuario=usuario,
    )
    assert movimiento.saldo_resultante == Decimal('100.00')
    assert calcular_saldo_actual() == Decimal('100.00')


@pytest.mark.django_db
def test_registrar_retiro_descuenta_del_saldo(usuario):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('100.00'), motivo=MovimientoCaja.MOTIVO_VENTA,
        referencia_id=1, usuario=usuario,
    )
    movimiento = registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.RETIRO, monto=Decimal('30.00'), motivo=MovimientoCaja.MOTIVO_AJUSTE,
        referencia_id=1, usuario=usuario,
    )
    assert movimiento.saldo_resultante == Decimal('70.00')
    assert calcular_saldo_actual() == Decimal('70.00')
