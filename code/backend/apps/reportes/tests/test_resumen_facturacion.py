"""Resumen facturación del Dashboard — `016`, "Actualización: Resumen
facturación con datos"."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.facturacion.models import ComplementoPago, Factura
from apps.sucursales.models import Sucursal
from apps.terceros.models import Cliente
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta

URL = '/api/reportes/facturacion/'


@pytest.fixture
def operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123',
    )


@pytest.fixture
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123', rol_usuario='admin',
    )


def _cliente_api(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def api(operador):
    return _cliente_api(operador)


@pytest.fixture
def sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


@pytest.fixture
def cliente(db):
    return Cliente.objects.create(nombre_cliente='Hospital Santa Rosa')


def _venta(sucursal, usuario, total, cliente=None, estado=Venta.ESTADO_ENTREGADA, fecha=None):
    venta = Venta.objects.create(sucursal=sucursal, usuario=usuario, cliente=cliente, total=total, estado=estado)
    if fecha is not None:
        Venta.objects.filter(pk=venta.pk).update(fecha=fecha)
    return venta


def _factura(venta, usuario, estado=Factura.ESTADO_TIMBRADA, metodo=Factura.METODO_PUE, timbrado='ahora', creada=None):
    ahora = timezone.localtime()
    factura = Factura.objects.create(
        venta=venta, usuario=usuario, uso_cfdi='G03', forma_pago='01', metodo_pago=metodo, estado=estado,
        fecha_timbrado=ahora if timbrado == 'ahora' else timbrado,
    )
    if creada is not None:
        Factura.objects.filter(pk=factura.pk).update(fecha_creacion=creada)
    return factura


def test_indicadores_solo_cuentan_facturas_vigentes_del_periodo(api, sucursal, operador, cliente):
    hace_dos_meses = timezone.localtime() - timedelta(days=62)
    _factura(_venta(sucursal, operador, '1000.00', cliente), operador)
    _factura(_venta(sucursal, operador, '500.00', cliente), operador, estado=Factura.ESTADO_PENDIENTE_CANCELACION)
    _factura(_venta(sucursal, operador, '300.00', cliente), operador, estado=Factura.ESTADO_CANCELADA)
    _factura(_venta(sucursal, operador, '200.00', cliente), operador, estado=Factura.ESTADO_ERROR, timbrado=None)
    # Timbrada fuera del periodo: no cuenta.
    _factura(_venta(sucursal, operador, '9999.00', cliente), operador, timbrado=hace_dos_meses)

    respuesta = api.get(URL, {'periodo': 'mes'})

    assert respuesta.status_code == 200
    assert respuesta.data['facturado_total'] == '1500.00'
    assert respuesta.data['facturas_emitidas'] == 2


def test_por_cobrar_ppd_descuenta_solo_complementos_timbrados(api, sucursal, operador, cliente):
    ppd = _factura(_venta(sucursal, operador, '1000.00', cliente), operador, metodo=Factura.METODO_PPD)
    ComplementoPago.objects.create(factura=ppd, usuario=operador, monto_pagado='300.00', fecha_pago=timezone.localdate())
    ComplementoPago.objects.create(
        factura=ppd, usuario=operador, monto_pagado='500.00', fecha_pago=timezone.localdate(),
        estado=ComplementoPago.ESTADO_ERROR,
    )
    # Una PUE no suma a "por cobrar".
    _factura(_venta(sucursal, operador, '400.00', cliente), operador)

    respuesta = api.get(URL, {'periodo': 'mes'})

    assert respuesta.data['por_cobrar_ppd'] == '700.00'


def test_porcentaje_facturado_por_importe_de_las_ventas_del_periodo(api, sucursal, operador, cliente):
    facturada = _venta(sucursal, operador, '750.00', cliente)
    _factura(facturada, operador)
    _venta(sucursal, operador, '250.00', cliente)
    # Cancelada: no cuenta como venta.
    _venta(sucursal, operador, '5000.00', cliente, estado=Venta.ESTADO_CANCELADA)

    respuesta = api.get(URL, {'periodo': 'mes'})

    assert respuesta.data['porcentaje_facturado'] == '75.0'


def test_porcentaje_facturado_es_null_sin_ventas(api):
    respuesta = api.get(URL, {'periodo': 'dia'})

    assert respuesta.data['porcentaje_facturado'] is None
    assert respuesta.data['facturado_total'] == '0.00'


def test_serie_separa_pue_y_ppd(api, sucursal, operador, cliente):
    _factura(_venta(sucursal, operador, '100.00', cliente), operador)
    _factura(_venta(sucursal, operador, '40.00', cliente), operador, metodo=Factura.METODO_PPD)

    respuesta = api.get(URL, {'periodo': 'año'})

    con_datos = [p for p in respuesta.data['serie'] if Decimal(p['total']) != 0]
    assert len(con_datos) == 1
    assert (con_datos[0]['pue'], con_datos[0]['ppd'], con_datos[0]['total']) == ('100.00', '40.00', '140.00')


def test_conteo_por_estado_usa_timbrado_o_creacion_y_trae_los_cinco(api, sucursal, operador, cliente):
    hace_dos_meses = timezone.localtime() - timedelta(days=62)
    _factura(_venta(sucursal, operador, '10.00', cliente), operador)
    _factura(_venta(sucursal, operador, '10.00', cliente), operador, estado=Factura.ESTADO_ERROR, timbrado=None)
    # Error creada hace dos meses: fuera del periodo para el conteo.
    _factura(
        _venta(sucursal, operador, '10.00', cliente), operador, estado=Factura.ESTADO_ERROR, timbrado=None,
        creada=hace_dos_meses,
    )

    respuesta = api.get(URL, {'periodo': 'mes'})

    conteo = {fila['tipo']: fila['cantidad'] for fila in respuesta.data['conteo_estado']}
    assert list(conteo) == ['Timbrada', 'Pendiente', 'Error', 'Pendiente de cancelación', 'Cancelada']
    assert conteo == {'Timbrada': 1, 'Pendiente': 0, 'Error': 1, 'Pendiente de cancelación': 0, 'Cancelada': 0}


def test_requiere_atencion_no_depende_del_periodo_y_se_limita_a_cinco(api, sucursal, operador, cliente):
    hace_dos_meses = timezone.localtime() - timedelta(days=62)
    antigua = _factura(
        _venta(sucursal, operador, '80.00', cliente), operador, estado=Factura.ESTADO_ERROR, timbrado=None,
        creada=hace_dos_meses,
    )
    for _ in range(5):
        _factura(_venta(sucursal, operador, '10.00', cliente), operador, estado=Factura.ESTADO_PENDIENTE_CANCELACION)
    _factura(_venta(sucursal, operador, '10.00', cliente), operador)  # timbrada: no requiere atención

    respuesta = api.get(URL, {'periodo': 'dia'})

    lista = respuesta.data['requiere_atencion']
    assert len(lista) == 5
    assert {fila['estado'] for fila in lista} == {'pendiente_cancelacion'}
    assert antigua.id not in [fila['id'] for fila in lista]  # la más antigua queda fuera del límite


def test_requiere_atencion_incluye_errores_antiguos(api, sucursal, operador, cliente):
    hace_dos_meses = timezone.localtime() - timedelta(days=62)
    error = _factura(
        _venta(sucursal, operador, '80.00', cliente), operador, estado=Factura.ESTADO_ERROR, timbrado=None,
        creada=hace_dos_meses,
    )

    respuesta = api.get(URL, {'periodo': 'dia'})

    assert respuesta.data['requiere_atencion'] == [{
        'id': error.id, 'serie': '', 'folio_interno': None, 'cliente': 'Hospital Santa Rosa', 'total': '80.00',
        'estado': 'error', 'fecha': respuesta.data['requiere_atencion'][0]['fecha'],
    }]


def test_disponible_para_ambos_roles_con_el_mismo_contenido(operador, admin):
    datos_operador = _cliente_api(operador).get(URL, {'periodo': 'mes'})
    datos_admin = _cliente_api(admin).get(URL, {'periodo': 'mes'})

    assert datos_operador.status_code == 200
    assert datos_admin.status_code == 200
    assert set(datos_operador.data) == set(datos_admin.data)


def test_sin_sesion_no_hay_acceso(db):
    assert APIClient().get(URL, {'periodo': 'mes'}).status_code == 401


def test_periodo_invalido(api):
    assert api.get(URL, {'periodo': 'siglo'}).status_code == 400
