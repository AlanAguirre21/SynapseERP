"""`013`, "Actualización: el operador solo ve sus propias ventas"."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta

URL = '/api/ventas/'


def _usuario(nombre, rol='operador'):
    return Usuario.objects.create_user(
        username=nombre, email=f'{nombre}@flebosil.test', password='clave-segura-123', rol_usuario=rol,
    )


def _cliente_api(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def datos(db):
    sucursal = Sucursal.objects.create(nombre_sucursal='Matriz')
    ana = _usuario('ana')
    luis = _usuario('luis')
    admin = _usuario('admin1', rol='admin')
    propia = Venta.objects.create(sucursal=sucursal, usuario=ana, total=Decimal('100.00'))
    ajena = Venta.objects.create(sucursal=sucursal, usuario=luis, total=Decimal('200.00'))
    return {'ana': ana, 'luis': luis, 'admin': admin, 'propia': propia, 'ajena': ajena}


def test_el_operador_solo_lista_sus_ventas(datos):
    respuesta = _cliente_api(datos['ana']).get(URL)

    assert [fila['id'] for fila in respuesta.data] == [datos['propia'].id]


def test_el_operador_abre_la_suya_y_una_ajena_responde_404(datos):
    cliente = _cliente_api(datos['ana'])

    assert cliente.get(f'{URL}{datos["propia"].id}/').status_code == 200
    assert cliente.get(f'{URL}{datos["ajena"].id}/').status_code == 404


@pytest.mark.parametrize('accion', ['entregar', 'cancelar'])
def test_el_operador_no_puede_operar_una_venta_ajena(datos, accion):
    estado_antes = datos['ajena'].estado

    respuesta = _cliente_api(datos['ana']).post(f'{URL}{datos["ajena"].id}/{accion}/')

    assert respuesta.status_code == 404
    datos['ajena'].refresh_from_db()
    assert datos['ajena'].estado == estado_antes


def test_el_operador_no_puede_ver_el_ticket_de_una_ajena(datos):
    assert _cliente_api(datos['ana']).get(f'{URL}{datos["ajena"].id}/ticket/').status_code == 404


def test_el_filtro_usuario_se_ignora_para_el_operador(datos):
    respuesta = _cliente_api(datos['ana']).get(URL, {'usuario': datos['luis'].id})

    assert [fila['id'] for fila in respuesta.data] == [datos['propia'].id]


def test_el_admin_ve_todas_y_puede_filtrar_por_usuario(datos):
    cliente = _cliente_api(datos['admin'])

    todas = cliente.get(URL)
    de_luis = cliente.get(URL, {'usuario': datos['luis'].id})

    assert {fila['id'] for fila in todas.data} == {datos['propia'].id, datos['ajena'].id}
    assert [fila['id'] for fila in de_luis.data] == [datos['ajena'].id]
    assert de_luis.data[0]['usuario_nombre'] == 'luis'
