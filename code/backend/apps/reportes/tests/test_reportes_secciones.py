from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.caja.models import MovimientoCaja
from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.compras.models import Compra, DetalleCompraMateriaPrima, DetalleCompraProducto
from apps.sucursales.models import Sucursal
from apps.terceros.models import Cliente, Proveedor
from apps.usuarios.models import Usuario
from apps.ventas.models import DetalleVenta, Venta


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
    return Categoria.objects.create(nombre_categoria='General', tipo=Categoria.TIPO_AMBOS)


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto='Medias de compresión', sku='SKU-1', unidad_medida='par',
        categoria=categoria, precio_venta=Decimal('250.00'),
    )


@pytest.fixture
def materia_prima(categoria):
    return MateriaPrima.objects.create(nombre_item='Tela elástica', categoria=categoria, unidad_medida='m')


@pytest.fixture
def cliente(db):
    return Cliente.objects.create(nombre_cliente='María Pérez')


def _crear_venta(sucursal, usuario, total, gasto_envio=Decimal('0.00'), estado=Venta.ESTADO_ENTREGADA,
                  cliente=None, fecha=None):
    venta = Venta.objects.create(
        sucursal=sucursal, usuario=usuario, cliente=cliente, total=total, gasto_envio=gasto_envio, estado=estado,
    )
    if fecha is not None:
        Venta.objects.filter(pk=venta.pk).update(fecha=fecha)
    return venta


def _crear_compra(sucursal, proveedor, usuario, total, estado=Compra.ESTADO_RECIBIDA, fecha=None):
    compra = Compra.objects.create(sucursal=sucursal, proveedor=proveedor, usuario=usuario, total=total, estado=estado)
    if fecha is not None:
        Compra.objects.filter(pk=compra.pk).update(fecha=fecha)
    return compra


# --- /api/reportes/resumen/ — periodo "año" -----------------------------

@pytest.mark.django_db
def test_periodo_anio_es_aceptado(api_client):
    response = api_client.get('/api/reportes/resumen/', {'periodo': 'año'})
    assert response.status_code == 200
    assert response.data['periodo'] == 'año'


@pytest.mark.django_db
def test_periodo_anio_agrupa_por_mes(api_client, sucursal, usuario):
    ahora = timezone.localtime()
    _crear_venta(sucursal, usuario, Decimal('100.00'), fecha=ahora)
    _crear_venta(sucursal, usuario, Decimal('50.00'), fecha=ahora - timedelta(days=10))

    response = api_client.get('/api/reportes/resumen/', {'periodo': 'año'})

    puntos_con_ganancia = [p for p in response.data['serie'] if Decimal(p['ganancia']) != 0]
    assert len(puntos_con_ganancia) == 1
    assert puntos_con_ganancia[0]['ganancia'] == '150.00'


# --- /api/reportes/ventas/ -----------------------------------------------

@pytest.mark.django_db
def test_resumen_ventas_requiere_autenticacion():
    client = APIClient()
    response = client.get('/api/reportes/ventas/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_resumen_ventas_desglosa_envio(api_client, sucursal, usuario):
    _crear_venta(sucursal, usuario, total=Decimal('220.00'), gasto_envio=Decimal('20.00'))

    response = api_client.get('/api/reportes/ventas/', {'periodo': 'mes'})

    con_envio = sum(Decimal(p['monto']) for p in response.data['con_envio'])
    sin_envio = sum(Decimal(p['monto']) for p in response.data['sin_envio'])
    envio = sum(Decimal(p['monto']) for p in response.data['envio'])
    assert con_envio == Decimal('220.00')
    assert sin_envio == Decimal('200.00')
    assert envio == Decimal('20.00')


@pytest.mark.django_db
def test_resumen_ventas_excluye_canceladas(api_client, sucursal, usuario):
    _crear_venta(sucursal, usuario, total=Decimal('300.00'), estado=Venta.ESTADO_CANCELADA)

    response = api_client.get('/api/reportes/ventas/', {'periodo': 'mes'})

    assert sum(Decimal(p['monto']) for p in response.data['con_envio']) == Decimal('0.00')


@pytest.mark.django_db
def test_resumen_ventas_conteo_por_estado(api_client, sucursal, usuario):
    _crear_venta(sucursal, usuario, total=Decimal('100.00'), estado=Venta.ESTADO_PENDIENTE)
    _crear_venta(sucursal, usuario, total=Decimal('100.00'), estado=Venta.ESTADO_ENTREGADA)
    _crear_venta(sucursal, usuario, total=Decimal('100.00'), estado=Venta.ESTADO_ENTREGADA)

    response = api_client.get('/api/reportes/ventas/', {'periodo': 'mes'})

    conteo = {fila['tipo']: fila['cantidad'] for fila in response.data['conteo_estado']}
    assert conteo == {'Pendiente': 1, 'Entregada': 2}


# --- /api/reportes/compras/ -----------------------------------------------

@pytest.mark.django_db
def test_resumen_compras_requiere_autenticacion():
    client = APIClient()
    response = client.get('/api/reportes/compras/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_resumen_compras_desglosa_productos_e_insumos(api_client, sucursal, proveedor, usuario, producto, materia_prima):
    compra = _crear_compra(sucursal, proveedor, usuario, total=Decimal('300.00'))
    DetalleCompraProducto.objects.create(
        compra=compra, producto=producto, cantidad=Decimal('2'), costo_unitario=Decimal('100.00'),
        subtotal=Decimal('200.00'),
    )
    DetalleCompraMateriaPrima.objects.create(
        compra=compra, materia_prima=materia_prima, cantidad=Decimal('10'), costo_unitario=Decimal('10.00'),
        subtotal=Decimal('100.00'),
    )

    response = api_client.get('/api/reportes/compras/', {'periodo': 'mes'})

    assert sum(Decimal(p['monto']) for p in response.data['productos']) == Decimal('200.00')
    assert sum(Decimal(p['monto']) for p in response.data['insumos']) == Decimal('100.00')
    assert sum(Decimal(p['monto']) for p in response.data['todas']) == Decimal('300.00')


@pytest.mark.django_db
def test_resumen_compras_incluye_pendientes_en_las_series_de_monto(
    api_client, sucursal, proveedor, usuario, producto,
):
    compra = _crear_compra(sucursal, proveedor, usuario, total=Decimal('200.00'), estado=Compra.ESTADO_PENDIENTE)
    DetalleCompraProducto.objects.create(
        compra=compra, producto=producto, cantidad=Decimal('1'), costo_unitario=Decimal('200.00'),
        subtotal=Decimal('200.00'),
    )

    response = api_client.get('/api/reportes/compras/', {'periodo': 'mes'})

    assert sum(Decimal(p['monto']) for p in response.data['todas']) == Decimal('200.00')


@pytest.mark.django_db
def test_resumen_compras_excluye_canceladas_de_las_series_de_monto(
    api_client, sucursal, proveedor, usuario, producto,
):
    compra = _crear_compra(sucursal, proveedor, usuario, total=Decimal('200.00'), estado=Compra.ESTADO_CANCELADA)
    DetalleCompraProducto.objects.create(
        compra=compra, producto=producto, cantidad=Decimal('1'), costo_unitario=Decimal('200.00'),
        subtotal=Decimal('200.00'),
    )

    response = api_client.get('/api/reportes/compras/', {'periodo': 'mes'})

    assert sum(Decimal(p['monto']) for p in response.data['todas']) == Decimal('0.00')


@pytest.mark.django_db
def test_resumen_compras_conteo_por_estado(api_client, sucursal, proveedor, usuario):
    _crear_compra(sucursal, proveedor, usuario, total=Decimal('50.00'), estado=Compra.ESTADO_PENDIENTE)
    _crear_compra(sucursal, proveedor, usuario, total=Decimal('50.00'), estado=Compra.ESTADO_RECIBIDA)

    response = api_client.get('/api/reportes/compras/', {'periodo': 'mes'})

    conteo = {fila['tipo']: fila['cantidad'] for fila in response.data['conteo_estado']}
    assert conteo == {'Pendiente': 1, 'Recibida': 1}


# --- /api/reportes/productos-top/ -----------------------------------------

@pytest.mark.django_db
def test_productos_top_mas_vendidos_ordena_descendente(api_client, sucursal, usuario, categoria):
    producto_a = Producto.objects.create(
        nombre_producto='A', sku='SKU-A', unidad_medida='pza', categoria=categoria, precio_venta=Decimal('10'),
    )
    producto_b = Producto.objects.create(
        nombre_producto='B', sku='SKU-B', unidad_medida='pza', categoria=categoria, precio_venta=Decimal('10'),
    )
    venta = _crear_venta(sucursal, usuario, total=Decimal('0.00'))
    DetalleVenta.objects.create(venta=venta, producto=producto_a, cantidad=Decimal('3'), precio_unitario=Decimal('10'), subtotal=Decimal('30'))
    DetalleVenta.objects.create(venta=venta, producto=producto_b, cantidad=Decimal('7'), precio_unitario=Decimal('10'), subtotal=Decimal('70'))

    response = api_client.get('/api/reportes/productos-top/', {'periodo': 'mes', 'orden': 'mas'})

    assert response.data[0]['producto'] == 'B'
    assert response.data[1]['producto'] == 'A'


@pytest.mark.django_db
def test_productos_top_menos_vendidos_no_incluye_productos_sin_ventas(api_client, sucursal, usuario, producto):
    # `producto` existe en catálogo pero no tiene ninguna venta en el periodo.
    response = api_client.get('/api/reportes/productos-top/', {'periodo': 'mes', 'orden': 'menos'})

    assert response.data == []


@pytest.mark.django_db
def test_productos_top_orden_invalido_es_rechazado(api_client):
    response = api_client.get('/api/reportes/productos-top/', {'periodo': 'mes', 'orden': 'aleatorio'})
    assert response.status_code == 400


# --- /api/reportes/clientes-top/ ------------------------------------------

@pytest.mark.django_db
def test_clientes_top_excluye_ventas_sin_cliente(api_client, sucursal, usuario, cliente):
    _crear_venta(sucursal, usuario, total=Decimal('500.00'), cliente=None)
    _crear_venta(sucursal, usuario, total=Decimal('100.00'), cliente=cliente)

    response = api_client.get('/api/reportes/clientes-top/', {'periodo': 'mes', 'orden': 'mas'})

    assert len(response.data) == 1
    assert response.data[0]['cliente'] == 'María Pérez'
    assert response.data[0]['monto'] == '100.00'


# --- /api/reportes/movimientos-caja/ ---------------------------------------

@pytest.mark.django_db
def test_movimientos_caja_reporte_no_requiere_rol_admin(api_client):
    response = api_client.get('/api/reportes/movimientos-caja/', {'periodo': 'mes'})
    assert response.status_code == 200


@pytest.mark.django_db
def test_movimientos_caja_reporte_solo_expone_fecha_tipo_descripcion(api_client, usuario):
    MovimientoCaja.objects.create(
        monto=Decimal('500.00'), tipo_movimiento=MovimientoCaja.INGRESO, motivo=MovimientoCaja.MOTIVO_MANUAL,
        saldo_resultante=Decimal('500.00'), observacion='Aportación de capital', usuario=usuario,
    )

    response = api_client.get('/api/reportes/movimientos-caja/', {'periodo': 'mes'})

    assert response.status_code == 200
    assert set(response.data[0].keys()) == {'fecha', 'tipo_movimiento', 'observacion'}
    assert response.data[0]['observacion'] == 'Aportación de capital'


@pytest.mark.django_db
def test_movimientos_caja_reporte_respeta_limite(api_client, usuario):
    for i in range(12):
        MovimientoCaja.objects.create(
            monto=Decimal('10.00'), tipo_movimiento=MovimientoCaja.INGRESO, motivo=MovimientoCaja.MOTIVO_MANUAL,
            saldo_resultante=Decimal('10.00'), observacion=f'Movimiento {i}', usuario=usuario,
        )

    respuesta_5 = api_client.get('/api/reportes/movimientos-caja/', {'periodo': 'mes', 'limite': '5'})
    respuesta_10 = api_client.get('/api/reportes/movimientos-caja/', {'periodo': 'mes', 'limite': '10'})
    respuesta_todos = api_client.get('/api/reportes/movimientos-caja/', {'periodo': 'mes', 'limite': 'todos'})

    assert len(respuesta_5.data) == 5
    assert len(respuesta_10.data) == 10
    assert len(respuesta_todos.data) == 12


@pytest.mark.django_db
def test_movimientos_caja_reporte_limite_invalido_es_rechazado(api_client):
    response = api_client.get('/api/reportes/movimientos-caja/', {'periodo': 'mes', 'limite': '3'})
    assert response.status_code == 400
