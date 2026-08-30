from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, Producto
from apps.contabilidad.constants import CODIGO_CAJA
from apps.contabilidad.models import CuentaContable
from apps.inventario.models import InventarioSucursalProducto
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario


@pytest.fixture
def usuario_admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123', rol_usuario='admin',
    )


@pytest.fixture
def usuario_operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123',
    )


@pytest.fixture
def admin_client(usuario_admin):
    client = APIClient()
    client.force_authenticate(user=usuario_admin)
    return client


@pytest.fixture
def operador_client(usuario_operador):
    client = APIClient()
    client.force_authenticate(user=usuario_operador)
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
        nombre_producto='Suero fisiológico', sku='SKU-CONT-VIEW-1', unidad_medida='pza',
        categoria=categoria, precio_venta='45.00', costo_produccion='20.00',
    )


@pytest.fixture
def stock(sucursal, producto):
    return InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='100.00', stock_minimo='10.00',
    )


def _crear_venta(client, sucursal, producto, cantidad='1.00'):
    response = client.post(
        '/api/ventas/', {'sucursal': sucursal.id, 'detalles': [{'producto': producto.id, 'cantidad': cantidad}]},
        format='json',
    )
    assert response.status_code == 201, response.data
    return response.data['id']


# --- Permisos ------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize('ruta', ['/api/contabilidad/cuentas/', '/api/contabilidad/asientos/', '/api/contabilidad/balance/'])
def test_endpoints_rechazan_a_operador(operador_client, ruta):
    assert operador_client.get(ruta).status_code == 403


@pytest.mark.django_db
def test_endpoints_rechazan_sin_autenticacion():
    client = APIClient()
    assert client.get('/api/contabilidad/cuentas/').status_code == 401


@pytest.mark.django_db
def test_admin_puede_listar_cuentas(admin_client):
    response = admin_client.get('/api/contabilidad/cuentas/')
    assert response.status_code == 200
    assert len(response.data) >= 12  # catálogo base precargado por la migración de datos


# --- CuentaContable CRUD --------------------------------------------------


@pytest.mark.django_db
def test_admin_puede_crear_editar_y_desactivar_una_cuenta(admin_client):
    padre = CuentaContable.objects.get(codigo='5000')

    creada = admin_client.post(
        '/api/contabilidad/cuentas/',
        {'codigo': '5300', 'nombre': 'Depreciación', 'tipo': 'egreso', 'cuenta_padre': padre.id},
        format='json',
    )
    assert creada.status_code == 201
    assert creada.data['cuenta_padre_codigo'] == '5000'
    id_cuenta = creada.data['id']

    editada = admin_client.patch(
        f'/api/contabilidad/cuentas/{id_cuenta}/', {'nombre': 'Depreciación acumulada'}, format='json',
    )
    assert editada.status_code == 200
    assert editada.data['nombre'] == 'Depreciación acumulada'

    desactivada = admin_client.delete(f'/api/contabilidad/cuentas/{id_cuenta}/')
    assert desactivada.status_code == 204
    cuenta = CuentaContable.objects.get(id=id_cuenta)
    assert cuenta.activo is False

    reactivada = admin_client.post(f'/api/contabilidad/cuentas/{id_cuenta}/reactivar/')
    assert reactivada.status_code == 200
    assert reactivada.data['activo'] is True


@pytest.mark.django_db
def test_no_permite_codigo_duplicado(admin_client):
    response = admin_client.post(
        '/api/contabilidad/cuentas/', {'codigo': CODIGO_CAJA, 'nombre': 'Otra caja', 'tipo': 'activo'}, format='json',
    )
    assert response.status_code == 400
    assert 'codigo' in response.data


@pytest.mark.django_db
def test_una_cuenta_no_puede_ser_su_propia_cuenta_padre(admin_client):
    cuenta = CuentaContable.objects.get(codigo='3000')
    response = admin_client.patch(
        f'/api/contabilidad/cuentas/{cuenta.id}/', {'cuenta_padre': cuenta.id}, format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_no_se_puede_desactivar_una_cuenta_de_sistema(admin_client):
    cuenta = CuentaContable.objects.get(codigo=CODIGO_CAJA)
    response = admin_client.delete(f'/api/contabilidad/cuentas/{cuenta.id}/')
    assert response.status_code == 400
    cuenta.refresh_from_db()
    assert cuenta.activo is True


# --- Libro diario ----------------------------------------------------------


@pytest.mark.django_db
def test_libro_diario_es_de_solo_lectura(admin_client):
    assert admin_client.post('/api/contabilidad/asientos/', {}, format='json').status_code == 405
    assert admin_client.patch('/api/contabilidad/asientos/1/', {}, format='json').status_code == 405
    assert admin_client.delete('/api/contabilidad/asientos/1/').status_code == 405


@pytest.mark.django_db
def test_libro_diario_filtra_por_origen_y_cuenta(admin_client, sucursal, producto, stock):
    id_venta = _crear_venta(admin_client, sucursal, producto)

    respuesta_venta = admin_client.get('/api/contabilidad/asientos/', {'tipo_origen': 'venta'})
    assert respuesta_venta.status_code == 200
    assert len(respuesta_venta.data) == 1
    assert respuesta_venta.data[0]['referencia_id'] == id_venta
    assert respuesta_venta.data[0]['movimientos']

    respuesta_caja = admin_client.get('/api/contabilidad/asientos/', {'tipo_origen': 'caja'})
    assert len(respuesta_caja.data) == 1

    cuenta_caja = CuentaContable.objects.get(codigo=CODIGO_CAJA)
    respuesta_por_cuenta = admin_client.get('/api/contabilidad/asientos/', {'cuenta': cuenta_caja.id})
    assert len(respuesta_por_cuenta.data) == 1
    assert respuesta_por_cuenta.data[0]['tipo_origen'] == 'caja'


@pytest.mark.django_db
def test_libro_diario_filtra_por_fecha(admin_client, sucursal, producto, stock):
    _crear_venta(admin_client, sucursal, producto)

    assert len(admin_client.get('/api/contabilidad/asientos/', {'fecha_desde': '2999-01-01'}).data) == 0
    assert len(admin_client.get('/api/contabilidad/asientos/', {'fecha_hasta': '2999-01-01'}).data) >= 1


# --- Balance de comprobación ------------------------------------------------


@pytest.mark.django_db
def test_balance_de_comprobacion_refleja_los_movimientos(admin_client, sucursal, producto, stock):
    _crear_venta(admin_client, sucursal, producto, cantidad='2.00')

    response = admin_client.get('/api/contabilidad/balance/')
    assert response.status_code == 200

    filas_por_codigo = {fila['codigo']: fila for fila in response.data}
    # 2 * precio_venta (45.00) = 90.00 de ingreso; Caja queda con saldo deudor de 90.00.
    assert Decimal(filas_por_codigo[CODIGO_CAJA]['total_cargos']) == Decimal('90.00')
    assert Decimal(filas_por_codigo[CODIGO_CAJA]['saldo']) == Decimal('90.00')
    assert Decimal(filas_por_codigo['4100']['total_abonos']) == Decimal('90.00')
    # 2 * costo_produccion (20.00) = 40.00 de costo de venta / salida de inventario.
    assert Decimal(filas_por_codigo['1300']['total_abonos']) == Decimal('40.00')
    assert Decimal(filas_por_codigo['5100']['total_cargos']) == Decimal('40.00')


@pytest.mark.django_db
def test_balance_incluye_cuentas_sin_movimientos_en_cero(admin_client):
    response = admin_client.get('/api/contabilidad/balance/')
    filas_por_codigo = {fila['codigo']: fila for fila in response.data}
    assert Decimal(filas_por_codigo['3000']['total_cargos']) == Decimal('0.00')
    assert Decimal(filas_por_codigo['3000']['saldo']) == Decimal('0.00')


# --- Exportación -----------------------------------------------------------


@pytest.mark.django_db
def test_exportar_libro_diario_csv(admin_client, sucursal, producto, stock):
    _crear_venta(admin_client, sucursal, producto)

    response = admin_client.get('/api/contabilidad/exportar/', {'tipo': 'libro_diario'})
    assert response.status_code == 200
    assert response['Content-Type'] == 'text/csv'
    contenido = response.content.decode('utf-8')
    assert 'Asiento' in contenido
    assert 'Caja' in contenido


@pytest.mark.django_db
def test_exportar_balance_csv(admin_client, sucursal, producto, stock):
    _crear_venta(admin_client, sucursal, producto)

    response = admin_client.get('/api/contabilidad/exportar/', {'tipo': 'balance'})
    assert response.status_code == 200
    contenido = response.content.decode('utf-8')
    assert 'Saldo' in contenido
    assert 'Caja' in contenido


@pytest.mark.django_db
def test_exportar_rechaza_formato_no_soportado(admin_client):
    response = admin_client.get('/api/contabilidad/exportar/', {'formato': 'xlsx'})
    assert response.status_code == 400


@pytest.mark.django_db
def test_exportar_rechaza_tipo_no_soportado(admin_client):
    response = admin_client.get('/api/contabilidad/exportar/', {'tipo': 'estado-resultados'})
    assert response.status_code == 400
