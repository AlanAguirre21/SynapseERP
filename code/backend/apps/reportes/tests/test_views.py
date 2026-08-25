from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.compras.models import Compra
from apps.personas.models import Proveedor
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta


@pytest.fixture
def usuario(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123',
    )


@pytest.fixture
def api_client(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


@pytest.fixture
def proveedor(db):
    return Proveedor.objects.create(nombre_proveedor='Distribuidora Médica')


def _crear_venta(sucursal, usuario, total, estado=Venta.ESTADO_ENTREGADA, fecha=None):
    venta = Venta.objects.create(sucursal=sucursal, usuario=usuario, total=total, estado=estado)
    if fecha is not None:
        Venta.objects.filter(pk=venta.pk).update(fecha=fecha)
    return venta


def _crear_compra(sucursal, proveedor, usuario, total, estado=Compra.ESTADO_RECIBIDA, fecha=None):
    compra = Compra.objects.create(sucursal=sucursal, proveedor=proveedor, usuario=usuario, total=total, estado=estado)
    if fecha is not None:
        Compra.objects.filter(pk=compra.pk).update(fecha=fecha)
    return compra


@pytest.mark.django_db
def test_requiere_autenticacion():
    client = APIClient()
    response = client.get('/api/reportes/resumen/', {'periodo': 'dia'})
    assert response.status_code == 401


@pytest.mark.django_db
def test_cualquier_usuario_autenticado_puede_ver_el_resumen(api_client):
    response = api_client.get('/api/reportes/resumen/', {'periodo': 'dia'})
    assert response.status_code == 200


@pytest.mark.django_db
def test_periodo_invalido_es_rechazado(api_client):
    response = api_client.get('/api/reportes/resumen/', {'periodo': 'año'})
    assert response.status_code == 400
    assert 'periodo' in response.data


@pytest.mark.django_db
def test_periodo_por_defecto_es_dia(api_client):
    response = api_client.get('/api/reportes/resumen/')
    assert response.status_code == 200
    assert response.data['periodo'] == 'dia'


@pytest.mark.django_db
def test_sin_movimientos_devuelve_ceros(api_client):
    response = api_client.get('/api/reportes/resumen/', {'periodo': 'mes'})
    assert response.status_code == 200
    assert response.data['ventas_total'] == '0.00'
    assert response.data['compras_total'] == '0.00'
    assert response.data['ganancia'] == '0.00'
    assert len(response.data['serie']) > 0  # la serie sigue trayendo los buckets del periodo, en 0


@pytest.mark.django_db
def test_ganancia_es_ventas_menos_compras_del_periodo(api_client, sucursal, proveedor, usuario):
    _crear_venta(sucursal, usuario, Decimal('300.00'))
    _crear_compra(sucursal, proveedor, usuario, Decimal('120.00'))

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'mes'})

    assert response.data['ventas_total'] == '300.00'
    assert response.data['compras_total'] == '120.00'
    assert response.data['ganancia'] == '180.00'


@pytest.mark.django_db
def test_venta_cancelada_no_cuenta(api_client, sucursal, usuario):
    _crear_venta(sucursal, usuario, Decimal('300.00'), estado=Venta.ESTADO_CANCELADA)

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'mes'})
    assert response.data['ventas_total'] == '0.00'


@pytest.mark.django_db
def test_venta_pendiente_si_cuenta(api_client, sucursal, usuario):
    _crear_venta(sucursal, usuario, Decimal('50.00'), estado=Venta.ESTADO_PENDIENTE)

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'mes'})
    assert response.data['ventas_total'] == '50.00'


@pytest.mark.django_db
def test_compra_pendiente_no_cuenta_solo_recibida(api_client, sucursal, proveedor, usuario):
    _crear_compra(sucursal, proveedor, usuario, Decimal('80.00'), estado=Compra.ESTADO_PENDIENTE)
    _crear_compra(sucursal, proveedor, usuario, Decimal('40.00'), estado=Compra.ESTADO_RECIBIDA)

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'mes'})
    assert response.data['compras_total'] == '40.00'


@pytest.mark.django_db
def test_compra_cancelada_no_cuenta(api_client, sucursal, proveedor, usuario):
    _crear_compra(sucursal, proveedor, usuario, Decimal('80.00'), estado=Compra.ESTADO_CANCELADA)

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'mes'})
    assert response.data['compras_total'] == '0.00'


@pytest.mark.django_db
def test_movimiento_fuera_del_periodo_seleccionado_no_cuenta(api_client, sucursal, usuario):
    hace_dos_meses = timezone.now() - timedelta(days=60)
    _crear_venta(sucursal, usuario, Decimal('999.00'), fecha=hace_dos_meses)

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'mes'})
    assert response.data['ventas_total'] == '0.00'


@pytest.mark.django_db
def test_serie_agrupa_ventas_del_mismo_dia_para_periodo_semana(api_client, sucursal, usuario):
    ahora = timezone.localtime()
    _crear_venta(sucursal, usuario, Decimal('100.00'), fecha=ahora)
    _crear_venta(sucursal, usuario, Decimal('50.00'), fecha=ahora)

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'semana'})

    puntos_con_ganancia = [p for p in response.data['serie'] if Decimal(p['ganancia']) != 0]
    assert len(puntos_con_ganancia) == 1
    assert puntos_con_ganancia[0]['ganancia'] == '150.00'


@pytest.mark.django_db
def test_serie_para_periodo_dia_tiene_granularidad_horaria(api_client, sucursal, usuario):
    ahora = timezone.localtime()
    _crear_venta(sucursal, usuario, Decimal('100.00'), fecha=ahora)

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'dia'})

    # Un bucket por cada hora transcurrida hoy, no un único punto para todo el día.
    assert len(response.data['serie']) == ahora.hour + 1
