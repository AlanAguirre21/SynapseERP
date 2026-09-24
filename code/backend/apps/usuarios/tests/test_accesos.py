import pytest
from rest_framework.test import APIClient

from apps.usuarios.models import RegistroAcceso, Usuario


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


def _crear_registros(usuario, cantidad):
    for _ in range(cantidad):
        RegistroAcceso.objects.create(usuario=usuario, tipo='exitoso', ip='127.0.0.1')


@pytest.mark.django_db
def test_accesos_default_devuelve_los_ultimos_5(admin_client, operador):
    _crear_registros(operador, 8)
    response = admin_client.get(f'/api/usuarios/{operador.id}/accesos/')
    assert response.status_code == 200
    assert len(response.data) == 5


@pytest.mark.django_db
def test_accesos_limite_10(admin_client, operador):
    _crear_registros(operador, 12)
    response = admin_client.get(f'/api/usuarios/{operador.id}/accesos/?limite=10')
    assert response.status_code == 200
    assert len(response.data) == 10


@pytest.mark.django_db
def test_accesos_limite_todos_pagina(admin_client, operador):
    _crear_registros(operador, 25)
    response = admin_client.get(f'/api/usuarios/{operador.id}/accesos/?limite=todos')
    assert response.status_code == 200
    assert response.data['count'] == 25
    assert len(response.data['results']) == 20


@pytest.mark.django_db
def test_accesos_orden_mas_reciente_primero(admin_client, operador):
    primero = RegistroAcceso.objects.create(usuario=operador, tipo='exitoso', ip='127.0.0.1')
    segundo = RegistroAcceso.objects.create(usuario=operador, tipo='cierre_sesion', ip='127.0.0.1')

    response = admin_client.get(f'/api/usuarios/{operador.id}/accesos/')
    assert response.data[0]['id'] == segundo.id
    assert response.data[1]['id'] == primero.id


@pytest.mark.django_db
def test_accesos_no_muestra_intentos_sin_usuario_vinculado(admin_client, operador):
    RegistroAcceso.objects.create(usuario=None, tipo='fallido', email_intentado='no-existe@flebosil.test')
    _crear_registros(operador, 2)

    response = admin_client.get(f'/api/usuarios/{operador.id}/accesos/?limite=todos')
    assert response.data['count'] == 2


@pytest.mark.django_db
def test_operador_no_puede_ver_accesos_de_nadie(operador_client, admin):
    response = operador_client.get(f'/api/usuarios/{admin.id}/accesos/')
    assert response.status_code == 403
