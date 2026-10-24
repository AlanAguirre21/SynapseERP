"""Dashboard con cifras propias para el operador — `016`, "Actualización:
cifras propias para el operador"."""

from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, Producto
from apps.compras.models import Compra, DetalleCompraProducto
from apps.facturacion.models import Factura
from apps.sucursales.models import Sucursal
from apps.terceros.models import Cliente, Proveedor
from apps.usuarios.models import Usuario
from apps.ventas.models import DetalleVenta, Venta


def _usuario(nombre, rol='operador'):
    return Usuario.objects.create_user(
        username=nombre, email=f'{nombre}@flebosil.test', password='clave-segura-123', rol_usuario=rol,
    )


def _api(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def datos(db):
    sucursal = Sucursal.objects.create(nombre_sucursal='Matriz')
    proveedor = Proveedor.objects.create(nombre_proveedor='Distribuidora Médica')
    categoria = Categoria.objects.create(nombre_categoria='Material', tipo='producto')
    producto = Producto.objects.create(
        nombre_producto='Gasa', sku='GASA-1', categoria=categoria, precio_venta='10.00', costo_produccion='5.00',
    )
    cliente_ana = Cliente.objects.create(nombre_cliente='Clínica de Ana')
    cliente_luis = Cliente.objects.create(nombre_cliente='Clínica de Luis')
    ana, luis, admin = _usuario('ana'), _usuario('luis'), _usuario('admin1', rol='admin')

    venta_ana = Venta.objects.create(sucursal=sucursal, usuario=ana, cliente=cliente_ana, total=Decimal('100.00'))
    venta_luis = Venta.objects.create(sucursal=sucursal, usuario=luis, cliente=cliente_luis, total=Decimal('300.00'))
    DetalleVenta.objects.create(venta=venta_ana, producto=producto, cantidad=2, precio_unitario='50.00', subtotal='100.00')
    DetalleVenta.objects.create(venta=venta_luis, producto=producto, cantidad=6, precio_unitario='50.00', subtotal='300.00')

    compra_ana = Compra.objects.create(proveedor=proveedor, sucursal=sucursal, usuario=ana, total=Decimal('40.00'))
    compra_luis = Compra.objects.create(proveedor=proveedor, sucursal=sucursal, usuario=luis, total=Decimal('60.00'))
    DetalleCompraProducto.objects.create(compra=compra_ana, producto=producto, cantidad=4, costo_unitario='10.00', subtotal='40.00')
    DetalleCompraProducto.objects.create(compra=compra_luis, producto=producto, cantidad=6, costo_unitario='10.00', subtotal='60.00')

    for venta, usuario in ((venta_ana, ana), (venta_luis, luis)):
        Factura.objects.create(
            venta=venta, usuario=usuario, uso_cfdi='G03', forma_pago='01', metodo_pago=Factura.METODO_PUE,
            estado=Factura.ESTADO_TIMBRADA, fecha_timbrado=timezone.now(),
        )
    Factura.objects.create(
        venta=venta_luis, usuario=luis, uso_cfdi='G03', forma_pago='01', metodo_pago=Factura.METODO_PUE,
        estado=Factura.ESTADO_ERROR,
    )
    return {'ana': ana, 'admin': admin}


def _suma(puntos, campo='monto'):
    return sum(Decimal(p[campo]) for p in puntos)


def test_resumen_totales_propios_para_el_operador_y_globales_para_el_admin(datos):
    del_operador = _api(datos['ana']).get('/api/reportes/resumen/', {'periodo': 'mes'}).data
    del_admin = _api(datos['admin']).get('/api/reportes/resumen/', {'periodo': 'mes'}).data

    assert (del_operador['ventas_total'], del_operador['compras_total']) == ('100.00', '40.00')
    assert (del_admin['ventas_total'], del_admin['compras_total']) == ('400.00', '100.00')


def test_resumen_de_ventas_propio(datos):
    del_operador = _api(datos['ana']).get('/api/reportes/ventas/', {'periodo': 'mes'}).data
    del_admin = _api(datos['admin']).get('/api/reportes/ventas/', {'periodo': 'mes'}).data

    assert _suma(del_operador['con_envio']) == Decimal('100.00')
    assert _suma(del_admin['con_envio']) == Decimal('400.00')
    assert sum(fila['cantidad'] for fila in del_operador['conteo_estado']) == 1


def test_resumen_de_compras_propio(datos):
    del_operador = _api(datos['ana']).get('/api/reportes/compras/', {'periodo': 'mes'}).data
    del_admin = _api(datos['admin']).get('/api/reportes/compras/', {'periodo': 'mes'}).data

    assert _suma(del_operador['todas']) == Decimal('40.00')
    assert _suma(del_admin['todas']) == Decimal('100.00')
    assert sum(fila['cantidad'] for fila in del_operador['conteo_estado']) == 1


def test_top_de_productos_propio(datos):
    del_operador = _api(datos['ana']).get('/api/reportes/productos-top/', {'periodo': 'mes'}).data
    del_admin = _api(datos['admin']).get('/api/reportes/productos-top/', {'periodo': 'mes'}).data

    assert del_operador == [{'producto': 'Gasa', 'cantidad': '2.00'}]
    assert del_admin == [{'producto': 'Gasa', 'cantidad': '8.00'}]


def test_top_de_clientes_propio(datos):
    del_operador = _api(datos['ana']).get('/api/reportes/clientes-top/', {'periodo': 'mes'}).data
    del_admin = _api(datos['admin']).get('/api/reportes/clientes-top/', {'periodo': 'mes'}).data

    assert del_operador == [{'cliente': 'Clínica de Ana', 'compras': 1}]
    assert {fila['cliente'] for fila in del_admin} == {'Clínica de Ana', 'Clínica de Luis'}


def test_resumen_de_facturacion_propio(datos):
    del_operador = _api(datos['ana']).get('/api/reportes/facturacion/', {'periodo': 'mes'}).data
    del_admin = _api(datos['admin']).get('/api/reportes/facturacion/', {'periodo': 'mes'}).data

    assert (del_operador['facturado_total'], del_operador['facturas_emitidas']) == ('100.00', 1)
    assert del_operador['porcentaje_facturado'] == '100.0'
    # La factura con error es de una venta de Luis: no requiere atención de Ana.
    assert del_operador['requiere_atencion'] == []
    assert (del_admin['facturado_total'], del_admin['facturas_emitidas']) == ('400.00', 2)
    assert len(del_admin['requiere_atencion']) == 1
