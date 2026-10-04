from decimal import Decimal
from unittest import mock

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.inventario import services
from apps.inventario.models import (
    DetalleTraslado,
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
    Traslado,
)
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario

URL_TRASLADOS = '/api/inventario/traslados/'
URL_MOVIMIENTOS = '/api/inventario/movimientos/'


@pytest.fixture
def operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123',
    )


@pytest.fixture
def operador_client(operador):
    client = APIClient()
    client.force_authenticate(user=operador)
    return client


@pytest.fixture
def admin_client(db):
    admin = Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123', rol_usuario='admin',
    )
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def matriz(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


@pytest.fixture
def norte(db):
    return Sucursal.objects.create(nombre_sucursal='Sucursal Norte')


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def suero(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-TR-1', unidad_medida='pza',
        categoria=categoria, precio_venta='10.00',
    )


@pytest.fixture
def gasa(categoria):
    return Producto.objects.create(
        nombre_producto='Gasa estéril', sku='SKU-TR-2', unidad_medida='pza',
        categoria=categoria, precio_venta='5.00',
    )


@pytest.fixture
def cloruro(categoria):
    return MateriaPrima.objects.create(nombre_item='Cloruro de sodio', unidad_medida='kg', categoria=categoria)


def _stock_producto(sucursal, producto):
    return InventarioSucursalProducto.objects.get(sucursal=sucursal, producto=producto)


def _stock_mp(sucursal, materia_prima):
    return InventarioSucursalMateriaPrima.objects.get(sucursal=sucursal, materia_prima=materia_prima)


def _payload(origen, destino, *lineas):
    return {
        'sucursal_origen': origen.id,
        'sucursal_destino': destino.id,
        'detalles': [
            {'tipo_item': tipo, 'item_id': item.id, 'cantidad': cantidad} for tipo, item, cantidad in lineas
        ],
    }


@pytest.mark.django_db
def test_traslado_una_linea(operador_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=20)
    InventarioSucursalProducto.objects.create(sucursal=norte, producto=suero, stock_actual=5)

    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '8')), format='json',
    )

    assert respuesta.status_code == 201
    assert _stock_producto(matriz, suero).stock_actual == Decimal(12)
    assert _stock_producto(norte, suero).stock_actual == Decimal(13)

    traslado = Traslado.objects.get()
    assert respuesta.data['id'] == traslado.id
    assert traslado.detalles.count() == 1

    salida = MovimientoInventario.objects.get(motivo=MovimientoInventario.MOTIVO_TRASLADO_SALIDA)
    entrada = MovimientoInventario.objects.get(motivo=MovimientoInventario.MOTIVO_TRASLADO_ENTRADA)
    assert (salida.sucursal, salida.tipo_movimiento, salida.stock_resultante) == (matriz, 'salida', Decimal(12))
    assert (entrada.sucursal, entrada.tipo_movimiento, entrada.stock_resultante) == (norte, 'entrada', Decimal(13))
    assert salida.referencia_id == entrada.referencia_id == traslado.id
    assert salida.cantidad == entrada.cantidad == Decimal(8)


@pytest.mark.django_db
def test_traslado_mixto_varias_lineas(operador_client, matriz, norte, suero, gasa, cloruro):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=20)
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=gasa, stock_actual=30)
    InventarioSucursalMateriaPrima.objects.create(sucursal=matriz, materia_prima=cloruro, stock_actual='10.00')

    respuesta = operador_client.post(
        URL_TRASLADOS,
        _payload(
            matriz, norte,
            ('producto', suero, '5'), ('materia_prima', cloruro, '2.50'), ('producto', gasa, '10'),
        ),
        format='json',
    )

    assert respuesta.status_code == 201
    assert _stock_producto(matriz, suero).stock_actual == Decimal(15)
    assert _stock_producto(norte, suero).stock_actual == Decimal(5)
    assert _stock_producto(matriz, gasa).stock_actual == Decimal(20)
    assert _stock_producto(norte, gasa).stock_actual == Decimal(10)
    assert _stock_mp(matriz, cloruro).stock_actual == Decimal('7.50')
    assert _stock_mp(norte, cloruro).stock_actual == Decimal('2.50')

    traslado = Traslado.objects.get()
    assert DetalleTraslado.objects.filter(traslado=traslado).count() == 3
    movimientos = MovimientoInventario.objects.all()
    assert movimientos.count() == 6
    assert set(movimientos.values_list('referencia_id', flat=True)) == {traslado.id}
    assert len(respuesta.data['detalles']) == 3


@pytest.mark.django_db
def test_cantidad_decimal_exacta_y_mas_de_dos_decimales_rechazada(operador_client, matriz, norte, cloruro):
    InventarioSucursalMateriaPrima.objects.create(sucursal=matriz, materia_prima=cloruro, stock_actual='5.00')

    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('materia_prima', cloruro, '2.555')), format='json',
    )
    assert respuesta.status_code == 400
    assert Traslado.objects.count() == 0

    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('materia_prima', cloruro, '2.55')), format='json',
    )
    assert respuesta.status_code == 201
    assert _stock_mp(matriz, cloruro).stock_actual == Decimal('2.45')
    assert _stock_mp(norte, cloruro).stock_actual == Decimal('2.55')


@pytest.mark.django_db
def test_destino_sin_registro_previo_se_crea(operador_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10, stock_minimo=4)
    assert not InventarioSucursalProducto.objects.filter(sucursal=norte, producto=suero).exists()

    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '3')), format='json',
    )

    assert respuesta.status_code == 201
    destino = _stock_producto(norte, suero)
    assert destino.stock_actual == Decimal(3)
    assert destino.stock_minimo == Decimal(0)


@pytest.mark.django_db
def test_stock_insuficiente_en_una_linea_no_escribe_nada(operador_client, matriz, norte, suero, cloruro):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=20)
    InventarioSucursalMateriaPrima.objects.create(sucursal=matriz, materia_prima=cloruro, stock_actual='1.00')

    respuesta = operador_client.post(
        URL_TRASLADOS,
        _payload(matriz, norte, ('producto', suero, '5'), ('materia_prima', cloruro, '2')),
        format='json',
    )

    assert respuesta.status_code == 400
    assert 'Stock insuficiente' in respuesta.data['detail']
    assert 'Cloruro de sodio' in respuesta.data['detail']
    assert Traslado.objects.count() == 0
    assert DetalleTraslado.objects.count() == 0
    assert MovimientoInventario.objects.count() == 0
    assert _stock_producto(matriz, suero).stock_actual == Decimal(20)
    assert _stock_mp(matriz, cloruro).stock_actual == Decimal('1.00')


@pytest.mark.django_db
def test_stock_insuficiente_en_varias_lineas_las_lista_todas(operador_client, matriz, norte, suero, cloruro):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=1)

    respuesta = operador_client.post(
        URL_TRASLADOS,
        _payload(matriz, norte, ('producto', suero, '5'), ('materia_prima', cloruro, '2')),
        format='json',
    )

    assert respuesta.status_code == 400
    assert 'Suero fisiológico' in respuesta.data['detail']
    assert 'Cloruro de sodio' in respuesta.data['detail']


@pytest.mark.django_db
def test_origen_igual_a_destino_rechazado(operador_client, matriz, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, matriz, ('producto', suero, '1')), format='json',
    )
    assert respuesta.status_code == 400
    assert 'sucursal_destino' in respuesta.data


@pytest.mark.django_db
@pytest.mark.parametrize('inactiva', ['origen', 'destino'])
def test_sucursal_inactiva_rechazada(operador_client, matriz, norte, suero, inactiva):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    sucursal = matriz if inactiva == 'origen' else norte
    sucursal.activo = False
    sucursal.save()

    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '1')), format='json',
    )
    assert respuesta.status_code == 400
    assert f'sucursal_{inactiva}' in respuesta.data
    assert Traslado.objects.count() == 0


@pytest.mark.django_db
def test_detalles_vacio_rechazado(operador_client, matriz, norte):
    respuesta = operador_client.post(URL_TRASLADOS, _payload(matriz, norte), format='json')
    assert respuesta.status_code == 400
    assert 'detalles' in respuesta.data


@pytest.mark.django_db
def test_item_repetido_rechazado(operador_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    respuesta = operador_client.post(
        URL_TRASLADOS,
        _payload(matriz, norte, ('producto', suero, '1'), ('producto', suero, '2')),
        format='json',
    )
    assert respuesta.status_code == 400
    assert 'detalles' in respuesta.data
    assert Traslado.objects.count() == 0


@pytest.mark.django_db
def test_mismo_id_en_tipos_distintos_no_es_repetido(operador_client, matriz, norte, suero, cloruro):
    """Un producto y una materia prima pueden compartir `id`; no son el
    mismo ítem."""

    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    InventarioSucursalMateriaPrima.objects.create(sucursal=matriz, materia_prima=cloruro, stock_actual=10)
    payload = {
        'sucursal_origen': matriz.id,
        'sucursal_destino': norte.id,
        'detalles': [
            {'tipo_item': 'producto', 'item_id': suero.id, 'cantidad': '1'},
            {'tipo_item': 'materia_prima', 'item_id': cloruro.id, 'cantidad': '1'},
        ],
    }
    assert operador_client.post(URL_TRASLADOS, payload, format='json').status_code == 201


@pytest.mark.django_db
def test_item_inactivo_o_inexistente_rechazado(operador_client, matriz, norte, suero):
    suero.activo = False
    suero.save()
    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '1')), format='json',
    )
    assert respuesta.status_code == 400

    payload = _payload(matriz, norte)
    payload['detalles'] = [{'tipo_item': 'materia_prima', 'item_id': 99999, 'cantidad': '1'}]
    assert operador_client.post(URL_TRASLADOS, payload, format='json').status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize('cantidad', ['0', '-1'])
def test_cantidad_no_positiva_rechazada(operador_client, matriz, norte, suero, cantidad):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    respuesta = operador_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, cantidad)), format='json',
    )
    assert respuesta.status_code == 400
    assert Traslado.objects.count() == 0


@pytest.mark.django_db
def test_admin_tambien_puede_trasladar(admin_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    respuesta = admin_client.post(
        URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '1')), format='json',
    )
    assert respuesta.status_code == 201


@pytest.mark.django_db
def test_no_autenticado_401(matriz, norte, suero):
    respuesta = APIClient().post(
        URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '1')), format='json',
    )
    assert respuesta.status_code == 401


@pytest.mark.django_db
def test_metodos_distintos_de_post_405(operador_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    operador_client.post(URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '1')), format='json')
    traslado = Traslado.objects.get()

    assert operador_client.get(URL_TRASLADOS).status_code == 405
    assert operador_client.put(URL_TRASLADOS, {}, format='json').status_code == 405
    assert operador_client.patch(URL_TRASLADOS, {}, format='json').status_code == 405
    assert operador_client.delete(URL_TRASLADOS).status_code == 405
    # Sin rutas de detalle: un traslado no se consulta, edita ni borra por id.
    assert operador_client.get(f'{URL_TRASLADOS}{traslado.id}/').status_code == 404
    assert operador_client.delete(f'{URL_TRASLADOS}{traslado.id}/').status_code == 404


@pytest.mark.django_db
def test_stock_minimo_intacto(operador_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10, stock_minimo=7)
    InventarioSucursalProducto.objects.create(sucursal=norte, producto=suero, stock_actual=0, stock_minimo=3)

    operador_client.post(URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '4')), format='json')

    assert _stock_producto(matriz, suero).stock_minimo == Decimal(7)
    assert _stock_producto(norte, suero).stock_minimo == Decimal(3)


@pytest.mark.django_db
def test_rollback_si_falla_el_segundo_movimiento(operador_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    original = services.registrar_movimiento_inventario
    llamadas = {'n': 0}

    def fallar_en_la_segunda(**kwargs):
        llamadas['n'] += 1
        if llamadas['n'] == 2:
            raise RuntimeError('fallo simulado')
        return original(**kwargs)

    client = operador_client
    client.raise_request_exception = False
    with mock.patch.object(services, 'registrar_movimiento_inventario', side_effect=fallar_en_la_segunda):
        respuesta = client.post(URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '4')), format='json')

    assert respuesta.status_code == 500
    assert Traslado.objects.count() == 0
    assert MovimientoInventario.objects.count() == 0
    assert _stock_producto(matriz, suero).stock_actual == Decimal(10)
    assert not InventarioSucursalProducto.objects.filter(sucursal=norte, producto=suero).exists()


@pytest.mark.django_db
def test_bloqueo_en_orden_global_fijo(matriz, norte, suero, gasa, cloruro, operador):
    """Productos antes que materia prima, luego `item_id`, luego
    `sucursal_id` ascendente — independiente del sentido del traslado y del
    orden de captura de las líneas."""

    orden = []

    def registrar(tipo):
        def bloquear(sucursal, item):
            orden.append((tipo, item.pk, sucursal.pk))
            return (
                services.InventarioSucursalProducto(sucursal=sucursal, producto=item, stock_actual=100)
                if tipo == 'producto'
                else services.InventarioSucursalMateriaPrima(sucursal=sucursal, materia_prima=item, stock_actual=100)
            )
        return bloquear

    with (
        mock.patch.object(services, 'bloquear_inventario_producto', side_effect=registrar('producto')),
        mock.patch.object(services, 'bloquear_inventario_materia_prima', side_effect=registrar('materia_prima')),
        mock.patch.object(services, 'Traslado') as traslado_mock,
        mock.patch.object(services, 'DetalleTraslado'),
        mock.patch.object(services, 'registrar_movimiento_inventario'),
        mock.patch('apps.inventario.models.InventarioSucursalProducto.save'),
        mock.patch('apps.inventario.models.InventarioSucursalMateriaPrima.save'),
    ):
        traslado_mock.objects.create.return_value = mock.Mock(pk=1)
        services.trasladar_stock(
            sucursal_origen=norte, sucursal_destino=matriz, usuario=operador,
            lineas=[
                ('materia_prima', cloruro, Decimal(1)),
                ('producto', gasa, Decimal(1)),
                ('producto', suero, Decimal(1)),
            ],
        )

    sucursales = sorted([matriz.pk, norte.pk])
    productos = sorted([suero.pk, gasa.pk])
    esperado = [
        ('producto', productos[0], sucursales[0]), ('producto', productos[0], sucursales[1]),
        ('producto', productos[1], sucursales[0]), ('producto', productos[1], sucursales[1]),
        ('materia_prima', cloruro.pk, sucursales[0]), ('materia_prima', cloruro.pk, sucursales[1]),
    ]
    assert orden == esperado


@pytest.mark.django_db
def test_historial_muestra_filas_de_traslado(operador_client, matriz, norte, suero, cloruro):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=10)
    InventarioSucursalMateriaPrima.objects.create(sucursal=matriz, materia_prima=cloruro, stock_actual=10)
    operador_client.post(
        URL_TRASLADOS,
        _payload(matriz, norte, ('producto', suero, '2'), ('materia_prima', cloruro, '1.5')),
        format='json',
    )
    MovimientoInventario.objects.create(
        sucursal=matriz, tipo_item='producto', item_id=suero.id, tipo_movimiento='entrada', cantidad=1,
        motivo='compra', stock_resultante=9, usuario=Usuario.objects.get(),
    )
    traslado = Traslado.objects.get()

    todos = operador_client.get(URL_MOVIMIENTOS).data
    assert len(todos) == 5

    de_traslado = operador_client.get(URL_MOVIMIENTOS, {'motivo': 'traslado'}).data
    assert len(de_traslado) == 4
    for fila in de_traslado:
        assert fila['referencia_id'] == traslado.id
        if fila['motivo'] == 'traslado_salida':
            assert fila['sucursal_nombre'] == 'Matriz'
            assert fila['sucursal_contraparte'] == 'Sucursal Norte'
        else:
            assert fila['sucursal_nombre'] == 'Sucursal Norte'
            assert fila['sucursal_contraparte'] == 'Matriz'

    compra = operador_client.get(URL_MOVIMIENTOS, {'motivo': 'compra'}).data
    assert len(compra) == 1
    assert compra[0]['sucursal_contraparte'] is None

    solo_mp = operador_client.get(URL_MOVIMIENTOS, {'motivo': 'traslado', 'tipo_item': 'materia_prima'}).data
    assert len(solo_mp) == 2
    assert {fila['item_nombre'] for fila in solo_mp} == {'Cloruro de sodio'}


@pytest.mark.django_db
def test_historial_resuelve_contraparte_en_una_sola_consulta(operador_client, matriz, norte, suero):
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=100)
    for _ in range(5):
        operador_client.post(URL_TRASLADOS, _payload(matriz, norte, ('producto', suero, '1')), format='json')

    with CaptureQueriesContext(connection) as consultas:
        datos = operador_client.get(URL_MOVIMIENTOS, {'motivo': 'traslado'}).data

    assert len(datos) == 10
    assert all(fila['sucursal_contraparte'] for fila in datos)
    consultas_traslado = [c for c in consultas.captured_queries if 'FROM "inventario_traslado"' in c['sql']]
    assert len(consultas_traslado) == 1
