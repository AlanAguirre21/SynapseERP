import pytest
from rest_framework.test import APIClient

from apps.usuarios.models import Usuario


@pytest.fixture
def operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@flebosil.test', password='clave-segura-123',
        rol_usuario='operador',
    )


@pytest.fixture
def otro_operador(db):
    return Usuario.objects.create_user(
        username='operador2', email='operador2@flebosil.test', password='clave-segura-123',
        rol_usuario='operador',
    )


@pytest.fixture
def operador_client(operador):
    client = APIClient()
    client.force_authenticate(user=operador)
    return client


@pytest.mark.django_db
def test_usuario_edita_su_propio_username_y_email(operador_client, operador):
    response = operador_client.patch(
        '/api/usuarios/me/', {'username': 'nuevo_nombre', 'email': 'nuevo@flebosil.test'}, format='json',
    )
    assert response.status_code == 200
    assert response.data['username'] == 'nuevo_nombre'
    assert response.data['email'] == 'nuevo@flebosil.test'

    operador.refresh_from_db()
    assert operador.username == 'nuevo_nombre'
    assert operador.email == 'nuevo@flebosil.test'


@pytest.mark.django_db
def test_no_se_puede_modificar_rol_ni_activo_desde_este_endpoint(operador_client, operador):
    response = operador_client.patch(
        '/api/usuarios/me/', {'rol_usuario': 'admin', 'is_active': False}, format='json',
    )
    assert response.status_code == 200

    operador.refresh_from_db()
    assert operador.rol_usuario == 'operador'
    assert operador.is_active is True


@pytest.mark.django_db
def test_no_se_puede_editar_a_otro_usuario_enviando_su_id(operador_client, operador, otro_operador):
    response = operador_client.patch(
        '/api/usuarios/me/', {'id': otro_operador.id, 'username': 'intento_ajeno'}, format='json',
    )
    assert response.status_code == 200

    otro_operador.refresh_from_db()
    assert otro_operador.username == 'operador2'

    operador.refresh_from_db()
    assert operador.username == 'intento_ajeno'


@pytest.mark.django_db
def test_rechaza_email_ya_usado_por_otro_usuario(operador_client, otro_operador):
    response = operador_client.patch(
        '/api/usuarios/me/', {'email': otro_operador.email}, format='json',
    )
    assert response.status_code == 400
    assert response.data['email'][0] == 'Ya existe un usuario con ese correo electrónico.'


@pytest.mark.django_db
def test_rechaza_username_ya_usado_por_otro_usuario(operador_client, otro_operador):
    response = operador_client.patch(
        '/api/usuarios/me/', {'username': otro_operador.username}, format='json',
    )
    assert response.status_code == 400
    assert response.data['username'][0] == 'Ya existe un usuario con ese nombre de usuario.'


@pytest.mark.django_db
def test_guardar_sin_cambios_reales_no_es_rechazado_por_unicidad(operador_client, operador):
    response = operador_client.patch(
        '/api/usuarios/me/', {'username': operador.username, 'email': operador.email}, format='json',
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_usuario_no_autenticado_no_puede_editar_me(db):
    client = APIClient()
    response = client.patch('/api/usuarios/me/', {'username': 'x'}, format='json')
    assert response.status_code == 401
