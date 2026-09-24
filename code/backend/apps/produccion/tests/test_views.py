from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.inventario.models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
)
from apps.produccion.models import DetalleProduccion, Produccion, Receta
from apps.sucursales.models import Sucursal
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


@pytest.fixture
def sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-PROD-1', unidad_medida='pza',
        categoria=categoria, precio_venta='45.00',
    )


@pytest.fixture
def cloruro(categoria):
    return MateriaPrima.objects.create(
        nombre_item='Cloruro de sodio', unidad_medida='kg', categoria=categoria, costo_promedio='10.00',
    )


@pytest.fixture
def agua(categoria):
    return MateriaPrima.objects.create(
        nombre_item='Agua destilada', unidad_medida='L', categoria=categoria, costo_promedio='2.00',
    )


@pytest.fixture
def receta(producto, cloruro, agua):
    Receta.objects.create(producto=producto, materia_prima=cloruro, cantidad_requerida='0.50')
    Receta.objects.create(producto=producto, materia_prima=agua, cantidad_requerida='1.00')


@pytest.fixture
def stock_materia_prima(sucursal, cloruro, agua):
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=sucursal, materia_prima=cloruro, stock_actual='100.00', stock_minimo='5.00',
    )
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=sucursal, materia_prima=agua, stock_actual='100.00', stock_minimo='5.00',
    )


def _payload_produccion(producto, sucursal, cantidad='10'):
    return {'producto': producto.id, 'sucursal': sucursal.id, 'cantidad_producida': cantidad}


# --- Recetas --------------------------------------------------------------


@pytest.mark.django_db
def test_operador_puede_listar_recetas(operador_client, receta):
    response = operador_client.get('/api/produccion/recetas/')
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_operador_no_puede_crear_receta(operador_client, producto, cloruro):
    response = operador_client.post(
        '/api/produccion/recetas/',
        {'producto': producto.id, 'materia_prima': cloruro.id, 'cantidad_requerida': '0.50'},
        format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_puede_crear_receta(admin_client, producto, cloruro):
    response = admin_client.post(
        '/api/produccion/recetas/',
        {'producto': producto.id, 'materia_prima': cloruro.id, 'cantidad_requerida': '0.50'},
        format='json',
    )
    assert response.status_code == 201
    assert Receta.objects.filter(producto=producto, materia_prima=cloruro, activo=True).exists()


@pytest.mark.django_db
def test_admin_no_puede_duplicar_ingrediente_en_la_misma_receta(admin_client, producto, cloruro, receta):
    response = admin_client.post(
        '/api/produccion/recetas/',
        {'producto': producto.id, 'materia_prima': cloruro.id, 'cantidad_requerida': '1.00'},
        format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_admin_desactiva_linea_de_receta_sin_borrado_fisico(admin_client, producto, cloruro, receta):
    linea = Receta.objects.get(producto=producto, materia_prima=cloruro)
    response = admin_client.delete(f'/api/produccion/recetas/{linea.id}/')
    assert response.status_code == 204
    linea.refresh_from_db()
    assert linea.activo is False
    assert Receta.objects.filter(id=linea.id).exists()


# --- Producción exitosa --------------------------------------------------


@pytest.mark.django_db
def test_produccion_exitosa_consume_materia_prima_y_aumenta_producto(
    admin_client, sucursal, producto, cloruro, agua, receta, stock_materia_prima,
):
    response = admin_client.post('/api/produccion/', _payload_produccion(producto, sucursal, '10'), format='json')

    assert response.status_code == 201
    assert response.data['cantidad_producida'] == '10.00'
    # costo_total = 10*0.50*10.00 (cloruro) + 10*1.00*2.00 (agua) = 50.00 + 20.00 = 70.00
    assert response.data['costo_total'] == '70.00'
    assert len(response.data['detalles']) == 2

    stock_cloruro = InventarioSucursalMateriaPrima.objects.get(sucursal=sucursal, materia_prima=cloruro)
    stock_agua = InventarioSucursalMateriaPrima.objects.get(sucursal=sucursal, materia_prima=agua)
    assert stock_cloruro.stock_actual == Decimal('95.00')  # 100 - (0.50*10)
    assert stock_agua.stock_actual == Decimal('90.00')  # 100 - (1.00*10)

    stock_producto = InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)
    assert stock_producto.stock_actual == Decimal('10.00')

    id_produccion = response.data['id']
    movimientos_salida = MovimientoInventario.objects.filter(referencia_id=id_produccion, tipo_movimiento='salida')
    assert movimientos_salida.count() == 2
    assert all(m.motivo == 'produccion_consumo' for m in movimientos_salida)

    movimiento_entrada = MovimientoInventario.objects.get(referencia_id=id_produccion, tipo_movimiento='entrada')
    assert movimiento_entrada.motivo == 'produccion_entrada'
    assert movimiento_entrada.tipo_item == 'producto'
    assert movimiento_entrada.cantidad == Decimal('10.00')

    assert DetalleProduccion.objects.filter(produccion_id=id_produccion).count() == 2


@pytest.mark.django_db
def test_operador_puede_registrar_produccion(operador_client, sucursal, producto, receta, stock_materia_prima):
    response = operador_client.post('/api/produccion/', _payload_produccion(producto, sucursal), format='json')
    assert response.status_code == 201


@pytest.mark.django_db
def test_produccion_requiere_autenticacion(sucursal, producto, receta, stock_materia_prima):
    client = APIClient()
    response = client.post('/api/produccion/', _payload_produccion(producto, sucursal), format='json')
    assert response.status_code == 401


# --- Bloqueos y validaciones ------------------------------------------


@pytest.mark.django_db
def test_produccion_sin_receta_activa_es_rechazada(admin_client, sucursal, producto):
    response = admin_client.post('/api/produccion/', _payload_produccion(producto, sucursal), format='json')

    assert response.status_code == 400
    assert 'receta activa' in str(response.data['producto'])
    assert not Produccion.objects.exists()


@pytest.mark.django_db
def test_produccion_con_receta_desactivada_es_rechazada(admin_client, sucursal, producto, cloruro, stock_materia_prima):
    Receta.objects.create(producto=producto, materia_prima=cloruro, cantidad_requerida='0.50', activo=False)

    response = admin_client.post('/api/produccion/', _payload_produccion(producto, sucursal), format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_produccion_con_stock_insuficiente_de_una_materia_prima_es_rechazada_por_completo(
    admin_client, sucursal, producto, cloruro, agua, receta,
):
    # Solo hay stock de cloruro, no de agua.
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=sucursal, materia_prima=cloruro, stock_actual='100.00', stock_minimo='5.00',
    )
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=sucursal, materia_prima=agua, stock_actual='1.00', stock_minimo='5.00',
    )

    response = admin_client.post('/api/produccion/', _payload_produccion(producto, sucursal, '10'), format='json')

    assert response.status_code == 400
    assert 'Agua destilada' in str(response.data['detail'])
    assert not Produccion.objects.exists()
    assert not DetalleProduccion.objects.exists()
    assert not MovimientoInventario.objects.exists()

    # El cloruro (que sí tenía stock suficiente) tampoco debe haberse tocado —
    # todo o nada.
    stock_cloruro = InventarioSucursalMateriaPrima.objects.get(sucursal=sucursal, materia_prima=cloruro)
    assert stock_cloruro.stock_actual == Decimal('100.00')

    stock_producto = InventarioSucursalProducto.objects.filter(sucursal=sucursal, producto=producto)
    assert not stock_producto.exists()


@pytest.mark.django_db
def test_produccion_con_cantidad_fraccionaria_es_rechazada(admin_client, sucursal, producto, receta, stock_materia_prima):
    response = admin_client.post(
        '/api/produccion/', _payload_produccion(producto, sucursal, '2.50'), format='json',
    )
    assert response.status_code == 400


# --- Inmutabilidad del historial -----------------------------------------


@pytest.mark.django_db
def test_editar_receta_despues_no_afecta_producciones_ya_registradas(
    admin_client, sucursal, producto, cloruro, agua, receta, stock_materia_prima,
):
    id_produccion = admin_client.post(
        '/api/produccion/', _payload_produccion(producto, sucursal, '10'), format='json',
    ).data['id']

    linea_cloruro = Receta.objects.get(producto=producto, materia_prima=cloruro)
    linea_cloruro.cantidad_requerida = '5.00'
    linea_cloruro.save(update_fields=['cantidad_requerida'])
    cloruro.costo_promedio = '999.00'
    cloruro.save(update_fields=['costo_promedio'])

    response = admin_client.get(f'/api/produccion/{id_produccion}/')
    detalle_cloruro = next(d for d in response.data['detalles'] if d['materia_prima'] == cloruro.id)
    assert detalle_cloruro['cantidad_consumida'] == '5.00'  # 0.50 * 10, no 5.00*10
    assert detalle_cloruro['costo_unitario_momento'] == '10.00'  # no 999.00


# --- Listado / filtros / permisos de escritura ---------------------------


@pytest.mark.django_db
def test_lista_producciones_filtra_por_sucursal_y_producto(admin_client, sucursal, producto, receta, stock_materia_prima):
    otra_sucursal = Sucursal.objects.create(nombre_sucursal='Sucursal Norte')
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=otra_sucursal, materia_prima=Receta.objects.filter(producto=producto).first().materia_prima,
        stock_actual='100.00', stock_minimo='5.00',
    )

    id_produccion = admin_client.post(
        '/api/produccion/', _payload_produccion(producto, sucursal), format='json',
    ).data['id']

    response = admin_client.get('/api/produccion/', {'sucursal': sucursal.id})
    assert len(response.data) == 1
    assert response.data[0]['id'] == id_produccion

    response_producto = admin_client.get('/api/produccion/', {'producto': producto.id})
    assert len(response_producto.data) == 1


@pytest.mark.django_db
def test_no_permite_editar_ni_borrar_una_produccion(admin_client, sucursal, producto, receta, stock_materia_prima):
    id_produccion = admin_client.post(
        '/api/produccion/', _payload_produccion(producto, sucursal), format='json',
    ).data['id']

    assert admin_client.put(f'/api/produccion/{id_produccion}/', {}, format='json').status_code == 405
    assert admin_client.patch(f'/api/produccion/{id_produccion}/', {}, format='json').status_code == 405
    assert admin_client.delete(f'/api/produccion/{id_produccion}/').status_code == 405
