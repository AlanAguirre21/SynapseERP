import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.usuarios.models import RegistroAcceso, Usuario


@pytest.fixture
def usuario_activo(db):
    return Usuario.objects.create_user(
        username='ana', email='ana@flebosil.test', password='clave-super-123',
        rol_usuario='operador',
    )


@pytest.fixture
def usuario_inactivo(db):
    usuario = Usuario.objects.create_user(
        username='ines', email='ines@flebosil.test', password='clave-super-123',
        rol_usuario='operador', is_active=False,
    )
    return usuario


@pytest.mark.django_db
def test_login_exitoso_devuelve_tokens(usuario_activo):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/login/',
        {'email': 'ana@flebosil.test', 'password': 'clave-super-123'},
        format='json',
    )

    assert response.status_code == 200
    assert 'access' in response.data
    assert 'refresh' in response.data

    registro = RegistroAcceso.objects.get(usuario=usuario_activo)
    assert registro.tipo == 'exitoso'
    assert registro.ip is not None


@pytest.mark.django_db
def test_login_password_incorrecta_mensaje_generico(usuario_activo):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/login/',
        {'email': 'ana@flebosil.test', 'password': 'incorrecta'},
        format='json',
    )

    assert response.status_code == 401
    assert response.data['detail'] == 'Correo o contraseña incorrectos.'

    registro = RegistroAcceso.objects.get(usuario=usuario_activo)
    assert registro.tipo == 'fallido'
    assert registro.email_intentado == ''


@pytest.mark.django_db
def test_login_email_inexistente_mismo_mensaje_generico(db):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/login/',
        {'email': 'no-existe@flebosil.test', 'password': 'lo-que-sea'},
        format='json',
    )

    assert response.status_code == 401
    assert response.data['detail'] == 'Correo o contraseña incorrectos.'

    registro = RegistroAcceso.objects.get(email_intentado='no-existe@flebosil.test')
    assert registro.tipo == 'fallido'
    assert registro.usuario is None


@pytest.mark.django_db
def test_login_usuario_inactivo_mensaje_especifico(usuario_inactivo):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/login/',
        {'email': 'ines@flebosil.test', 'password': 'clave-super-123'},
        format='json',
    )

    assert response.status_code == 401
    assert response.data['detail'] == 'Tu cuenta está inactiva. Contacta a un administrador.'

    registro = RegistroAcceso.objects.get(usuario=usuario_inactivo)
    assert registro.tipo == 'fallido'


@pytest.mark.django_db
def test_login_requiere_email_y_password(db):
    cache.clear()
    client = APIClient()
    response = client.post('/api/auth/login/', {}, format='json')

    assert response.status_code == 400
    assert 'email' in response.data
    assert 'password' in response.data


@pytest.mark.django_db
def test_login_aplica_throttling_tras_varios_intentos(usuario_activo):
    # El rate ('login': '5/min') queda fijo en la clase de throttle desde que
    # Django importa settings.py — no es reconfigurable en caliente vía el
    # fixture `settings` de pytest-django, así que la prueba usa el valor
    # real configurado en vez de simular uno distinto.
    cache.clear()
    client = APIClient()
    credenciales = {'email': 'ana@flebosil.test', 'password': 'incorrecta'}

    for _ in range(5):
        respuesta = client.post('/api/auth/login/', credenciales, format='json')
        assert respuesta.status_code == 401

    respuesta_bloqueada = client.post('/api/auth/login/', credenciales, format='json')
    assert respuesta_bloqueada.status_code == 429
