from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.caja.models import MovimientoCaja
from apps.catalogo.models import Categoria, Producto
from apps.inventario.models import InventarioSucursalProducto, MovimientoInventario
from apps.personas.models import Cliente
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
def cliente(db):
    return Cliente.objects.create(nombre_cliente='Hospital San Rafael')


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-VENTA-1', unidad_medida='pza',
        categoria=categoria, precio_venta='45.00',
    )


@pytest.fixture
def stock(sucursal, producto):
    return InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='100.00', stock_minimo='10.00',
    )


def _payload_venta(sucursal, producto, cantidad='10.00', cliente=None, fecha_entrega=None):
    payload = {
        'sucursal': sucursal.id,
        'detalles': [{'producto': producto.id, 'cantidad': cantidad}],
    }
    if cliente is not None:
        payload['cliente'] = cliente.id
    if fecha_entrega is not None:
        payload['fecha_entrega'] = fecha_entrega
    return payload


# --- Creación -------------------------------------------------------------


@pytest.mark.django_db
def test_crear_venta_con_stock_suficiente_descuenta_stock_y_registra_movimientos(
    api_client, sucursal, producto, stock, usuario,
):
    response = api_client.post('/api/ventas/', _payload_venta(sucursal, producto, cantidad='10.00'), format='json')

    assert response.status_code == 201
    assert response.data['total'] == '450.00'
    assert response.data['estado'] == 'entregada'

    stock.refresh_from_db()
    assert stock.stock_actual == Decimal('90.00')

    movimiento = MovimientoInventario.objects.get(referencia_id=response.data['id'], tipo_item='producto')
    assert movimiento.tipo_movimiento == 'salida'
    assert movimiento.motivo == 'venta'
    assert movimiento.cantidad == Decimal('10.00')
    assert movimiento.usuario == usuario

    movimiento_caja = MovimientoCaja.objects.get(referencia_id=response.data['id'])
    assert movimiento_caja.tipo_movimiento == 'ingreso'
    assert movimiento_caja.motivo == 'venta'
    assert movimiento_caja.monto == Decimal('450.00')


@pytest.mark.django_db
def test_crear_venta_sin_cliente(api_client, sucursal, producto, stock):
    response = api_client.post('/api/ventas/', _payload_venta(sucursal, producto), format='json')

    assert response.status_code == 201
    assert response.data['cliente'] is None
    assert response.data['cliente_nombre'] == 'Sin cliente'


@pytest.mark.django_db
def test_crear_venta_con_cliente(api_client, sucursal, producto, stock, cliente):
    response = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, cliente=cliente), format='json',
    )
    assert response.status_code == 201
    assert response.data['cliente'] == cliente.id
    assert response.data['cliente_nombre'] == 'Hospital San Rafael'


@pytest.mark.django_db
def test_crear_venta_rechaza_stock_insuficiente_y_no_deja_cambios_parciales(api_client, sucursal, producto, stock):
    response = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, cantidad='500.00'), format='json',
    )

    assert response.status_code == 400
    assert 'detalles' in response.data
    assert 'disponible' in str(response.data['detalles'])

    stock.refresh_from_db()
    assert stock.stock_actual == Decimal('100.00')
    assert not Venta.objects.exists()
    assert not MovimientoInventario.objects.exists()
    assert not MovimientoCaja.objects.exists()


@pytest.mark.django_db
def test_crear_venta_sin_registro_de_inventario_es_rechazada(api_client, sucursal, producto):
    # No existe fila de InventarioSucursalProducto para este producto/sucursal.
    response = api_client.post('/api/ventas/', _payload_venta(sucursal, producto, cantidad='1.00'), format='json')

    assert response.status_code == 400
    assert 'disponible: 0' in str(response.data['detalles'])


@pytest.mark.django_db
def test_precio_unitario_congelado_no_cambia_si_cambia_precio_venta_despues(api_client, sucursal, producto, stock):
    id_venta = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, cantidad='2.00'), format='json',
    ).data['id']

    producto.precio_venta = '999.00'
    producto.save(update_fields=['precio_venta'])

    response = api_client.get(f'/api/ventas/{id_venta}/')
    assert response.data['detalles'][0]['precio_unitario'] == '45.00'


@pytest.mark.django_db
def test_venta_sin_fecha_entrega_queda_entregada_de_inmediato(api_client, sucursal, producto, stock):
    response = api_client.post('/api/ventas/', _payload_venta(sucursal, producto), format='json')
    assert response.data['estado'] == 'entregada'
    assert response.data['fecha_entrega_real'] is None


@pytest.mark.django_db
def test_venta_con_fecha_entrega_queda_pendiente(api_client, sucursal, producto, stock):
    response = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, fecha_entrega='2026-09-01'), format='json',
    )
    assert response.data['estado'] == 'pendiente'
    assert response.data['fecha_entrega'] == '2026-09-01'


@pytest.mark.django_db
def test_crear_venta_requiere_autenticacion(sucursal, producto):
    client = APIClient()
    response = client.post('/api/ventas/', _payload_venta(sucursal, producto), format='json')
    assert response.status_code == 401


@pytest.mark.django_db
def test_crear_venta_sin_lineas_es_rechazada(api_client, sucursal):
    response = api_client.post('/api/ventas/', {'sucursal': sucursal.id, 'detalles': []}, format='json')
    assert response.status_code == 400


# --- Entrega --------------------------------------------------------------


@pytest.mark.django_db
def test_entregar_venta_pendiente_no_genera_movimientos_nuevos(api_client, sucursal, producto, stock):
    id_venta = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, fecha_entrega='2026-09-01'), format='json',
    ).data['id']

    response = api_client.post(f'/api/ventas/{id_venta}/entregar/')

    assert response.status_code == 200
    assert response.data['estado'] == 'entregada'
    assert response.data['fecha_entrega_real'] is not None
    assert MovimientoInventario.objects.filter(referencia_id=id_venta).count() == 1
    assert MovimientoCaja.objects.filter(referencia_id=id_venta).count() == 1


@pytest.mark.django_db
def test_entregar_venta_no_pendiente_es_rechazado(api_client, sucursal, producto, stock):
    id_venta = api_client.post('/api/ventas/', _payload_venta(sucursal, producto), format='json').data['id']

    response = api_client.post(f'/api/ventas/{id_venta}/entregar/')
    assert response.status_code == 400


# --- Cancelación --------------------------------------------------------


@pytest.mark.django_db
def test_cancelar_venta_entregada_revierte_stock_y_caja(api_client, sucursal, producto, stock):
    id_venta = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, cantidad='10.00'), format='json',
    ).data['id']

    response = api_client.post(f'/api/ventas/{id_venta}/cancelar/')

    assert response.status_code == 200
    assert response.data['estado'] == 'cancelada'

    stock.refresh_from_db()
    assert stock.stock_actual == Decimal('100.00')

    movimientos_inventario = MovimientoInventario.objects.filter(referencia_id=id_venta).order_by('id')
    assert movimientos_inventario.count() == 2
    salida, entrada = movimientos_inventario
    assert salida.tipo_movimiento == 'salida' and salida.motivo == 'venta'
    assert entrada.tipo_movimiento == 'entrada' and entrada.motivo == 'ajuste'

    movimientos_caja = MovimientoCaja.objects.filter(referencia_id=id_venta).order_by('id')
    assert movimientos_caja.count() == 2
    ingreso, retiro = movimientos_caja
    assert ingreso.tipo_movimiento == 'ingreso' and ingreso.motivo == 'venta'
    assert retiro.tipo_movimiento == 'retiro' and retiro.motivo == 'ajuste'
    assert retiro.monto == ingreso.monto


@pytest.mark.django_db
def test_cancelar_venta_pendiente_tambien_revierte(api_client, sucursal, producto, stock):
    id_venta = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, fecha_entrega='2026-09-01'), format='json',
    ).data['id']

    response = api_client.post(f'/api/ventas/{id_venta}/cancelar/')

    assert response.status_code == 200
    stock.refresh_from_db()
    assert stock.stock_actual == Decimal('100.00')


@pytest.mark.django_db
def test_cancelar_venta_ya_cancelada_es_rechazado(api_client, sucursal, producto, stock):
    id_venta = api_client.post('/api/ventas/', _payload_venta(sucursal, producto), format='json').data['id']
    api_client.post(f'/api/ventas/{id_venta}/cancelar/')

    response = api_client.post(f'/api/ventas/{id_venta}/cancelar/')
    assert response.status_code == 400


# --- Ticket ------------------------------------------------------------


@pytest.mark.django_db
def test_ticket_devuelve_pdf(api_client, sucursal, producto, stock):
    id_venta = api_client.post('/api/ventas/', _payload_venta(sucursal, producto), format='json').data['id']

    response = api_client.get(f'/api/ventas/{id_venta}/ticket/')

    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
    assert response.content.startswith(b'%PDF')


# --- Listado / filtros / detalle ------------------------------------------


@pytest.mark.django_db
def test_lista_ventas_filtra_por_sucursal_estado_cliente_y_producto(api_client, sucursal, producto, stock, cliente):
    otra_sucursal = Sucursal.objects.create(nombre_sucursal='Sucursal Norte')
    InventarioSucursalProducto.objects.create(
        sucursal=otra_sucursal, producto=producto, stock_actual='50.00', stock_minimo='5.00',
    )

    id_venta_1 = api_client.post(
        '/api/ventas/', _payload_venta(sucursal, producto, cliente=cliente), format='json',
    ).data['id']
    api_client.post('/api/ventas/', _payload_venta(otra_sucursal, producto), format='json')

    respuesta_sucursal = api_client.get('/api/ventas/', {'sucursal': sucursal.id})
    assert len(respuesta_sucursal.data) == 1
    assert respuesta_sucursal.data[0]['id'] == id_venta_1

    respuesta_cliente = api_client.get('/api/ventas/', {'cliente': cliente.id})
    assert len(respuesta_cliente.data) == 1

    respuesta_producto = api_client.get('/api/ventas/', {'producto': producto.id})
    assert len(respuesta_producto.data) == 2

    respuesta_estado = api_client.get('/api/ventas/', {'estado': 'entregada'})
    assert len(respuesta_estado.data) == 2


@pytest.mark.django_db
def test_no_permite_editar_ni_borrar_una_venta(api_client, sucursal, producto, stock):
    id_venta = api_client.post('/api/ventas/', _payload_venta(sucursal, producto), format='json').data['id']

    assert api_client.put(f'/api/ventas/{id_venta}/', {}, format='json').status_code == 405
    assert api_client.patch(f'/api/ventas/{id_venta}/', {}, format='json').status_code == 405
    assert api_client.delete(f'/api/ventas/{id_venta}/').status_code == 405
