from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.usuarios.models import CodigoRecuperacion, Usuario


@pytest.fixture
def usuario_activo(db):
    return Usuario.objects.create_user(
        username='ana', email='ana@flebosil.test', password='clave-vieja-123',
        rol_usuario='operador',
    )


@pytest.fixture
def codigo_verificado(usuario_activo):
    return CodigoRecuperacion.objects.create(
        usuario=usuario_activo,
        codigo='123456',
        expira_en=timezone.now() + timedelta(minutes=10),
        verificado=True,
    )


@pytest.mark.django_db
def test_cambiar_contrasena_exitoso(usuario_activo, codigo_verificado):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': 'clave-nueva-456',
            'password_confirmacion': 'clave-nueva-456',
        },
        format='json',
    )

    assert response.status_code == 200
    assert 'access' in response.data
    assert 'refresh' in response.data

    usuario_activo.refresh_from_db()
    assert usuario_activo.check_password('clave-nueva-456')

    codigo_verificado.refresh_from_db()
    assert codigo_verificado.usado is True


@pytest.mark.django_db
def test_cambiar_contrasena_no_coincide_confirmacion(usuario_activo, codigo_verificado):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': 'clave-nueva-456',
            'password_confirmacion': 'otra-cosa-789',
        },
        format='json',
    )

    assert response.status_code == 400
    assert 'password_confirmacion' in response.data

    codigo_verificado.refresh_from_db()
    assert codigo_verificado.usado is False


@pytest.mark.django_db
def test_cambiar_contrasena_sin_verificacion_previa(usuario_activo):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': 'clave-nueva-456',
            'password_confirmacion': 'clave-nueva-456',
        },
        format='json',
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_cambiar_contrasena_codigo_expirado(usuario_activo, codigo_verificado):
    cache.clear()
    codigo_verificado.expira_en = timezone.now() - timedelta(minutes=1)
    codigo_verificado.save(update_fields=['expira_en'])

    client = APIClient()
    response = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': 'clave-nueva-456',
            'password_confirmacion': 'clave-nueva-456',
        },
        format='json',
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_cambiar_contrasena_igual_a_la_anterior(usuario_activo, codigo_verificado):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': 'clave-vieja-123',
            'password_confirmacion': 'clave-vieja-123',
        },
        format='json',
    )

    assert response.status_code == 400
    assert 'password' in response.data


@pytest.mark.django_db
def test_cambiar_contrasena_no_cumple_requisitos_minimos(usuario_activo, codigo_verificado):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': '123',
            'password_confirmacion': '123',
        },
        format='json',
    )

    assert response.status_code == 400
    assert 'password' in response.data


@pytest.mark.django_db
def test_cambiar_contrasena_no_reutiliza_el_mismo_codigo(usuario_activo, codigo_verificado):
    cache.clear()
    client = APIClient()
    primera = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': 'clave-nueva-456',
            'password_confirmacion': 'clave-nueva-456',
        },
        format='json',
    )
    assert primera.status_code == 200

    segunda = client.post(
        '/api/auth/cambiar-contrasena/',
        {
            'email': 'ana@flebosil.test',
            'password': 'otra-clave-789',
            'password_confirmacion': 'otra-clave-789',
        },
        format='json',
    )
    assert segunda.status_code == 401
