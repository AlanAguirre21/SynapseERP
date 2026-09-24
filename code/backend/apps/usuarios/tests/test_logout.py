import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.usuarios.models import RegistroAcceso, Usuario


@pytest.fixture
def usuario(db):
    return Usuario.objects.create_user(
        username='ana', email='ana@flebosil.test', password='clave-super-123',
        rol_usuario='operador',
    )


@pytest.fixture
def tokens(usuario):
    refresh = RefreshToken.for_user(usuario)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


@pytest.fixture
def cliente_autenticado(usuario, tokens):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


@pytest.mark.django_db
def test_logout_invalida_el_refresh_token(cliente_autenticado, tokens):
    response = cliente_autenticado.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')
    assert response.status_code == 204

    # Un segundo refresh con el mismo token debe fallar: ya está en blacklist.
    cliente_sin_auth = APIClient()
    respuesta_refresh = cliente_sin_auth.post(
        '/api/token/refresh/', {'refresh': tokens['refresh']}, format='json',
    )
    assert respuesta_refresh.status_code == 401


@pytest.mark.django_db
def test_logout_registra_cierre_de_sesion(cliente_autenticado, tokens, usuario):
    cliente_autenticado.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')

    registro = RegistroAcceso.objects.get(usuario=usuario, tipo='cierre_sesion')
    assert registro.ip is not None


@pytest.mark.django_db
def test_logout_sin_refresh_no_falla_y_igual_registra(cliente_autenticado, usuario):
    response = cliente_autenticado.post('/api/auth/logout/', {}, format='json')
    assert response.status_code == 204
    assert RegistroAcceso.objects.filter(usuario=usuario, tipo='cierre_sesion').exists()


@pytest.mark.django_db
def test_logout_con_refresh_ya_invalido_no_rompe(cliente_autenticado, tokens):
    cliente_autenticado.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')

    # Un segundo logout con el mismo refresh (ya en blacklist) no debe romper.
    respuesta_segunda = cliente_autenticado.post(
        '/api/auth/logout/', {'refresh': tokens['refresh']}, format='json',
    )
    assert respuesta_segunda.status_code == 204


@pytest.mark.django_db
def test_logout_requiere_autenticacion():
    response = APIClient().post('/api/auth/logout/', {'refresh': 'lo-que-sea'}, format='json')
    assert response.status_code == 401
