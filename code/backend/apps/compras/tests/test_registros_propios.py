"""`012`, "Actualización: el operador solo ve sus propias compras"."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.compras.models import Compra
from apps.sucursales.models import Sucursal
from apps.terceros.models import Proveedor
from apps.usuarios.models import Usuario

URL = '/api/compras/'


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
    proveedor = Proveedor.objects.create(nombre_proveedor='Distribuidora Médica')
    ana = _usuario('ana')
    luis = _usuario('luis')
    admin = _usuario('admin1', rol='admin')
    propia = Compra.objects.create(proveedor=proveedor, sucursal=sucursal, usuario=ana, total=Decimal('100.00'))
    ajena = Compra.objects.create(proveedor=proveedor, sucursal=sucursal, usuario=luis, total=Decimal('200.00'))
    return {'ana': ana, 'luis': luis, 'admin': admin, 'propia': propia, 'ajena': ajena}


def test_el_operador_solo_lista_sus_compras(datos):
    respuesta = _cliente_api(datos['ana']).get(URL)

    assert [fila['id'] for fila in respuesta.data] == [datos['propia'].id]


def test_una_compra_ajena_responde_404(datos):
    cliente = _cliente_api(datos['ana'])

    assert cliente.get(f'{URL}{datos["propia"].id}/').status_code == 200
    assert cliente.get(f'{URL}{datos["ajena"].id}/').status_code == 404


@pytest.mark.parametrize('accion', ['recibir', 'cancelar'])
def test_el_operador_no_puede_operar_una_compra_ajena(datos, accion):
    respuesta = _cliente_api(datos['ana']).post(f'{URL}{datos["ajena"].id}/{accion}/')

    assert respuesta.status_code == 404
    datos['ajena'].refresh_from_db()
    assert datos['ajena'].estado == Compra.ESTADO_PENDIENTE


def test_el_filtro_usuario_se_ignora_para_el_operador(datos):
    respuesta = _cliente_api(datos['ana']).get(URL, {'usuario': datos['luis'].id})

    assert [fila['id'] for fila in respuesta.data] == [datos['propia'].id]


def test_el_admin_ve_todas_y_puede_filtrar_por_usuario(datos):
    cliente = _cliente_api(datos['admin'])

    assert {fila['id'] for fila in cliente.get(URL).data} == {datos['propia'].id, datos['ajena'].id}
    assert [fila['id'] for fila in cliente.get(URL, {'usuario': datos['ana'].id}).data] == [datos['propia'].id]
