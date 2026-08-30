import pytest
from rest_framework.test import APIClient

from apps.configuracion_fiscal.crypto import descifrar
from apps.configuracion_fiscal.models import (
    ConfiguracionPAC,
    DatosFiscalesEmpresa,
    SerieFolio,
)
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


DATOS_FISCALES_COMPLETOS = {
    'rfc': 'FSI010101ABC',
    'razon_social': 'FleboSil S.A. de C.V.',
    'regimen_fiscal': '601',
    'codigo_postal_fiscal': '01000',
}


# --- Permisos: exclusivo de admin, incluida la lectura ---------------------


@pytest.mark.django_db
@pytest.mark.parametrize('ruta', ['/api/configuracion-fiscal/datos-empresa/', '/api/configuracion-fiscal/pac/', '/api/configuracion-fiscal/series/'])
def test_operador_no_puede_leer_configuracion_fiscal(operador_client, ruta):
    response = operador_client.get(ruta)
    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize('ruta', ['/api/configuracion-fiscal/datos-empresa/', '/api/configuracion-fiscal/pac/'])
def test_operador_no_puede_editar_configuracion_fiscal(operador_client, ruta):
    response = operador_client.patch(ruta, {}, format='json')
    assert response.status_code == 403


@pytest.mark.django_db
def test_operador_no_puede_crear_serie(operador_client):
    response = operador_client.post('/api/configuracion-fiscal/series/', {'serie': 'A'}, format='json')
    assert response.status_code == 403


@pytest.mark.django_db
def test_configuracion_fiscal_requiere_autenticacion():
    client = APIClient()
    response = client.get('/api/configuracion-fiscal/datos-empresa/')
    assert response.status_code == 401


# --- Datos fiscales de la empresa (singleton) -------------------------------


@pytest.mark.django_db
def test_admin_lee_datos_fiscales_vacios_como_incompletos(admin_client):
    response = admin_client.get('/api/configuracion-fiscal/datos-empresa/')
    assert response.status_code == 200
    assert response.data['rfc'] == ''
    assert response.data['completa'] is False


@pytest.mark.django_db
def test_admin_edita_datos_fiscales_y_quedan_completos(admin_client):
    response = admin_client.patch('/api/configuracion-fiscal/datos-empresa/', DATOS_FISCALES_COMPLETOS, format='json')
    assert response.status_code == 200
    assert response.data['completa'] is True

    assert DatosFiscalesEmpresa.objects.count() == 1
    datos = DatosFiscalesEmpresa.cargar()
    assert datos.rfc == 'FSI010101ABC'


@pytest.mark.django_db
def test_datos_fiscales_siguen_siendo_una_sola_fila_tras_varias_ediciones(admin_client):
    admin_client.patch('/api/configuracion-fiscal/datos-empresa/', {'rfc': 'AAA010101AAA'}, format='json')
    admin_client.patch('/api/configuracion-fiscal/datos-empresa/', {'rfc': 'BBB010101BBB'}, format='json')

    assert DatosFiscalesEmpresa.objects.count() == 1
    assert DatosFiscalesEmpresa.cargar().rfc == 'BBB010101BBB'


# --- Conexión al PAC (singleton, api_key cifrada) ---------------------------


@pytest.mark.django_db
def test_admin_lee_configuracion_pac_vacia_como_incompleta_y_sin_api_key(admin_client):
    response = admin_client.get('/api/configuracion-fiscal/pac/')
    assert response.status_code == 200
    assert response.data['completa'] is False
    assert response.data['api_key_configurada'] is False
    assert 'api_key' not in response.data


@pytest.mark.django_db
def test_admin_configura_pac_y_api_key_se_guarda_cifrada(admin_client):
    response = admin_client.patch(
        '/api/configuracion-fiscal/pac/',
        {'proveedor': 'Facturama', 'api_endpoint': 'https://api.facturama.mx', 'api_key': 'clave-secreta-del-pac'},
        format='json',
    )
    assert response.status_code == 200
    assert response.data['completa'] is True
    assert response.data['api_key_configurada'] is True
    assert 'api_key' not in response.data

    pac = ConfiguracionPAC.cargar()
    assert pac.api_key_cifrada != 'clave-secreta-del-pac'
    assert pac.api_key_cifrada != ''
    assert descifrar(pac.api_key_cifrada) == 'clave-secreta-del-pac'


@pytest.mark.django_db
def test_editar_pac_sin_enviar_api_key_conserva_la_credencial_guardada(admin_client):
    admin_client.patch(
        '/api/configuracion-fiscal/pac/', {'proveedor': 'Facturama', 'api_key': 'clave-original'}, format='json',
    )
    valor_cifrado_original = ConfiguracionPAC.cargar().api_key_cifrada

    response = admin_client.patch(
        '/api/configuracion-fiscal/pac/', {'proveedor': 'Facturama actualizado'}, format='json',
    )
    assert response.status_code == 200
    assert response.data['api_key_configurada'] is True

    pac = ConfiguracionPAC.cargar()
    assert pac.api_key_cifrada == valor_cifrado_original
    assert descifrar(pac.api_key_cifrada) == 'clave-original'
    assert pac.proveedor == 'Facturama actualizado'


# --- Series de folio ---------------------------------------------------


@pytest.mark.django_db
def test_admin_crea_serie(admin_client):
    response = admin_client.post(
        '/api/configuracion-fiscal/series/', {'serie': 'A', 'folio_actual': 1000}, format='json',
    )
    assert response.status_code == 201
    assert response.data['activo'] is True
    assert response.data['folio_actual'] == 1000


@pytest.mark.django_db
def test_no_se_puede_crear_dos_series_con_el_mismo_nombre(admin_client):
    admin_client.post('/api/configuracion-fiscal/series/', {'serie': 'A'}, format='json')
    response = admin_client.post('/api/configuracion-fiscal/series/', {'serie': 'A'}, format='json')

    assert response.status_code == 400
    assert response.data['serie'][0] == 'Ya existe una serie con ese nombre.'


@pytest.mark.django_db
def test_eliminar_serie_con_folios_usados_solo_la_desactiva_nunca_la_borra(admin_client):
    serie = SerieFolio.objects.create(serie='A', folio_actual=42)

    response = admin_client.delete(f'/api/configuracion-fiscal/series/{serie.id}/')
    assert response.status_code == 204

    serie.refresh_from_db()
    assert serie.activo is False
    assert SerieFolio.objects.filter(id=serie.id).exists()
    assert serie.folio_actual == 42


@pytest.mark.django_db
def test_reactivar_serie_desactivada(admin_client):
    serie = SerieFolio.objects.create(serie='A', activo=False)

    response = admin_client.post(f'/api/configuracion-fiscal/series/{serie.id}/reactivar/')
    assert response.status_code == 200

    serie.refresh_from_db()
    assert serie.activo is True


@pytest.mark.django_db
def test_reactivar_serie_ya_activa_es_rechazado(admin_client):
    serie = SerieFolio.objects.create(serie='A', activo=True)

    response = admin_client.post(f'/api/configuracion-fiscal/series/{serie.id}/reactivar/')
    assert response.status_code == 400
