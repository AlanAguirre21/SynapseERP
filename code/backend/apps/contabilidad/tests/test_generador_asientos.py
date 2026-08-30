from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.contabilidad.constants import (
    CODIGO_CAJA,
    CODIGO_CAPITAL,
    CODIGO_COSTO_VENTAS,
    CODIGO_GASTOS_GENERALES,
    CODIGO_INVENTARIO,
    CODIGO_PROVEEDORES,
    CODIGO_VENTAS,
)
from apps.contabilidad.models import AsientoContable, MovimientoContable
from apps.contabilidad.services.generador_asientos import _crear_asiento
from apps.inventario.models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
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
def usuario_admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123', rol_usuario='admin',
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
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-CONT-1', unidad_medida='pza',
        categoria=categoria, precio_venta='45.00', costo_produccion='20.00',
    )


@pytest.fixture
def stock(sucursal, producto):
    return InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='100.00', stock_minimo='10.00',
    )


@pytest.fixture
def proveedor(db):
    return Proveedor.objects.create(nombre_proveedor='Distribuidora ACME')


@pytest.fixture
def materia_prima(categoria):
    return MateriaPrima.objects.create(nombre_item='Cloruro de sodio', unidad_medida='kg', categoria=categoria)


def _movimientos(asiento):
    return {(m.cuenta_contable.codigo, m.tipo_movimiento): m.monto for m in asiento.movimientos.select_related('cuenta_contable')}


# --- Venta ------------------------------------------------------------


@pytest.mark.django_db
def test_crear_venta_genera_asiento_de_costo_y_asiento_de_caja_por_separado(
    api_client, sucursal, producto, stock,
):
    response = api_client.post(
        '/api/ventas/', {'sucursal': sucursal.id, 'detalles': [{'producto': producto.id, 'cantidad': '2.00'}]},
        format='json',
    )
    assert response.status_code == 201
    id_venta = response.data['id']

    asiento_venta = AsientoContable.objects.get(tipo_origen=AsientoContable.ORIGEN_VENTA, referencia_id=id_venta)
    movimientos = _movimientos(asiento_venta)
    # 2 * costo_produccion (20.00) = 40.00 de costo de venta.
    assert movimientos[(CODIGO_COSTO_VENTAS, MovimientoContable.CARGO)] == Decimal('40.00')
    assert movimientos[(CODIGO_INVENTARIO, MovimientoContable.ABONO)] == Decimal('40.00')

    asiento_caja = AsientoContable.objects.get(tipo_origen=AsientoContable.ORIGEN_CAJA, referencia_id__isnull=False)
    movimientos_caja = _movimientos(asiento_caja)
    # 2 * precio_venta (45.00) = 90.00 de ingreso por la venta.
    assert movimientos_caja[(CODIGO_CAJA, MovimientoContable.CARGO)] == Decimal('90.00')
    assert movimientos_caja[(CODIGO_VENTAS, MovimientoContable.ABONO)] == Decimal('90.00')


@pytest.mark.django_db
def test_cancelar_venta_revierte_ambos_asientos(api_client, sucursal, producto, stock):
    id_venta = api_client.post(
        '/api/ventas/', {'sucursal': sucursal.id, 'detalles': [{'producto': producto.id, 'cantidad': '2.00'}]},
        format='json',
    ).data['id']

    response = api_client.post(f'/api/ventas/{id_venta}/cancelar/')
    assert response.status_code == 200

    asiento_reverso_costo = AsientoContable.objects.get(
        tipo_origen=AsientoContable.ORIGEN_AJUSTE, referencia_id=id_venta,
    )
    movimientos = _movimientos(asiento_reverso_costo)
    assert movimientos[(CODIGO_INVENTARIO, MovimientoContable.CARGO)] == Decimal('40.00')
    assert movimientos[(CODIGO_COSTO_VENTAS, MovimientoContable.ABONO)] == Decimal('40.00')

    asientos_caja = AsientoContable.objects.filter(tipo_origen=AsientoContable.ORIGEN_CAJA).order_by('id')
    assert asientos_caja.count() == 2
    _, reverso_caja = asientos_caja
    movimientos_caja = _movimientos(reverso_caja)
    assert movimientos_caja[(CODIGO_VENTAS, MovimientoContable.CARGO)] == Decimal('90.00')
    assert movimientos_caja[(CODIGO_CAJA, MovimientoContable.ABONO)] == Decimal('90.00')


@pytest.mark.django_db
def test_venta_de_producto_con_costo_cero_no_genera_asiento_de_costo(api_client, sucursal, categoria, stock, producto):
    producto.costo_produccion = '0.00'
    producto.save(update_fields=['costo_produccion'])

    response = api_client.post(
        '/api/ventas/', {'sucursal': sucursal.id, 'detalles': [{'producto': producto.id, 'cantidad': '1.00'}]},
        format='json',
    )
    assert response.status_code == 201

    assert not AsientoContable.objects.filter(tipo_origen=AsientoContable.ORIGEN_VENTA).exists()
    # El lado de caja/ingreso sí se genera siempre, aunque no haya costo.
    assert AsientoContable.objects.filter(tipo_origen=AsientoContable.ORIGEN_CAJA).exists()


# --- Compra -------------------------------------------------------------


@pytest.mark.django_db
def test_recibir_compra_genera_asiento_de_inventario_y_proveedores(api_client, sucursal, producto, proveedor):
    id_compra = api_client.post(
        '/api/compras/',
        {
            'proveedor': proveedor.id, 'sucursal': sucursal.id,
            'detalles_producto': [{'producto': producto.id, 'cantidad': '5.00', 'costo_unitario': '10.00'}],
        },
        format='json',
    ).data['id']

    response = api_client.post(f'/api/compras/{id_compra}/recibir/')
    assert response.status_code == 200

    asiento = AsientoContable.objects.get(tipo_origen=AsientoContable.ORIGEN_COMPRA, referencia_id=id_compra)
    movimientos = _movimientos(asiento)
    assert movimientos[(CODIGO_INVENTARIO, MovimientoContable.CARGO)] == Decimal('50.00')
    assert movimientos[(CODIGO_PROVEEDORES, MovimientoContable.ABONO)] == Decimal('50.00')

    # Compras nunca toca caja — no debe existir ningún asiento de origen caja.
    assert not AsientoContable.objects.filter(tipo_origen=AsientoContable.ORIGEN_CAJA).exists()


@pytest.mark.django_db
def test_cancelar_compra_recibida_revierte_el_asiento(api_client, sucursal, producto, proveedor):
    id_compra = api_client.post(
        '/api/compras/',
        {
            'proveedor': proveedor.id, 'sucursal': sucursal.id,
            'detalles_producto': [{'producto': producto.id, 'cantidad': '5.00', 'costo_unitario': '10.00'}],
        },
        format='json',
    ).data['id']
    api_client.post(f'/api/compras/{id_compra}/recibir/')

    response = api_client.post(f'/api/compras/{id_compra}/cancelar/')
    assert response.status_code == 200

    asiento_reverso = AsientoContable.objects.get(tipo_origen=AsientoContable.ORIGEN_AJUSTE, referencia_id=id_compra)
    movimientos = _movimientos(asiento_reverso)
    assert movimientos[(CODIGO_PROVEEDORES, MovimientoContable.CARGO)] == Decimal('50.00')
    assert movimientos[(CODIGO_INVENTARIO, MovimientoContable.ABONO)] == Decimal('50.00')


@pytest.mark.django_db
def test_cancelar_compra_pendiente_no_genera_asiento_de_reverso(api_client, sucursal, producto, proveedor):
    id_compra = api_client.post(
        '/api/compras/',
        {
            'proveedor': proveedor.id, 'sucursal': sucursal.id,
            'detalles_producto': [{'producto': producto.id, 'cantidad': '5.00', 'costo_unitario': '10.00'}],
        },
        format='json',
    ).data['id']

    response = api_client.post(f'/api/compras/{id_compra}/cancelar/')
    assert response.status_code == 200
    assert not AsientoContable.objects.filter(tipo_origen=AsientoContable.ORIGEN_AJUSTE).exists()


@pytest.mark.django_db
def test_recibir_compra_de_materia_prima_genera_asiento_correcto(api_client, sucursal, materia_prima, proveedor):
    InventarioSucursalMateriaPrima.objects.create(
        sucursal=sucursal, materia_prima=materia_prima, stock_actual='0.00', stock_minimo='0.00',
    )
    id_compra = api_client.post(
        '/api/compras/',
        {
            'proveedor': proveedor.id, 'sucursal': sucursal.id,
            'detalles_materia_prima': [{'materia_prima': materia_prima.id, 'cantidad': '3.00', 'costo_unitario': '15.00'}],
        },
        format='json',
    ).data['id']

    api_client.post(f'/api/compras/{id_compra}/recibir/')

    asiento = AsientoContable.objects.get(tipo_origen=AsientoContable.ORIGEN_COMPRA, referencia_id=id_compra)
    movimientos = _movimientos(asiento)
    assert movimientos[(CODIGO_INVENTARIO, MovimientoContable.CARGO)] == Decimal('45.00')
    assert movimientos[(CODIGO_PROVEEDORES, MovimientoContable.ABONO)] == Decimal('45.00')


# --- Caja manual ----------------------------------------------------------


@pytest.mark.django_db
def test_ingreso_manual_de_caja_genera_asiento_contra_capital(usuario_admin):
    client = APIClient()
    client.force_authenticate(user=usuario_admin)

    response = client.post(
        '/api/caja/', {'tipo_movimiento': 'ingreso', 'monto': '500.00', 'observacion': 'Aportación de capital'},
        format='json',
    )
    assert response.status_code == 201

    asiento = AsientoContable.objects.get(tipo_origen=AsientoContable.ORIGEN_CAJA)
    movimientos = _movimientos(asiento)
    assert movimientos[(CODIGO_CAJA, MovimientoContable.CARGO)] == Decimal('500.00')
    assert movimientos[(CODIGO_CAPITAL, MovimientoContable.ABONO)] == Decimal('500.00')


@pytest.mark.django_db
def test_retiro_manual_de_caja_genera_asiento_contra_gastos_generales(usuario_admin):
    client = APIClient()
    client.force_authenticate(user=usuario_admin)
    client.post('/api/caja/', {'tipo_movimiento': 'ingreso', 'monto': '500.00', 'observacion': 'Capital'}, format='json')

    response = client.post(
        '/api/caja/', {'tipo_movimiento': 'retiro', 'monto': '200.00', 'observacion': 'Pago de renta'}, format='json',
    )
    assert response.status_code == 201

    asiento = AsientoContable.objects.filter(tipo_origen=AsientoContable.ORIGEN_CAJA).order_by('-id').first()
    movimientos = _movimientos(asiento)
    assert movimientos[(CODIGO_GASTOS_GENERALES, MovimientoContable.CARGO)] == Decimal('200.00')
    assert movimientos[(CODIGO_CAJA, MovimientoContable.ABONO)] == Decimal('200.00')


# --- Cuadre -----------------------------------------------------------


@pytest.mark.django_db
def test_crear_asiento_descuadrado_lanza_excepcion_y_no_guarda_nada(usuario):
    with pytest.raises(ValueError, match='descuadrado'):
        _crear_asiento(
            concepto='Prueba descuadrada', tipo_origen=AsientoContable.ORIGEN_AJUSTE, referencia_id=None,
            usuario=usuario,
            lineas=[
                (CODIGO_CAJA, MovimientoContable.CARGO, Decimal('100.00')),
                (CODIGO_VENTAS, MovimientoContable.ABONO, Decimal('99.00')),
            ],
        )

    assert not AsientoContable.objects.exists()
    assert not MovimientoContable.objects.exists()
