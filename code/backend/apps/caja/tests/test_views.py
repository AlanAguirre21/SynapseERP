from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.caja.models import MovimientoCaja
from apps.caja.services import registrar_movimiento_caja
from apps.usuarios.models import Usuario


@pytest.fixture
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123', rol_usuario='admin',
    )


@pytest.fixture
def operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123', rol_usuario='operador',
    )


@pytest.fixture
def admin_client(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def operador_client(operador):
    client = APIClient()
    client.force_authenticate(user=operador)
    return client


def _payload_manual(tipo_movimiento='ingreso', monto='100.00', observacion='Aportación de capital'):
    return {'tipo_movimiento': tipo_movimiento, 'monto': monto, 'observacion': observacion}


# --- Permisos: Caja es exclusiva de admin, incluida la lectura -----------


@pytest.mark.django_db
def test_operador_no_puede_listar_movimientos(operador_client):
    response = operador_client.get('/api/caja/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_operador_no_puede_registrar_movimiento_manual(operador_client):
    response = operador_client.post('/api/caja/', _payload_manual(), format='json')
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_puede_listar_movimientos(admin_client):
    response = admin_client.get('/api/caja/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_caja_requiere_autenticacion():
    client = APIClient()
    response = client.get('/api/caja/')
    assert response.status_code == 401


# --- Registro manual --------------------------------------------------


@pytest.mark.django_db
def test_admin_registra_ingreso_manual(admin_client):
    response = admin_client.post('/api/caja/', _payload_manual(tipo_movimiento='ingreso', monto='250.00'), format='json')

    assert response.status_code == 201
    assert response.data['motivo'] == 'manual'
    assert response.data['saldo_resultante'] == '250.00'
    assert response.data['referencia_id'] is None


@pytest.mark.django_db
def test_admin_registra_retiro_manual(admin_client):
    admin_client.post('/api/caja/', _payload_manual(tipo_movimiento='ingreso', monto='250.00'), format='json')

    response = admin_client.post(
        '/api/caja/', _payload_manual(tipo_movimiento='retiro', monto='100.00', observacion='Pago de renta'),
        format='json',
    )

    assert response.status_code == 201
    assert response.data['saldo_resultante'] == '150.00'


@pytest.mark.django_db
def test_no_se_puede_elegir_motivo_ni_usuario_en_creacion_manual(admin_client, admin):
    response = admin_client.post(
        '/api/caja/',
        {'tipo_movimiento': 'ingreso', 'monto': '10.00', 'observacion': 'x', 'motivo': 'venta', 'usuario': admin.id + 1},
        format='json',
    )
    assert response.status_code == 201
    assert response.data['motivo'] == 'manual'
    assert response.data['usuario'] == admin.id


@pytest.mark.django_db
def test_movimiento_manual_requiere_descripcion(admin_client):
    response = admin_client.post(
        '/api/caja/', {'tipo_movimiento': 'ingreso', 'monto': '10.00', 'observacion': ''}, format='json',
    )
    assert response.status_code == 400
    assert 'observacion' in response.data


@pytest.mark.django_db
def test_movimiento_manual_rechaza_monto_negativo_o_cero(admin_client):
    response = admin_client.post('/api/caja/', _payload_manual(monto='0.00'), format='json')
    assert response.status_code == 400
    assert 'monto' in response.data


@pytest.mark.django_db
def test_retiro_manual_que_dejaria_saldo_negativo_es_rechazado(admin_client):
    admin_client.post('/api/caja/', _payload_manual(tipo_movimiento='ingreso', monto='50.00'), format='json')

    response = admin_client.post(
        '/api/caja/', _payload_manual(tipo_movimiento='retiro', monto='50.01'), format='json',
    )

    assert response.status_code == 400
    assert MovimientoCaja.objects.filter(tipo_movimiento='retiro').count() == 0


# --- Solo lectura / ausencia de rutas de edición --------------------------


@pytest.mark.django_db
def test_no_permite_editar_ni_borrar_un_movimiento(admin_client, admin):
    movimiento = registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('10.00'), motivo=MovimientoCaja.MOTIVO_MANUAL,
        referencia_id=None, usuario=admin, observacion='x',
    )

    assert admin_client.put(f'/api/caja/{movimiento.id}/', {}, format='json').status_code == 405
    assert admin_client.patch(f'/api/caja/{movimiento.id}/', {}, format='json').status_code == 405
    assert admin_client.delete(f'/api/caja/{movimiento.id}/').status_code == 405


# --- Filtros y saldo --------------------------------------------------


@pytest.mark.django_db
def test_lista_filtra_por_tipo_movimiento_y_motivo(admin_client, admin):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('100.00'), motivo=MovimientoCaja.MOTIVO_VENTA,
        referencia_id=1, usuario=admin,
    )
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('50.00'), motivo=MovimientoCaja.MOTIVO_MANUAL,
        referencia_id=None, usuario=admin, observacion='Aportación',
    )

    response = admin_client.get('/api/caja/', {'motivo': 'venta'})
    assert len(response.data) == 1
    assert response.data[0]['motivo'] == 'venta'

    response = admin_client.get('/api/caja/', {'tipo_movimiento': 'ingreso'})
    assert len(response.data) == 2


@pytest.mark.django_db
def test_endpoint_saldo_refleja_ultimo_movimiento_pese_a_filtros(admin_client, admin):
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.INGRESO, monto=Decimal('300.00'), motivo=MovimientoCaja.MOTIVO_VENTA,
        referencia_id=1, usuario=admin,
    )
    registrar_movimiento_caja(
        tipo_movimiento=MovimientoCaja.RETIRO, monto=Decimal('100.00'), motivo=MovimientoCaja.MOTIVO_MANUAL,
        referencia_id=None, usuario=admin, observacion='Retiro',
    )

    response = admin_client.get('/api/caja/saldo/')
    assert response.status_code == 200
    assert response.data['saldo_actual'] == '200.00'
