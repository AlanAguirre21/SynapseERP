from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.inventario.models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
)
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario


@pytest.fixture
def usuario(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123'
    )


@pytest.fixture
def api_client(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123', rol_usuario='admin',
    )


@pytest.fixture
def admin_client(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


@pytest.fixture
def otra_sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Sucursal Norte')


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-STOCK-1', unidad_medida='pza',
        categoria=categoria, precio_venta='10.00',
    )


@pytest.fixture
def materia_prima(categoria):
    return MateriaPrima.objects.create(
        nombre_item='Cloruro de sodio', unidad_medida='kg', categoria=categoria,
    )


@pytest.mark.django_db
def test_alertas_vacio_sin_stock_bajo(api_client, sucursal):
    categoria = Categoria.objects.create(nombre_categoria='General', tipo='ambos')
    producto = Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-1', unidad_medida='pza',
        categoria=categoria, precio_venta='10.00',
    )
    InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='50.00', stock_minimo='10.00',
    )

    response = api_client.get('/api/inventario/alertas/')

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_alertas_incluye_producto_y_materia_prima_bajo_minimo(api_client, sucursal):
    categoria = Categoria.objects.create(nombre_categoria='General', tipo='ambos')
    producto = Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-2', unidad_medida='pza',
        categoria=categoria, precio_venta='10.00',
    )
    materia_prima = MateriaPrima.objects.create(
        nombre_item='Cloruro de sodio', unidad_medida='kg', categoria=categoria,
    )

    InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='2.00', stock_minimo='10.00',
    )
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=sucursal, materia_prima=materia_prima, stock_actual='1.00', stock_minimo='5.00',
    )

    response = api_client.get('/api/inventario/alertas/')

    assert response.status_code == 200
    tipos = {alerta['tipo'] for alerta in response.data}
    nombres = {alerta['nombre'] for alerta in response.data}
    assert tipos == {'producto', 'materia_prima'}
    assert nombres == {'Suero fisiológico', 'Cloruro de sodio'}
    for alerta in response.data:
        assert alerta['sucursal'] == 'Matriz'


@pytest.mark.django_db
def test_alertas_requiere_autenticacion(sucursal):
    client = APIClient()
    response = client.get('/api/inventario/alertas/')
    assert response.status_code == 401


# --- Stock ------------------------------------------------------------


@pytest.mark.django_db
def test_stock_productos_incluye_item_sin_registro_de_inventario(api_client, sucursal, producto):
    """`producto` nunca se compró en `sucursal` — no existe fila de
    `InventarioSucursalProducto` — pero igual debe aparecer con stock 0,
    no omitirse ni dar error (criterio de aceptación de spec.md).
    """
    response = api_client.get('/api/inventario/stock/', {'tipo': 'producto', 'sucursal': sucursal.id})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['nombre'] == 'Suero fisiológico'
    assert response.data[0]['stock_actual'] == '0.00'
    assert response.data[0]['stock_minimo'] == '0.00'
    assert response.data[0]['stock_bajo'] is False


@pytest.mark.django_db
def test_stock_productos_marca_stock_bajo(api_client, sucursal, producto):
    InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='2.00', stock_minimo='10.00',
    )

    response = api_client.get('/api/inventario/stock/', {'tipo': 'producto', 'sucursal': sucursal.id})

    assert response.status_code == 200
    assert response.data[0]['stock_actual'] == '2.00'
    assert response.data[0]['stock_bajo'] is True


@pytest.mark.django_db
def test_stock_no_incluye_productos_inactivos(api_client, sucursal, producto):
    producto.activo = False
    producto.save(update_fields=['activo'])

    response = api_client.get('/api/inventario/stock/', {'tipo': 'producto', 'sucursal': sucursal.id})

    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_stock_materia_prima(api_client, sucursal, materia_prima):
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=sucursal, materia_prima=materia_prima, stock_actual='50.00', stock_minimo='5.00',
    )

    response = api_client.get('/api/inventario/stock/', {'tipo': 'materia_prima', 'sucursal': sucursal.id})

    assert response.status_code == 200
    assert response.data[0]['nombre'] == 'Cloruro de sodio'
    assert response.data[0]['stock_bajo'] is False


@pytest.mark.django_db
def test_stock_requiere_tipo_valido(api_client, sucursal):
    response = api_client.get('/api/inventario/stock/', {'tipo': 'invalido', 'sucursal': sucursal.id})
    assert response.status_code == 400
    assert 'tipo' in response.data


@pytest.mark.django_db
def test_stock_requiere_sucursal(api_client):
    response = api_client.get('/api/inventario/stock/', {'tipo': 'producto'})
    assert response.status_code == 400
    assert 'sucursal' in response.data


@pytest.mark.django_db
def test_stock_requiere_autenticacion(sucursal):
    client = APIClient()
    response = client.get('/api/inventario/stock/', {'tipo': 'producto', 'sucursal': sucursal.id})
    assert response.status_code == 401


@pytest.mark.django_db
def test_stock_operador_no_puede_escribir(api_client, sucursal):
    """Un operador ni siquiera llega a "método no permitido": el permiso de
    escritura (solo admin) se evalúa antes de resolver el verbo HTTP."""
    response = api_client.post('/api/inventario/stock/', {'tipo': 'producto', 'sucursal': sucursal.id})
    assert response.status_code == 403


@pytest.mark.django_db
def test_stock_admin_no_tiene_verbo_post(admin_client, sucursal):
    """Un admin sí tiene permiso de escritura, pero `POST` no existe como
    acción en este endpoint — solo `GET` y `PATCH` (edición de
    `stock_minimo`)."""
    response = admin_client.post('/api/inventario/stock/', {'tipo': 'producto', 'sucursal': sucursal.id})
    assert response.status_code == 405


# --- Edición de stock_minimo (admin) ------------------------------------


@pytest.mark.django_db
def test_admin_edita_stock_minimo_con_registro_existente(admin_client, sucursal, producto):
    InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='5.00', stock_minimo='1.00',
    )

    response = admin_client.patch(
        '/api/inventario/stock/',
        {'tipo': 'producto', 'sucursal': sucursal.id, 'item_id': producto.id, 'stock_minimo': '8'},
        format='json',
    )

    assert response.status_code == 200
    assert response.data['stock_minimo'] == '8.00'
    inventario = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert inventario.stock_minimo == Decimal('8.00')
    assert inventario.stock_actual == Decimal('5.00')


@pytest.mark.django_db
def test_admin_edita_stock_minimo_sin_registro_previo(admin_client, sucursal, materia_prima):
    """La sucursal aún no compró esta materia prima — no existe fila de
    inventario — pero el admin puede fijar `stock_minimo` igual: se crea el
    registro con `stock_actual=0` en vez de fallar."""
    assert not InventarioSucursalMateriaPrima.objects.filter(sucursal=sucursal, materia_prima=materia_prima).exists()

    response = admin_client.patch(
        '/api/inventario/stock/',
        {'tipo': 'materia_prima', 'sucursal': sucursal.id, 'item_id': materia_prima.id, 'stock_minimo': '3'},
        format='json',
    )

    assert response.status_code == 200
    assert response.data['stock_minimo'] == '3.00'
    assert response.data['stock_actual'] == '0.00'
    inventario = InventarioSucursalMateriaPrima.objects.get(sucursal=sucursal, materia_prima=materia_prima)
    assert inventario.stock_minimo == Decimal('3.00')
    assert inventario.stock_actual == Decimal('0.00')


@pytest.mark.django_db
def test_operador_no_puede_editar_stock_minimo(api_client, sucursal, producto):
    InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='5.00', stock_minimo='1.00',
    )

    response = api_client.patch(
        '/api/inventario/stock/',
        {'tipo': 'producto', 'sucursal': sucursal.id, 'item_id': producto.id, 'stock_minimo': '8'},
        format='json',
    )

    assert response.status_code == 403
    inventario = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert inventario.stock_minimo == Decimal('1.00')


@pytest.mark.django_db
def test_editar_stock_minimo_rechaza_valor_negativo(admin_client, sucursal, producto):
    response = admin_client.patch(
        '/api/inventario/stock/',
        {'tipo': 'producto', 'sucursal': sucursal.id, 'item_id': producto.id, 'stock_minimo': '-1'},
        format='json',
    )

    assert response.status_code == 400
    assert 'stock_minimo' in response.data


@pytest.mark.django_db
def test_editar_stock_minimo_rechaza_valor_no_entero(admin_client, sucursal, producto):
    response = admin_client.patch(
        '/api/inventario/stock/',
        {'tipo': 'producto', 'sucursal': sucursal.id, 'item_id': producto.id, 'stock_minimo': '2.50'},
        format='json',
    )

    assert response.status_code == 400
    assert 'stock_minimo' in response.data


@pytest.mark.django_db
def test_editar_stock_minimo_no_genera_movimiento_ni_toca_stock_actual(admin_client, sucursal, producto):
    InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='12.00', stock_minimo='1.00',
    )

    response = admin_client.patch(
        '/api/inventario/stock/',
        {'tipo': 'producto', 'sucursal': sucursal.id, 'item_id': producto.id, 'stock_minimo': '4'},
        format='json',
    )

    assert response.status_code == 200
    assert not MovimientoInventario.objects.exists()
    inventario = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert inventario.stock_actual == Decimal('12.00')


@pytest.mark.django_db
def test_admin_tambien_puede_consultar_stock(admin_client, sucursal, producto):
    """`GET` sigue abierto a cualquier autenticado, no solo a admin."""
    response = admin_client.get('/api/inventario/stock/', {'tipo': 'producto', 'sucursal': sucursal.id})
    assert response.status_code == 200


# --- Movimientos --------------------------------------------------------


@pytest.fixture
def movimiento_entrada(sucursal, producto, usuario):
    return MovimientoInventario.objects.create(
        sucursal=sucursal, tipo_item='producto', item_id=producto.id, tipo_movimiento='entrada',
        cantidad='20.00', motivo='compra', stock_resultante='20.00', usuario=usuario,
    )


@pytest.fixture
def movimiento_salida(sucursal, materia_prima, usuario):
    return MovimientoInventario.objects.create(
        sucursal=sucursal, tipo_item='materia_prima', item_id=materia_prima.id, tipo_movimiento='salida',
        cantidad='3.00', motivo='produccion', stock_resultante='7.00', usuario=usuario,
    )


@pytest.mark.django_db
def test_lista_movimientos_incluye_nombre_de_item_y_usuario(api_client, movimiento_entrada):
    response = api_client.get('/api/inventario/movimientos/')

    assert response.status_code == 200
    assert len(response.data) == 1
    fila = response.data[0]
    assert fila['item_nombre'] == 'Suero fisiológico'
    assert fila['sucursal_nombre'] == 'Matriz'
    assert fila['usuario_nombre'] == 'operador1'
    assert fila['tipo_movimiento'] == 'entrada'
    assert fila['motivo'] == 'compra'


@pytest.mark.django_db
def test_filtra_movimientos_por_sucursal(api_client, movimiento_entrada, movimiento_salida, otra_sucursal, usuario):
    MovimientoInventario.objects.create(
        sucursal=otra_sucursal, tipo_item='producto', item_id=movimiento_entrada.item_id,
        tipo_movimiento='entrada', cantidad='5.00', motivo='compra', stock_resultante='5.00', usuario=usuario,
    )

    response = api_client.get('/api/inventario/movimientos/', {'sucursal': otra_sucursal.id})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['sucursal_nombre'] == 'Sucursal Norte'


@pytest.mark.django_db
def test_filtra_movimientos_por_tipo_item(api_client, movimiento_entrada, movimiento_salida):
    response = api_client.get('/api/inventario/movimientos/', {'tipo_item': 'materia_prima'})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['tipo_item'] == 'materia_prima'


@pytest.mark.django_db
def test_filtra_movimientos_por_tipo_movimiento(api_client, movimiento_entrada, movimiento_salida):
    response = api_client.get('/api/inventario/movimientos/', {'tipo_movimiento': 'salida'})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['tipo_movimiento'] == 'salida'


@pytest.mark.django_db
def test_filtra_movimientos_por_item_id(api_client, movimiento_entrada, movimiento_salida):
    response = api_client.get('/api/inventario/movimientos/', {'item_id': movimiento_entrada.item_id})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['item_id'] == movimiento_entrada.item_id


@pytest.mark.django_db
def test_movimientos_requiere_autenticacion(movimiento_entrada):
    client = APIClient()
    response = client.get('/api/inventario/movimientos/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_movimientos_no_permite_creacion(api_client, sucursal, producto):
    response = api_client.post(
        '/api/inventario/movimientos/',
        {
            'sucursal': sucursal.id, 'tipo_item': 'producto', 'item_id': producto.id,
            'tipo_movimiento': 'entrada', 'cantidad': '10.00', 'motivo': 'ajuste', 'stock_resultante': '10.00',
        },
        format='json',
    )
    assert response.status_code == 405


@pytest.mark.django_db
def test_movimientos_no_permite_edicion_ni_borrado(api_client, movimiento_entrada):
    response_put = api_client.put(f'/api/inventario/movimientos/{movimiento_entrada.id}/', {}, format='json')
    response_delete = api_client.delete(f'/api/inventario/movimientos/{movimiento_entrada.id}/')

    assert response_put.status_code == 405
    assert response_delete.status_code == 405
