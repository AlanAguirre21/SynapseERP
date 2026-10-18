"""`019`, "Actualización: el operador solo ve las facturas de sus ventas"."""

from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.facturacion.models import ComplementoPago, Factura
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta

URL = '/api/facturacion/'
URL_COMPLEMENTOS = '/api/facturacion/complementos-pago/'


def _usuario(nombre, rol='operador'):
    return Usuario.objects.create_user(
        username=nombre, email=f'{nombre}@flebosil.test', password='clave-segura-123', rol_usuario=rol,
    )


def _cliente_api(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def _factura(venta, usuario, metodo=Factura.METODO_PUE):
    return Factura.objects.create(
        venta=venta, usuario=usuario, uso_cfdi='G03', forma_pago='01', metodo_pago=metodo,
        estado=Factura.ESTADO_TIMBRADA, fecha_timbrado=timezone.now(),
    )


@pytest.fixture
def datos(db):
    sucursal = Sucursal.objects.create(nombre_sucursal='Matriz')
    ana = _usuario('ana')
    luis = _usuario('luis')
    admin = _usuario('admin1', rol='admin')
    venta_ana = Venta.objects.create(sucursal=sucursal, usuario=ana, total=Decimal('100.00'))
    venta_luis = Venta.objects.create(sucursal=sucursal, usuario=luis, total=Decimal('200.00'))
    # La factura sigue a su venta, aunque la haya generado otro usuario.
    propia = _factura(venta_ana, admin, metodo=Factura.METODO_PPD)
    ajena = _factura(venta_luis, luis, metodo=Factura.METODO_PPD)
    return {
        'ana': ana, 'luis': luis, 'admin': admin, 'venta_luis': venta_luis, 'propia': propia, 'ajena': ajena,
    }


def test_el_operador_solo_lista_las_facturas_de_sus_ventas(datos):
    respuesta = _cliente_api(datos['ana']).get(URL)

    assert [fila['id'] for fila in respuesta.data] == [datos['propia'].id]


@pytest.mark.parametrize('ruta', ['', 'descargar-xml/', 'descargar-pdf/'])
def test_una_factura_ajena_responde_404(datos, ruta):
    assert _cliente_api(datos['ana']).get(f'{URL}{datos["ajena"].id}/{ruta}').status_code == 404


def test_el_operador_no_puede_cancelar_una_factura_ajena(datos):
    respuesta = _cliente_api(datos['ana']).post(f'{URL}{datos["ajena"].id}/cancelar/', {'motivo': '02'}, format='json')

    assert respuesta.status_code == 404
    datos['ajena'].refresh_from_db()
    assert datos['ajena'].estado == Factura.ESTADO_TIMBRADA


def test_el_operador_no_puede_facturar_una_venta_ajena(datos):
    respuesta = _cliente_api(datos['ana']).post(URL, {
        'venta': datos['venta_luis'].id, 'uso_cfdi': 'G03', 'forma_pago': '01', 'metodo_pago': 'PUE',
    }, format='json')

    assert respuesta.status_code == 400
    assert respuesta.data['venta'] == ['No existe la venta indicada.']


def test_complementos_solo_de_facturas_de_ventas_propias(datos):
    hoy = timezone.localdate()
    ComplementoPago.objects.create(factura=datos['propia'], usuario=datos['admin'], monto_pagado='10.00', fecha_pago=hoy)
    ComplementoPago.objects.create(factura=datos['ajena'], usuario=datos['luis'], monto_pagado='20.00', fecha_pago=hoy)
    cliente = _cliente_api(datos['ana'])

    lista = cliente.get(URL_COMPLEMENTOS)
    sobre_ajena = cliente.post(URL_COMPLEMENTOS, {
        'factura': datos['ajena'].id, 'monto_pagado': '5.00', 'fecha_pago': hoy.isoformat(),
    }, format='json')

    assert [fila['factura'] for fila in lista.data] == [datos['propia'].id]
    assert sobre_ajena.status_code == 400
    assert sobre_ajena.data['factura'] == ['No existe la factura indicada.']


def test_el_admin_ve_todas_las_facturas(datos):
    respuesta = _cliente_api(datos['admin']).get(URL)

    assert {fila['id'] for fila in respuesta.data} == {datos['propia'].id, datos['ajena'].id}
