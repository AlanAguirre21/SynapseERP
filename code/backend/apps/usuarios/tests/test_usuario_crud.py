import pytest
from rest_framework.test import APIClient

from apps.usuarios.models import Usuario


@pytest.fixture
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123',
        rol_usuario='admin',
    )


@pytest.fixture
def operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123',
        rol_usuario='operador',
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


@pytest.mark.django_db
def test_operador_puede_listar_usuarios(operador_client, admin):
    response = operador_client.get('/api/usuarios/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_operador_no_puede_crear_usuario(operador_client):
    response = operador_client.post(
        '/api/usuarios/',
        {'email': 'nuevo@flebosil.test', 'password': 'clave-super-123', 'rol_usuario': 'operador'},
        format='json',
    )
    assert response.status_code == 403
    assert not Usuario.objects.filter(email='nuevo@flebosil.test').exists()


@pytest.mark.django_db
def test_admin_crea_usuario_con_password_hasheado(admin_client):
    response = admin_client.post(
        '/api/usuarios/',
        {'email': 'nuevo@flebosil.test', 'password': 'clave-super-123', 'rol_usuario': 'operador'},
        format='json',
    )
    assert response.status_code == 201
    assert 'password' not in response.data

    usuario = Usuario.objects.get(email='nuevo@flebosil.test')
    assert usuario.password != 'clave-super-123'
    assert usuario.check_password('clave-super-123')


@pytest.mark.django_db
def test_crear_usuario_sin_password_es_rechazado(admin_client):
    response = admin_client.post(
        '/api/usuarios/', {'email': 'sinpass@flebosil.test', 'rol_usuario': 'operador'}, format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_editar_usuario_no_permite_cambiar_password_desde_este_endpoint(admin_client, operador):
    contrasena_original = operador.password

    response = admin_client.patch(
        f'/api/usuarios/{operador.id}/', {'password': 'otra-clave-distinta'}, format='json',
    )
    assert response.status_code == 200

    operador.refresh_from_db()
    assert operador.password == contrasena_original


@pytest.mark.django_db
def test_admin_desactiva_usuario_sin_borrado_fisico(admin_client, operador):
    response = admin_client.delete(f'/api/usuarios/{operador.id}/')
    assert response.status_code == 204

    operador.refresh_from_db()
    assert operador.is_active is False
    assert Usuario.objects.filter(id=operador.id).exists()


@pytest.mark.django_db
def test_usuario_desactivado_pierde_acceso_de_inmediato_aunque_el_token_siga_vigente(admin_client, operador):
    """El JWT de `operador` sigue siendo criptográficamente válido tras la
    desactivación — lo que debe fallar es la autenticación en la siguiente
    petición, no el token en sí (ver `SIMPLE_JWT`/`JWTAuthentication`, que
    valida `is_active` en cada request, no solo en login). Por eso esta
    prueba usa un JWT real vía `credentials()` en vez de
    `force_authenticate`, que se saltaría esa validación.
    """
    from rest_framework_simplejwt.tokens import RefreshToken

    access_token = str(RefreshToken.for_user(operador).access_token)
    cliente_del_operador = APIClient()
    cliente_del_operador.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

    respuesta_antes = cliente_del_operador.get('/api/usuarios/me/')
    assert respuesta_antes.status_code == 200

    admin_client.delete(f'/api/usuarios/{operador.id}/')

    respuesta_despues = cliente_del_operador.get('/api/usuarios/me/')
    assert respuesta_despues.status_code == 401
