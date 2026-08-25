from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.compras.models import Compra
from apps.inventario.models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
)
from apps.personas.models import Proveedor
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario


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


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-COMPRA-1', unidad_medida='pza',
        categoria=categoria, precio_venta='45.00',
    )


@pytest.fixture
def materia_prima(categoria):
    return MateriaPrima.objects.create(
        nombre_item='Cloruro de sodio', unidad_medida='kg', categoria=categoria,
    )


def _payload_compra(proveedor, sucursal, producto=None, materia_prima=None):
    payload = {'proveedor': proveedor.id, 'sucursal': sucursal.id, 'detalles_producto': [], 'detalles_materia_prima': []}
    if producto is not None:
        payload['detalles_producto'].append({'producto': producto.id, 'cantidad': '10.00', 'costo_unitario': '5.50'})
    if materia_prima is not None:
        payload['detalles_materia_prima'].append(
            {'materia_prima': materia_prima.id, 'cantidad': '3.00', 'costo_unitario': '20.00'},
        )
    return payload


# --- Creación -------------------------------------------------------------


@pytest.mark.django_db
def test_crear_compra_con_multiples_lineas_calcula_total_en_backend(api_client, proveedor, sucursal, producto, materia_prima):
    payload = _payload_compra(proveedor, sucursal, producto=producto, materia_prima=materia_prima)

    response = api_client.post('/api/compras/', payload, format='json')

    assert response.status_code == 201
    # 10.00 * 5.50 = 55.00 ; 3.00 * 20.00 = 60.00 ; total = 115.00
    assert response.data['total'] == '115.00'
    assert response.data['estado'] == 'pendiente'
    assert response.data['usuario_nombre'] == 'operador1'


@pytest.mark.django_db
def test_crear_compra_ignora_total_enviado_por_el_cliente(api_client, proveedor, sucursal, producto):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    payload['total'] = '999999.99'

    response = api_client.post('/api/compras/', payload, format='json')

    assert response.status_code == 201
    assert response.data['total'] == '55.00'


@pytest.mark.django_db
def test_crear_compra_sin_lineas_es_rechazada(api_client, proveedor, sucursal):
    response = api_client.post(
        '/api/compras/',
        {'proveedor': proveedor.id, 'sucursal': sucursal.id},
        format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_crear_compra_requiere_autenticacion(proveedor, sucursal):
    client = APIClient()
    response = client.post('/api/compras/', _payload_compra(proveedor, sucursal), format='json')
    assert response.status_code == 401


@pytest.mark.django_db
def test_crear_compra_con_cantidad_negativa_es_rechazada(api_client, proveedor, sucursal, producto):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    payload['detalles_producto'][0]['cantidad'] = '-1.00'

    response = api_client.post('/api/compras/', payload, format='json')
    assert response.status_code == 400


# --- Recepción --------------------------------------------------------


@pytest.mark.django_db
def test_recibir_compra_aumenta_stock_y_registra_movimiento(api_client, proveedor, sucursal, producto, usuario):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']

    response = api_client.post(f'/api/compras/{id_compra}/recibir/')

    assert response.status_code == 200
    assert response.data['estado'] == 'recibida'

    inventario = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert inventario.stock_actual == Decimal('10.00')

    movimiento = MovimientoInventario.objects.get(referencia_id=id_compra, tipo_item='producto')
    assert movimiento.tipo_movimiento == 'entrada'
    assert movimiento.motivo == 'compra'
    assert movimiento.cantidad == Decimal('10.00')
    assert movimiento.stock_resultante == Decimal('10.00')
    assert movimiento.usuario == usuario


@pytest.mark.django_db
def test_recibir_compra_crea_registro_de_inventario_si_no_existia(api_client, proveedor, sucursal, materia_prima):
    assert not InventarioSucursalMateriaPrima.objects.filter(sucursal=sucursal, materia_prima=materia_prima).exists()

    payload = _payload_compra(proveedor, sucursal, materia_prima=materia_prima)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']
    api_client.post(f'/api/compras/{id_compra}/recibir/')

    inventario = InventarioSucursalMateriaPrima.objects.get(sucursal=sucursal, materia_prima=materia_prima)
    assert inventario.stock_actual == Decimal('3.00')


@pytest.mark.django_db
def test_recibir_compra_ya_recibida_es_rechazado(api_client, proveedor, sucursal, producto):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']
    api_client.post(f'/api/compras/{id_compra}/recibir/')

    response = api_client.post(f'/api/compras/{id_compra}/recibir/')

    assert response.status_code == 400
    inventario = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert inventario.stock_actual == Decimal('10.00')  # no se duplicó la entrada


@pytest.mark.django_db
def test_recibir_compra_acumula_stock_existente(api_client, proveedor, sucursal, producto):
    InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='5.00', stock_minimo='2.00',
    )
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']

    api_client.post(f'/api/compras/{id_compra}/recibir/')

    inventario = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert inventario.stock_actual == Decimal('15.00')


# --- Cancelación --------------------------------------------------------


@pytest.mark.django_db
def test_cancelar_compra_pendiente_no_genera_movimientos(api_client, proveedor, sucursal, producto):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']

    response = api_client.post(f'/api/compras/{id_compra}/cancelar/')

    assert response.status_code == 200
    assert response.data['estado'] == 'cancelada'
    assert not MovimientoInventario.objects.filter(referencia_id=id_compra).exists()
    assert not InventarioSucursalProducto.objects.filter(sucursal=sucursal, producto=producto).exists()


@pytest.mark.django_db
def test_cancelar_compra_recibida_genera_movimiento_inverso_y_no_edita_el_original(
    api_client, proveedor, sucursal, producto,
):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']
    api_client.post(f'/api/compras/{id_compra}/recibir/')

    response = api_client.post(f'/api/compras/{id_compra}/cancelar/')

    assert response.status_code == 200
    assert response.data['estado'] == 'cancelada'

    inventario = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert inventario.stock_actual == Decimal('0.00')

    movimientos = MovimientoInventario.objects.filter(referencia_id=id_compra).order_by('id')
    assert movimientos.count() == 2
    entrada, salida = movimientos
    assert entrada.tipo_movimiento == 'entrada' and entrada.cantidad == Decimal('10.00')
    assert salida.tipo_movimiento == 'salida' and salida.motivo == 'ajuste' and salida.cantidad == Decimal('10.00')


@pytest.mark.django_db
def test_cancelar_compra_recibida_sin_stock_suficiente_es_bloqueado(api_client, proveedor, sucursal, materia_prima):
    payload = _payload_compra(proveedor, sucursal, materia_prima=materia_prima)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']
    api_client.post(f'/api/compras/{id_compra}/recibir/')

    # Simula que la materia prima ya se consumió (ej. en una producción posterior).
    inventario = InventarioSucursalMateriaPrima.objects.get(sucursal=sucursal, materia_prima=materia_prima)
    inventario.stock_actual = Decimal('1.00')
    inventario.save(update_fields=['stock_actual'])

    response = api_client.post(f'/api/compras/{id_compra}/cancelar/')

    assert response.status_code == 400
    compra = Compra.objects.get(id=id_compra)
    assert compra.estado == 'recibida'  # no quedó cancelada a medias
    inventario.refresh_from_db()
    assert inventario.stock_actual == Decimal('1.00')  # no se tocó el stock
    assert MovimientoInventario.objects.filter(referencia_id=id_compra).count() == 1  # solo la entrada original


@pytest.mark.django_db
def test_cancelar_compra_ya_cancelada_es_rechazado(api_client, proveedor, sucursal, producto):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']
    api_client.post(f'/api/compras/{id_compra}/cancelar/')

    response = api_client.post(f'/api/compras/{id_compra}/cancelar/')
    assert response.status_code == 400


# --- Listado / filtros / detalle ------------------------------------------


@pytest.mark.django_db
def test_lista_compras_filtra_por_proveedor_y_estado(api_client, proveedor, sucursal, producto):
    otro_proveedor = Proveedor.objects.create(nombre_proveedor='Insumos SA')

    id_compra_1 = api_client.post(
        '/api/compras/', _payload_compra(proveedor, sucursal, producto=producto), format='json',
    ).data['id']
    api_client.post('/api/compras/', _payload_compra(otro_proveedor, sucursal, producto=producto), format='json')
    api_client.post(f'/api/compras/{id_compra_1}/recibir/')

    response_por_proveedor = api_client.get('/api/compras/', {'proveedor': proveedor.id})
    assert len(response_por_proveedor.data) == 1
    assert response_por_proveedor.data[0]['id'] == id_compra_1

    response_por_estado = api_client.get('/api/compras/', {'estado': 'recibida'})
    assert len(response_por_estado.data) == 1
    assert response_por_estado.data[0]['id'] == id_compra_1


@pytest.mark.django_db
def test_detalle_compra_incluye_lineas_proveedor_sucursal_total_y_estado(api_client, proveedor, sucursal, producto, materia_prima):
    payload = _payload_compra(proveedor, sucursal, producto=producto, materia_prima=materia_prima)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']

    response = api_client.get(f'/api/compras/{id_compra}/')

    assert response.status_code == 200
    assert response.data['proveedor_nombre'] == 'Distribuidora Médica'
    assert response.data['sucursal_nombre'] == 'Matriz'
    assert response.data['total'] == '115.00'
    assert response.data['estado'] == 'pendiente'
    assert len(response.data['detalles_producto']) == 1
    assert len(response.data['detalles_materia_prima']) == 1


@pytest.mark.django_db
def test_costo_unitario_congelado_no_cambia_si_cambia_costo_promedio_despues(api_client, proveedor, sucursal, materia_prima):
    payload = _payload_compra(proveedor, sucursal, materia_prima=materia_prima)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']

    materia_prima.costo_promedio = '999.00'
    materia_prima.save(update_fields=['costo_promedio'])

    response = api_client.get(f'/api/compras/{id_compra}/')
    assert response.data['detalles_materia_prima'][0]['costo_unitario'] == '20.00'


@pytest.mark.django_db
def test_no_permite_editar_ni_borrar_una_compra(api_client, proveedor, sucursal, producto):
    payload = _payload_compra(proveedor, sucursal, producto=producto)
    id_compra = api_client.post('/api/compras/', payload, format='json').data['id']

    assert api_client.put(f'/api/compras/{id_compra}/', {}, format='json').status_code == 405
    assert api_client.patch(f'/api/compras/{id_compra}/', {}, format='json').status_code == 405
    assert api_client.delete(f'/api/compras/{id_compra}/').status_code == 405
