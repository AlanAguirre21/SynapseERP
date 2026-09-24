from datetime import timedelta

import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.usuarios.models import CodigoRecuperacion, Usuario


@pytest.fixture
def usuario_activo(db):
    return Usuario.objects.create_user(
        username='ana', email='ana@flebosil.test', password='clave-super-123',
        rol_usuario='operador',
    )


@pytest.mark.django_db
def test_recuperar_correo_existente_envia_codigo(usuario_activo):
    cache.clear()
    client = APIClient()
    response = client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')

    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert CodigoRecuperacion.objects.filter(usuario=usuario_activo, usado=False).count() == 1


@pytest.mark.django_db
def test_recuperar_correo_inexistente_no_envia_correo(db):
    cache.clear()
    client = APIClient()
    response = client.post(
        '/api/auth/recuperar/', {'email': 'no-existe@flebosil.test'}, format='json',
    )

    assert response.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_recuperar_mensaje_identico_exista_o_no_el_correo(usuario_activo):
    cache.clear()
    client = APIClient()
    respuesta_existente = client.post(
        '/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json',
    )
    cache.clear()
    respuesta_inexistente = client.post(
        '/api/auth/recuperar/', {'email': 'no-existe@flebosil.test'}, format='json',
    )

    assert respuesta_existente.data == respuesta_inexistente.data


@pytest.mark.django_db
def test_recuperar_correo_incluye_version_html_con_marca_y_codigo(usuario_activo):
    cache.clear()
    client = APIClient()
    client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')

    registro = CodigoRecuperacion.objects.get(usuario=usuario_activo, usado=False)
    mensaje = mail.outbox[0]

    assert registro.codigo in mensaje.body

    tipos_alternativas = [tipo for _contenido, tipo in mensaje.alternatives]
    assert 'text/html' in tipos_alternativas

    html = next(contenido for contenido, tipo in mensaje.alternatives if tipo == 'text/html')
    assert registro.codigo in html
    assert 'cid:logo_synapse' in html

    assert len(mensaje.attachments) == 1
    assert mensaje.attachments[0].get('Content-ID') == '<logo_synapse>'


@pytest.mark.django_db
def test_reenviar_codigo_invalida_el_anterior(usuario_activo):
    cache.clear()
    client = APIClient()
    client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')
    codigo_anterior = CodigoRecuperacion.objects.get(usuario=usuario_activo, usado=False)

    client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')

    codigo_anterior.refresh_from_db()
    assert codigo_anterior.usado is True
    assert CodigoRecuperacion.objects.filter(usuario=usuario_activo, usado=False).count() == 1


@pytest.mark.django_db
def test_verificar_codigo_correcto(usuario_activo):
    cache.clear()
    client = APIClient()
    client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')
    registro = CodigoRecuperacion.objects.get(usuario=usuario_activo, usado=False)

    response = client.post(
        '/api/auth/verificar-codigo/',
        {'email': 'ana@flebosil.test', 'codigo': registro.codigo},
        format='json',
    )

    assert response.status_code == 200
    registro.refresh_from_db()
    assert registro.verificado is True


@pytest.mark.django_db
def test_verificar_codigo_incorrecto(usuario_activo):
    cache.clear()
    client = APIClient()
    client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')

    response = client.post(
        '/api/auth/verificar-codigo/',
        {'email': 'ana@flebosil.test', 'codigo': '000000'},
        format='json',
    )

    assert response.status_code == 401
    assert response.data['detail'] == 'Código inválido o expirado.'


@pytest.mark.django_db
def test_verificar_codigo_expirado(usuario_activo):
    cache.clear()
    client = APIClient()
    client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')
    registro = CodigoRecuperacion.objects.get(usuario=usuario_activo, usado=False)
    registro.expira_en = timezone.now() - timedelta(minutes=1)
    registro.save(update_fields=['expira_en'])

    response = client.post(
        '/api/auth/verificar-codigo/',
        {'email': 'ana@flebosil.test', 'codigo': registro.codigo},
        format='json',
    )

    assert response.status_code == 401
    assert response.data['detail'] == 'Código inválido o expirado.'


@pytest.mark.django_db
def test_throttling_recuperar_por_correo(usuario_activo):
    cache.clear()
    client = APIClient()
    for _ in range(3):
        respuesta = client.post(
            '/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json',
        )
        assert respuesta.status_code == 200

    respuesta_bloqueada = client.post(
        '/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json',
    )
    assert respuesta_bloqueada.status_code == 429


@pytest.mark.django_db
def test_throttling_verificar_codigo_por_correo(usuario_activo):
    cache.clear()
    client = APIClient()
    client.post('/api/auth/recuperar/', {'email': 'ana@flebosil.test'}, format='json')

    for _ in range(5):
        respuesta = client.post(
            '/api/auth/verificar-codigo/',
            {'email': 'ana@flebosil.test', 'codigo': '000000'},
            format='json',
        )
        assert respuesta.status_code == 401

    respuesta_bloqueada = client.post(
        '/api/auth/verificar-codigo/',
        {'email': 'ana@flebosil.test', 'codigo': '000000'},
        format='json',
    )
    assert respuesta_bloqueada.status_code == 429
