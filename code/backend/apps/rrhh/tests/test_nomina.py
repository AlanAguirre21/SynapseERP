"""Nómina con pago en caja — `008 · RRHH`, "Actualización: nómina con pago en
caja" (y sus efectos en `015 · Caja` y `020 · Contabilidad`)."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import transaction
from rest_framework.test import APIClient

from apps.caja.models import MovimientoCaja
from apps.caja.services import calcular_saldo_actual, registrar_movimiento_caja
from apps.contabilidad.models import AsientoContable, CuentaContable
from apps.rrhh.models import (
    Departamento,
    Empleado,
    EmpleadoPosicion,
    Posicion,
    SolicitudNomina,
)
from apps.usuarios.models import Usuario

URL = '/api/rrhh/solicitudes-nomina/'


@pytest.fixture
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@synapse.test', password='clave-segura-123', rol_usuario='admin',
    )


@pytest.fixture
def operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@synapse.test', password='clave-segura-123', rol_usuario='operador',
    )


def _cliente(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def admin_client(admin):
    return _cliente(admin)


@pytest.fixture
def posicion(db):
    departamento = Departamento.objects.create(nombre_departamento='Ventas')
    return Posicion.objects.create(
        titulo_posicion='Vendedor', departamento=departamento, salario_minimo='5000.00', salario_maximo='20000.00',
    )


def _empleado(nombre, posicion=None, salario='9000.00', activo=True):
    empleado = Empleado.objects.create(nombre_completo=nombre, activo=activo)
    if posicion:
        EmpleadoPosicion.objects.create(
            empleado=empleado, posicion=posicion, salario_asignado=salario, fecha_inicio=date(2026, 1, 1),
        )
    return empleado


def _ingreso_caja(usuario, monto):
    with transaction.atomic():
        registrar_movimiento_caja(
            tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal(monto), motivo=MovimientoCaja.MOTIVO_MANUAL,
            referencia_id=None, usuario=usuario,
        )


def _solicitud(empleado, monto='4500.00', inicio=date(2026, 3, 1), fin=date(2026, 3, 15), estado='pendiente'):
    return SolicitudNomina.objects.create(
        empleado=empleado, periodo_inicio=inicio, periodo_fin=fin, monto=monto, estado=estado,
    )


def _movimientos_contables(cuenta_codigo):
    cuenta = CuentaContable.objects.get(codigo=cuenta_codigo)
    return list(cuenta.movimientos_contables.values_list('tipo_movimiento', 'monto'))


# --- Generar nómina --------------------------------------------------------------


def test_generar_crea_pendientes_por_la_mitad_del_salario(admin_client, posicion):
    ana = _empleado('Ana Ruiz', posicion, salario='9000.00')
    beto = _empleado('Beto Luna', posicion, salario='10001.01')

    respuesta = admin_client.post(f'{URL}generar/', {'anio': 2026, 'mes': 2, 'quincena': 2}, format='json')

    assert respuesta.status_code == 201
    creadas = {fila['empleado']: fila for fila in respuesta.data['creadas']}
    assert creadas[ana.id]['monto'] == '4500.00'
    # 10001.01 / 2 = 5000.505 → redondeo a centavos hacia arriba en el medio.
    assert creadas[beto.id]['monto'] == '5000.51'
    assert creadas[ana.id]['periodo_inicio'] == '2026-02-16'
    assert creadas[ana.id]['periodo_fin'] == '2026-02-28'
    assert creadas[ana.id]['estado'] == 'pendiente'
    assert creadas[ana.id]['empleado_nombre'] == 'Ana Ruiz'
    assert creadas[ana.id]['posicion_nombre'] == 'Vendedor'


def test_generar_omite_duplicados_inactivos_y_sin_posicion(admin_client, posicion):
    ya_tiene = _empleado('Ana Ruiz', posicion)
    _solicitud(ya_tiene, inicio=date(2026, 3, 1), fin=date(2026, 3, 15))
    sin_posicion = _empleado('Beto Luna')
    _empleado('Carla Inactiva', posicion, activo=False)
    nuevo = _empleado('Dora Paz', posicion)

    respuesta = admin_client.post(f'{URL}generar/', {'anio': 2026, 'mes': 3, 'quincena': 1}, format='json')

    assert [fila['empleado'] for fila in respuesta.data['creadas']] == [nuevo.id]
    omitidas = {fila['empleado']: fila['motivo'] for fila in respuesta.data['omitidas']}
    assert omitidas == {
        ya_tiene.id: 'Ya tiene una solicitud de nómina para este periodo.',
        sin_posicion.id: 'Sin posición vigente.',
    }


def test_una_solicitud_rechazada_o_revertida_no_impide_generar(admin_client, posicion):
    empleado = _empleado('Ana Ruiz', posicion)
    _solicitud(empleado, estado='rechazado')
    _solicitud(empleado, estado='revertido')

    respuesta = admin_client.post(f'{URL}generar/', {'anio': 2026, 'mes': 3, 'quincena': 1}, format='json')

    assert len(respuesta.data['creadas']) == 1


# --- No duplicar y edición -----------------------------------------------------------


def test_no_se_crea_una_solicitud_que_se_traslapa(admin_client, posicion):
    empleado = _empleado('Ana Ruiz', posicion)
    existente = _solicitud(empleado)

    respuesta = admin_client.post(URL, {
        'empleado': empleado.id, 'periodo_inicio': '2026-03-10', 'periodo_fin': '2026-03-31', 'monto': '1000.00',
    }, format='json')

    assert respuesta.status_code == 400
    assert f'#{existente.id}' in respuesta.data['periodo_inicio'][0]


def test_el_monto_se_edita_solo_en_pendiente(admin_client, posicion, admin):
    empleado = _empleado('Ana Ruiz', posicion)
    pendiente = _solicitud(empleado)
    pagada = _solicitud(empleado, inicio=date(2026, 4, 1), fin=date(2026, 4, 15), estado='pagado')

    ok = admin_client.patch(f'{URL}{pendiente.id}/', {'monto': '4000.00', 'periodo_inicio': '2026-05-01'}, format='json')
    rechazo = admin_client.patch(f'{URL}{pagada.id}/', {'monto': '1.00'}, format='json')

    assert ok.status_code == 200
    pendiente.refresh_from_db()
    assert pendiente.monto == Decimal('4000.00')
    # Empleado y periodo se fijan al crear la solicitud.
    assert pendiente.periodo_inicio == date(2026, 3, 1)
    assert rechazo.status_code == 400
    assert rechazo.data == {'detail': 'Solo se puede editar una solicitud de nómina pendiente.'}


# --- Aprobar y pagar -----------------------------------------------------------------


def test_aprobar_paga_desde_caja_y_genera_asiento_de_sueldos(admin_client, admin, posicion):
    empleado = _empleado('Ana Ruiz', posicion)
    solicitud = _solicitud(empleado, monto='4500.00')
    _ingreso_caja(admin, '10000.00')

    respuesta = admin_client.post(f'{URL}{solicitud.id}/aprobar/')

    assert respuesta.status_code == 200
    assert respuesta.data['estado'] == 'pagado'
    assert respuesta.data['resuelto_por_nombre'] == 'admin1'
    solicitud.refresh_from_db()
    movimiento = solicitud.movimiento_pago
    assert movimiento.tipo_movimiento == MovimientoCaja.RETIRO
    assert movimiento.motivo == MovimientoCaja.MOTIVO_NOMINA
    assert movimiento.monto == Decimal('4500.00')
    assert movimiento.referencia_id == solicitud.id
    assert movimiento.observacion == 'Nómina de Ana Ruiz (01/03/2026 – 15/03/2026)'
    assert calcular_saldo_actual() == Decimal('5500.00')
    assert _movimientos_contables('5300') == [('cargo', Decimal('4500.00'))]


def test_sin_saldo_suficiente_no_se_paga_y_sigue_pendiente(admin_client, admin, posicion):
    solicitud = _solicitud(_empleado('Ana Ruiz', posicion), monto='4500.00')
    _ingreso_caja(admin, '100.00')

    respuesta = admin_client.post(f'{URL}{solicitud.id}/aprobar/')

    assert respuesta.status_code == 400
    assert 'saldo' in respuesta.data['detail']
    solicitud.refresh_from_db()
    assert solicitud.estado == 'pendiente'
    assert solicitud.movimiento_pago is None
    assert calcular_saldo_actual() == Decimal('100.00')


def test_pago_en_bloque_paga_todas(admin_client, admin, posicion):
    a = _solicitud(_empleado('Ana Ruiz', posicion), monto='3000.00')
    b = _solicitud(_empleado('Beto Luna', posicion), monto='2000.00')
    _ingreso_caja(admin, '6000.00')

    respuesta = admin_client.post(f'{URL}pagar-lote/', {'ids': [a.id, b.id]}, format='json')

    assert respuesta.status_code == 200
    assert {fila['estado'] for fila in respuesta.data} == {'pagado'}
    assert calcular_saldo_actual() == Decimal('1000.00')
    assert MovimientoCaja.objects.filter(motivo=MovimientoCaja.MOTIVO_NOMINA).count() == 2


def test_pago_en_bloque_es_todo_o_nada_por_saldo(admin_client, admin, posicion):
    a = _solicitud(_empleado('Ana Ruiz', posicion), monto='3000.00')
    b = _solicitud(_empleado('Beto Luna', posicion), monto='2000.00')
    _ingreso_caja(admin, '4000.00')

    respuesta = admin_client.post(f'{URL}pagar-lote/', {'ids': [a.id, b.id]}, format='json')

    assert respuesta.status_code == 400
    assert 'no se pagó ninguna' in respuesta.data['detail']
    assert set(SolicitudNomina.objects.values_list('estado', flat=True)) == {'pendiente'}
    assert calcular_saldo_actual() == Decimal('4000.00')


def test_pago_en_bloque_es_todo_o_nada_si_alguna_ya_no_esta_pendiente(admin_client, admin, posicion):
    a = _solicitud(_empleado('Ana Ruiz', posicion), monto='3000.00')
    b = _solicitud(_empleado('Beto Luna', posicion), monto='2000.00', estado='rechazado')
    _ingreso_caja(admin, '9000.00')

    respuesta = admin_client.post(f'{URL}pagar-lote/', {'ids': [a.id, b.id]}, format='json')

    assert respuesta.status_code == 400
    assert f'#{b.id}' in respuesta.data['detail']
    a.refresh_from_db()
    assert a.estado == 'pendiente'
    assert calcular_saldo_actual() == Decimal('9000.00')


def test_no_se_paga_dos_veces(admin_client, admin, posicion):
    solicitud = _solicitud(_empleado('Ana Ruiz', posicion))
    _ingreso_caja(admin, '10000.00')
    admin_client.post(f'{URL}{solicitud.id}/aprobar/')

    respuesta = admin_client.post(f'{URL}{solicitud.id}/aprobar/')

    assert respuesta.status_code == 400
    assert MovimientoCaja.objects.filter(motivo=MovimientoCaja.MOTIVO_NOMINA).count() == 1


# --- Revertir ------------------------------------------------------------------------


def test_revertir_registra_el_ingreso_inverso_contra_sueldos(admin_client, admin, posicion):
    solicitud = _solicitud(_empleado('Ana Ruiz', posicion), monto='4500.00')
    _ingreso_caja(admin, '10000.00')
    admin_client.post(f'{URL}{solicitud.id}/aprobar/')

    respuesta = admin_client.post(f'{URL}{solicitud.id}/revertir/', {'motivo': 'Monto equivocado'}, format='json')

    assert respuesta.status_code == 200
    assert respuesta.data['estado'] == 'revertido'
    assert respuesta.data['motivo_reverso'] == 'Monto equivocado'
    assert respuesta.data['revertido_por_nombre'] == 'admin1'
    solicitud.refresh_from_db()
    reverso = solicitud.movimiento_reverso
    assert reverso.tipo_movimiento == MovimientoCaja.INGRESO
    assert reverso.motivo == MovimientoCaja.MOTIVO_NOMINA
    assert reverso.observacion == 'Reverso de nómina de Ana Ruiz (01/03/2026 – 15/03/2026): Monto equivocado'
    # El retiro original sigue intacto (insert-only).
    assert solicitud.movimiento_pago.tipo_movimiento == MovimientoCaja.RETIRO
    assert calcular_saldo_actual() == Decimal('10000.00')
    assert sorted(_movimientos_contables('5300')) == [('abono', Decimal('4500.00')), ('cargo', Decimal('4500.00'))]
    # Ningún asiento de nómina toca Ventas.
    assert not CuentaContable.objects.get(codigo='4100').movimientos_contables.exists()


def test_revertir_exige_motivo_y_estado_pagado(admin_client, posicion):
    pendiente = _solicitud(_empleado('Ana Ruiz', posicion))

    sin_motivo = admin_client.post(f'{URL}{pendiente.id}/revertir/', {'motivo': '  '}, format='json')
    no_pagada = admin_client.post(f'{URL}{pendiente.id}/revertir/', {'motivo': 'Error'}, format='json')

    assert sin_motivo.data == {'detail': 'Indica el motivo del reverso.'}
    assert no_pagada.data == {'detail': 'Solo se puede revertir el pago de una solicitud pagada.'}


def test_una_aprobada_historica_no_se_revierte_ni_se_toca(admin_client, posicion):
    historica = _solicitud(_empleado('Ana Ruiz', posicion), estado='aprobado')

    respuesta = admin_client.post(f'{URL}{historica.id}/revertir/', {'motivo': 'Error'}, format='json')
    lista = admin_client.get(URL)

    assert respuesta.status_code == 400
    historica.refresh_from_db()
    assert historica.estado == 'aprobado'
    assert historica.movimiento_pago is None
    assert lista.data[0]['estado'] == 'aprobado'
    assert not MovimientoCaja.objects.exists()


# --- Rechazar, borrar, filtros y permisos ------------------------------------------


def test_rechazar_no_mueve_caja(admin_client, posicion):
    solicitud = _solicitud(_empleado('Ana Ruiz', posicion))

    respuesta = admin_client.post(f'{URL}{solicitud.id}/rechazar/')

    assert respuesta.data['estado'] == 'rechazado'
    assert not MovimientoCaja.objects.exists()


def test_solo_se_borra_una_solicitud_pendiente(admin_client, posicion):
    pagada = _solicitud(_empleado('Ana Ruiz', posicion), estado='pagado')

    respuesta = admin_client.delete(f'{URL}{pagada.id}/')

    assert respuesta.status_code == 400
    assert SolicitudNomina.objects.filter(pk=pagada.pk).exists()


def test_filtra_por_periodo_traslapado(admin_client, posicion):
    empleado = _empleado('Ana Ruiz', posicion)
    marzo = _solicitud(empleado)
    _solicitud(empleado, inicio=date(2026, 4, 1), fin=date(2026, 4, 15))

    respuesta = admin_client.get(f'{URL}?periodo_inicio=2026-03-01&periodo_fin=2026-03-15')

    assert [fila['id'] for fila in respuesta.data] == [marzo.id]


@pytest.mark.parametrize('ruta,metodo', [
    ('generar/', 'post'), ('pagar-lote/', 'post'),
])
def test_operador_no_tiene_acceso(operador, ruta, metodo):
    respuesta = getattr(_cliente(operador), metodo)(f'{URL}{ruta}', {}, format='json')
    assert respuesta.status_code == 403


def test_operador_no_puede_revertir(operador, posicion):
    solicitud = _solicitud(_empleado('Ana Ruiz', posicion), estado='pagado')

    respuesta = _cliente(operador).post(f'{URL}{solicitud.id}/revertir/', {'motivo': 'x'}, format='json')

    assert respuesta.status_code == 403


def test_la_cuenta_de_sueldos_existe_y_es_de_sistema(db):
    from apps.contabilidad.constants import CODIGO_SUELDOS, CODIGOS_CUENTAS_SISTEMA

    cuenta = CuentaContable.objects.get(codigo=CODIGO_SUELDOS)
    assert cuenta.nombre == 'Sueldos y salarios'
    assert cuenta.tipo == 'egreso'
    assert cuenta.cuenta_padre.codigo == '5000'
    assert CODIGO_SUELDOS in CODIGOS_CUENTAS_SISTEMA
    assert AsientoContable.objects.count() == 0
