from decimal import Decimal

import pytest

from apps.caja.models import MovimientoCaja
from apps.caja.services import (
    SaldoInsuficienteError,
    calcular_saldo_actual,
    calcular_saldos,
    registrar_movimiento_caja,
)
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


@pytest.mark.django_db
def test_retiro_que_dejaria_saldo_negativo_es_rechazado(usuario):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('50.00'), motivo=MovimientoCaja.MOTIVO_VENTA,
        referencia_id=1, usuario=usuario,
    )

    with pytest.raises(SaldoInsuficienteError):
        registrar_movimiento_caja(
            tipo_movimiento=MovimientoCaja.RETIRO, monto=Decimal('50.01'), motivo=MovimientoCaja.MOTIVO_MANUAL,
            referencia_id=None, usuario=usuario, observacion='Retiro de prueba',
        )

    # El intento rechazado no debe haber quedado insertado ni alterado el saldo.
    assert calcular_saldo_actual() == Decimal('50.00')
    assert MovimientoCaja.objects.count() == 1


@pytest.mark.django_db
def test_retiro_sin_movimientos_previos_es_rechazado(usuario):
    with pytest.raises(SaldoInsuficienteError):
        registrar_movimiento_caja(
            tipo_movimiento=MovimientoCaja.RETIRO, monto=Decimal('1.00'), motivo=MovimientoCaja.MOTIVO_MANUAL,
            referencia_id=None, usuario=usuario, observacion='Retiro de prueba',
        )
    assert not MovimientoCaja.objects.exists()


# --- Saldo adicional (envío) / saldo global -------------------------------


@pytest.mark.django_db
def test_calcular_saldos_sin_movimientos_es_todo_cero():
    assert calcular_saldos() == {
        'saldo_actual': Decimal('0.00'), 'saldo_adicional': Decimal('0.00'), 'saldo_total': Decimal('0.00'),
    }


@pytest.mark.django_db
def test_movimiento_envio_solo_afecta_el_saldo_adicional_no_el_actual(usuario):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('450.00'), motivo=MovimientoCaja.MOTIVO_VENTA,
        referencia_id=1, usuario=usuario,
    )
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('50.00'), motivo=MovimientoCaja.MOTIVO_ENVIO,
        referencia_id=1, usuario=usuario,
    )

    assert calcular_saldos() == {
        'saldo_actual': Decimal('450.00'), 'saldo_adicional': Decimal('50.00'), 'saldo_total': Decimal('500.00'),
    }
    # `calcular_saldo_actual()` no cambia de comportamiento: sigue devolviendo
    # el saldo GLOBAL (incluye envío), no el nuevo "saldo actual" sin envío.
    assert calcular_saldo_actual() == Decimal('500.00')


@pytest.mark.django_db
def test_retiro_de_envio_descuenta_saldo_adicional_y_saldo_global(usuario):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('50.00'), motivo=MovimientoCaja.MOTIVO_ENVIO,
        referencia_id=1, usuario=usuario,
    )
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.RETIRO, monto=Decimal('50.00'), motivo=MovimientoCaja.MOTIVO_ENVIO,
        referencia_id=1, usuario=usuario,
    )

    assert calcular_saldos() == {
        'saldo_actual': Decimal('0.00'), 'saldo_adicional': Decimal('0.00'), 'saldo_total': Decimal('0.00'),
    }


@pytest.mark.django_db
def test_retiro_de_compra_descuenta_del_saldo_global(usuario):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('1000.00'), motivo=MovimientoCaja.MOTIVO_MANUAL,
        referencia_id=None, usuario=usuario, observacion='Fondeo',
    )
    movimiento = registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.RETIRO, monto=Decimal('300.00'), motivo=MovimientoCaja.MOTIVO_COMPRA,
        referencia_id=7, usuario=usuario,
    )

    assert movimiento.saldo_resultante == Decimal('700.00')
    assert calcular_saldos()['saldo_total'] == Decimal('700.00')


@pytest.mark.django_db
def test_retiro_por_compra_que_dejaria_saldo_negativo_es_rechazado(usuario):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('100.00'), motivo=MovimientoCaja.MOTIVO_MANUAL,
        referencia_id=None, usuario=usuario, observacion='Fondeo',
    )

    with pytest.raises(SaldoInsuficienteError):
        registrar_movimiento_caja(
            tipo_movimiento=MovimientoCaja.RETIRO, monto=Decimal('100.01'), motivo=MovimientoCaja.MOTIVO_COMPRA,
            referencia_id=1, usuario=usuario,
        )
