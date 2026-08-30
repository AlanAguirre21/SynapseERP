import base64
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, Producto
from apps.configuracion_fiscal.models import SerieFolio
from apps.facturacion.models import ComplementoPago, Factura
from apps.inventario.models import InventarioSucursalProducto
from apps.personas.models import Cliente, DatosFiscalesCliente
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta

PDF_DE_PRUEBA = base64.b64encode(b'%PDF-1.4 contenido de prueba').decode()


@pytest.fixture(autouse=True)
def media_root_temporal(settings, tmp_path):
    # Evita que los tests escriban XML/PDF reales dentro del repositorio.
    settings.MEDIA_ROOT = str(tmp_path)


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
def cliente_con_fiscales(db):
    cliente = Cliente.objects.create(nombre_cliente='Hospital San Rafael')
    DatosFiscalesCliente.objects.create(
        cliente=cliente, rfc='HSR850101AA1', razon_social='Hospital San Rafael SA de CV',
        codigo_postal_fiscal='64000', regimen_fiscal='601', uso_cfdi_default='G03', requiere_factura=True,
    )
    return cliente


@pytest.fixture
def cliente_sin_fiscales(db):
    return Cliente.objects.create(nombre_cliente='Cliente mostrador')


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-FACT-1', unidad_medida='pza',
        categoria=categoria, precio_venta='45.00',
    )


@pytest.fixture
def stock(sucursal, producto):
    return InventarioSucursalProducto.objects.create(
        sucursal=sucursal, producto=producto, stock_actual='100.00', stock_minimo='10.00',
    )


@pytest.fixture
def serie_folio(db):
    return SerieFolio.objects.create(serie='A', folio_actual=0, activo=True)


def _crear_venta(api_client, sucursal, producto, cliente=None, cantidad='2.00'):
    payload = {'sucursal': sucursal.id, 'detalles': [{'producto': producto.id, 'cantidad': cantidad}]}
    if cliente is not None:
        payload['cliente'] = cliente.id
    response = api_client.post('/api/ventas/', payload, format='json')
    assert response.status_code == 201, response.data
    return Venta.objects.get(id=response.data['id'])


def _payload_factura(venta, uso_cfdi='G03', forma_pago='03', metodo_pago='PUE'):
    return {'venta': venta.id, 'uso_cfdi': uso_cfdi, 'forma_pago': forma_pago, 'metodo_pago': metodo_pago}


def _mock_pac(respuesta_timbrar=None, respuesta_cancelar=None, respuesta_complemento=None):
    cliente_falso = MagicMock()
    cliente_falso.timbrar.return_value = respuesta_timbrar if respuesta_timbrar is not None else {
        'exito': True, 'folio_fiscal': 'uuid-timbrado-test', 'xml': '<cfdi>prueba</cfdi>', 'pdf_base64': PDF_DE_PRUEBA,
    }
    cliente_falso.cancelar.return_value = respuesta_cancelar if respuesta_cancelar is not None else {'exito': True}
    cliente_falso.timbrar_complemento_pago.return_value = (
        respuesta_complemento if respuesta_complemento is not None else {'exito': True, 'folio_fiscal': 'uuid-rep-test'}
    )
    return patch('apps.facturacion.views.PACClient', return_value=cliente_falso), cliente_falso


# --- Generación (timbrado) -------------------------------------------------


@pytest.mark.django_db
def test_generar_factura_exitosa_queda_timbrada(api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()

    with parche:
        response = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    assert response.status_code == 201, response.data
    assert response.data['estado'] == 'timbrada'
    assert response.data['folio_fiscal'] == 'uuid-timbrado-test'
    assert response.data['serie'] == 'A'
    assert response.data['folio_interno'] == 1
    assert response.data['cliente_nombre'] == 'Hospital San Rafael'

    factura = Factura.objects.get(id=response.data['id'])
    assert factura.xml_path
    assert factura.pdf_path
    assert factura.fecha_timbrado is not None

    serie_folio.refresh_from_db()
    assert serie_folio.folio_actual == 1


@pytest.mark.django_db
def test_generar_factura_rechaza_venta_sin_cliente(api_client, sucursal, producto, stock):
    venta = _crear_venta(api_client, sucursal, producto, cliente=None)

    response = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    assert response.status_code == 400
    assert 'datos fiscales' in str(response.data).lower()
    assert not Factura.objects.exists()


@pytest.mark.django_db
def test_generar_factura_rechaza_cliente_sin_datos_fiscales_completos(
    api_client, sucursal, producto, stock, cliente_sin_fiscales,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_sin_fiscales)

    response = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    assert response.status_code == 400
    assert not Factura.objects.exists()


@pytest.mark.django_db
def test_generar_factura_rechaza_venta_cancelada(api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    api_client.post(f'/api/ventas/{venta.id}/cancelar/')

    response = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    assert response.status_code == 400
    assert not Factura.objects.exists()


@pytest.mark.django_db
def test_generar_factura_sin_serie_activa_es_rechazada(api_client, sucursal, producto, stock, cliente_con_fiscales):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)

    response = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    assert response.status_code == 400
    assert 'serie' in str(response.data).lower()


@pytest.mark.django_db
def test_generar_factura_con_error_del_pac_queda_en_estado_error_sin_bloquear_reintento(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche_error, _ = _mock_pac(respuesta_timbrar={'exito': False, 'error': 'RFC del receptor no válido.'})

    with parche_error:
        response = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    assert response.status_code == 201
    assert response.data['estado'] == 'error'
    assert 'RFC' in response.data['mensaje_error']
    assert Factura.objects.count() == 1

    serie_folio.refresh_from_db()
    assert serie_folio.folio_actual == 0  # el folio nunca se consume en un intento fallido

    id_factura = response.data['id']
    parche_exito, _ = _mock_pac()
    with parche_exito:
        reintento = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    assert reintento.status_code == 200
    assert reintento.data['id'] == id_factura  # reutiliza la misma fila, no crea una segunda
    assert reintento.data['estado'] == 'timbrada'
    assert Factura.objects.count() == 1


@pytest.mark.django_db
def test_no_permite_dos_facturas_vigentes_para_la_misma_venta(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()

    with parche:
        primera = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')
    assert primera.status_code == 201

    segunda = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')
    assert segunda.status_code == 400
    assert Factura.objects.count() == 1


@pytest.mark.django_db
def test_generar_factura_requiere_autenticacion(sucursal, producto, stock, cliente_con_fiscales, serie_folio):
    client = APIClient()
    response = client.post('/api/facturacion/', {'venta': 1, 'uso_cfdi': 'G03', 'forma_pago': '03', 'metodo_pago': 'PUE'}, format='json')
    assert response.status_code == 401


@pytest.mark.django_db
def test_no_permite_editar_ni_borrar_una_factura(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()
    with parche:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')
    id_factura = creada.data['id']

    assert api_client.put(f'/api/facturacion/{id_factura}/', {}, format='json').status_code == 405
    assert api_client.patch(f'/api/facturacion/{id_factura}/', {}, format='json').status_code == 405
    assert api_client.delete(f'/api/facturacion/{id_factura}/').status_code == 405


# --- Descarga de XML/PDF ---------------------------------------------------


@pytest.mark.django_db
def test_descargar_xml_y_pdf_de_una_factura_timbrada(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()
    with parche:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')
    id_factura = creada.data['id']

    xml_response = api_client.get(f'/api/facturacion/{id_factura}/descargar-xml/')
    assert xml_response.status_code == 200
    assert b''.join(xml_response.streaming_content) == b'<cfdi>prueba</cfdi>'

    pdf_response = api_client.get(f'/api/facturacion/{id_factura}/descargar-pdf/')
    assert pdf_response.status_code == 200
    assert b''.join(pdf_response.streaming_content).startswith(b'%PDF')


@pytest.mark.django_db
def test_descargar_archivo_de_factura_sin_pdf_da_404(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche_error, _ = _mock_pac(respuesta_timbrar={'exito': False, 'error': 'Servicio no disponible.'})
    with parche_error:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    response = api_client.get(f'/api/facturacion/{creada.data["id"]}/descargar-pdf/')
    assert response.status_code == 404


# --- Cancelación ------------------------------------------------------------


@pytest.mark.django_db
def test_cancelar_factura_timbrada_queda_pendiente_de_cancelacion(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()
    with parche:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')
    id_factura = creada.data['id']

    with parche:
        response = api_client.post(
            f'/api/facturacion/{id_factura}/cancelar/', {'motivo_cancelacion': '02'}, format='json',
        )

    assert response.status_code == 200
    assert response.data['estado'] == 'pendiente_cancelacion'
    assert response.data['motivo_cancelacion'] == '02'

    factura = Factura.objects.get(id=id_factura)
    assert factura.fecha_solicitud_cancelacion is not None


@pytest.mark.django_db
def test_cancelar_factura_con_motivo_invalido_es_rechazado(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()
    with parche:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    response = api_client.post(
        f'/api/facturacion/{creada.data["id"]}/cancelar/', {'motivo_cancelacion': '99'}, format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_cancelar_factura_no_timbrada_es_rechazado(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche_error, _ = _mock_pac(respuesta_timbrar={'exito': False, 'error': 'x'})
    with parche_error:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')

    response = api_client.post(
        f'/api/facturacion/{creada.data["id"]}/cancelar/', {'motivo_cancelacion': '02'}, format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_facturas_pendientes_de_cancelacion_vencen_tras_72_horas(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()
    with parche:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta), format='json')
    with parche:
        api_client.post(f'/api/facturacion/{creada.data["id"]}/cancelar/', {'motivo_cancelacion': '03'}, format='json')

    factura = Factura.objects.get(id=creada.data['id'])
    factura.fecha_solicitud_cancelacion = timezone.now() - timedelta(hours=73)
    factura.save(update_fields=['fecha_solicitud_cancelacion'])

    response = api_client.get('/api/facturacion/')

    assert response.status_code == 200
    encontrada = next(f for f in response.data if f['id'] == factura.id)
    assert encontrada['estado'] == 'cancelada'


# --- Complemento de pago -----------------------------------------------------


@pytest.mark.django_db
def test_registrar_complemento_pago_para_factura_ppd(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()
    with parche:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta, metodo_pago='PPD'), format='json')

    with parche:
        response = api_client.post(
            '/api/facturacion/complementos-pago/',
            {'factura': creada.data['id'], 'monto_pagado': '90.00', 'fecha_pago': '2026-08-25'},
            format='json',
        )

    assert response.status_code == 201, response.data
    assert response.data['estado'] == 'timbrada'
    assert response.data['folio_fiscal_rep'] == 'uuid-rep-test'
    assert ComplementoPago.objects.count() == 1


@pytest.mark.django_db
def test_complemento_pago_rechazado_si_metodo_no_es_ppd(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche, _ = _mock_pac()
    with parche:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta, metodo_pago='PUE'), format='json')

    response = api_client.post(
        '/api/facturacion/complementos-pago/',
        {'factura': creada.data['id'], 'monto_pagado': '90.00', 'fecha_pago': '2026-08-25'},
        format='json',
    )
    assert response.status_code == 400
    assert not ComplementoPago.objects.exists()


@pytest.mark.django_db
def test_complemento_pago_rechazado_si_factura_no_esta_timbrada(
    api_client, sucursal, producto, stock, cliente_con_fiscales, serie_folio,
):
    venta = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales)
    parche_error, _ = _mock_pac(respuesta_timbrar={'exito': False, 'error': 'x'})
    with parche_error:
        creada = api_client.post('/api/facturacion/', _payload_factura(venta, metodo_pago='PPD'), format='json')

    response = api_client.post(
        '/api/facturacion/complementos-pago/',
        {'factura': creada.data['id'], 'monto_pagado': '90.00', 'fecha_pago': '2026-08-25'},
        format='json',
    )
    assert response.status_code == 400
    assert not ComplementoPago.objects.exists()


# --- Listado / filtros --------------------------------------------------


@pytest.mark.django_db
def test_lista_facturas_filtra_por_estado_y_cliente(
    api_client, sucursal, producto, stock, cliente_con_fiscales, cliente_sin_fiscales, serie_folio,
):
    InventarioSucursalProducto.objects.filter(sucursal=sucursal, producto=producto).update(stock_actual='100.00')
    venta_1 = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales, cantidad='1.00')
    venta_2 = _crear_venta(api_client, sucursal, producto, cliente=cliente_con_fiscales, cantidad='1.00')

    parche_exito, _ = _mock_pac()
    with parche_exito:
        api_client.post('/api/facturacion/', _payload_factura(venta_1), format='json')

    parche_error, _ = _mock_pac(respuesta_timbrar={'exito': False, 'error': 'x'})
    with parche_error:
        api_client.post('/api/facturacion/', _payload_factura(venta_2), format='json')

    respuesta_timbrada = api_client.get('/api/facturacion/', {'estado': 'timbrada'})
    assert len(respuesta_timbrada.data) == 1

    respuesta_cliente = api_client.get('/api/facturacion/', {'cliente': cliente_con_fiscales.id})
    assert len(respuesta_cliente.data) == 2

    respuesta_otro_cliente = api_client.get('/api/facturacion/', {'cliente': cliente_sin_fiscales.id})
    assert len(respuesta_otro_cliente.data) == 0
