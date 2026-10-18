"""Fotografía de perfil — 017 · Información de Usuario ("Actualización:
fotografía de perfil") y 010 · Usuarios ("Actualización: fotografía del
usuario")."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.usuarios.models import Usuario


@pytest.fixture(autouse=True)
def carpeta_fotos(settings, tmp_path):
    # Ningún test escribe en la carpeta real de desarrollo.
    settings.USUARIOS_FOTOS_ROOT = tmp_path
    return tmp_path


def _imagen(formato='PNG', nombre='foto.png', tamano=(8, 8)):
    buffer = io.BytesIO()
    Image.new('RGB', tamano, color=(166, 41, 95)).save(buffer, format=formato)
    return SimpleUploadedFile(nombre, buffer.getvalue(), content_type=f'image/{formato.lower()}')


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
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@flebosil.test', password='clave-segura-123',
        rol_usuario='admin',
    )


def _cliente(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


# --- Propia (017) ---------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_subir_foto_propia_devuelve_url_y_guarda_con_nombre_aleatorio(operador, carpeta_fotos):
    respuesta = _cliente(operador).patch('/api/usuarios/me/', {'foto_usuario': _imagen()}, format='multipart')

    assert respuesta.status_code == 200
    assert respuesta.data['foto_usuario'].startswith('http://testserver/fotos-usuarios/')
    operador.refresh_from_db()
    assert operador.foto_usuario.name != 'foto.png'
    assert operador.foto_usuario.name.endswith('.png')
    assert (carpeta_fotos / operador.foto_usuario.name).exists()


@pytest.mark.django_db(transaction=True)
def test_reemplazar_foto_borra_el_archivo_anterior(operador, carpeta_fotos):
    client = _cliente(operador)
    client.patch('/api/usuarios/me/', {'foto_usuario': _imagen()}, format='multipart')
    operador.refresh_from_db()
    anterior = operador.foto_usuario.name

    client.patch('/api/usuarios/me/', {'foto_usuario': _imagen('JPEG', 'nueva.jpg')}, format='multipart')
    operador.refresh_from_db()

    assert operador.foto_usuario.name != anterior
    assert not (carpeta_fotos / anterior).exists()
    assert (carpeta_fotos / operador.foto_usuario.name).exists()


@pytest.mark.django_db(transaction=True)
def test_quitar_foto_con_null_borra_el_archivo(operador, carpeta_fotos):
    client = _cliente(operador)
    client.patch('/api/usuarios/me/', {'foto_usuario': _imagen()}, format='multipart')
    operador.refresh_from_db()
    anterior = operador.foto_usuario.name

    respuesta = client.patch('/api/usuarios/me/', {'foto_usuario': None}, format='json')

    assert respuesta.status_code == 200
    assert respuesta.data['foto_usuario'] is None
    operador.refresh_from_db()
    assert not operador.foto_usuario
    assert not (carpeta_fotos / anterior).exists()


def test_editar_otros_datos_no_toca_la_foto(operador):
    client = _cliente(operador)
    client.patch('/api/usuarios/me/', {'foto_usuario': _imagen()}, format='multipart')
    operador.refresh_from_db()
    foto = operador.foto_usuario.name

    respuesta = client.patch('/api/usuarios/me/', {'first_name': 'Ana'}, format='json')

    assert respuesta.status_code == 200
    operador.refresh_from_db()
    assert operador.foto_usuario.name == foto


def test_rechaza_formato_no_permitido(operador):
    respuesta = _cliente(operador).patch(
        '/api/usuarios/me/', {'foto_usuario': _imagen('GIF', 'foto.gif')}, format='multipart',
    )

    assert respuesta.status_code == 400
    assert respuesta.data['foto_usuario'] == ['La fotografía debe ser JPG, PNG o WebP.']


def test_rechaza_archivo_que_no_es_imagen_aunque_tenga_extension_de_imagen(operador):
    falso = SimpleUploadedFile('foto.png', b'esto no es una imagen', content_type='image/png')

    respuesta = _cliente(operador).patch('/api/usuarios/me/', {'foto_usuario': falso}, format='multipart')

    assert respuesta.status_code == 400
    assert respuesta.data['foto_usuario'] == ['La fotografía debe ser JPG, PNG o WebP.']


def test_rechaza_foto_de_mas_de_2_mb(operador):
    # BMP sin compresión para superar 2 MB sin depender del compresor; el
    # tamaño se valida antes que el formato.
    grande = _imagen('BMP', 'grande.bmp', tamano=(1000, 1000))
    assert grande.size > 2 * 1024 * 1024

    respuesta = _cliente(operador).patch('/api/usuarios/me/', {'foto_usuario': grande}, format='multipart')

    assert respuesta.status_code == 400
    assert respuesta.data['foto_usuario'] == ['La fotografía no puede pesar más de 2 MB.']


def test_get_me_devuelve_foto_o_null(operador):
    client = _cliente(operador)
    assert client.get('/api/usuarios/me/').data['foto_usuario'] is None

    client.patch('/api/usuarios/me/', {'foto_usuario': _imagen()}, format='multipart')

    assert client.get('/api/usuarios/me/').data['foto_usuario'].startswith('http://testserver/fotos-usuarios/')


def test_me_solo_cambia_la_foto_propia(operador, otro_operador):
    _cliente(operador).patch(
        '/api/usuarios/me/', {'id': otro_operador.id, 'foto_usuario': _imagen()}, format='multipart',
    )

    operador.refresh_from_db()
    otro_operador.refresh_from_db()
    assert operador.foto_usuario
    assert not otro_operador.foto_usuario


# --- Administración (010) -------------------------------------------------------


def test_admin_crea_usuario_con_foto(admin):
    respuesta = _cliente(admin).post('/api/usuarios/', {
        'email': 'nuevo@flebosil.test', 'first_name': 'Nuevo', 'last_name': 'Usuario',
        'rol_usuario': 'operador', 'password': 'Clave-segura-123', 'foto_usuario': _imagen(),
    }, format='multipart')

    assert respuesta.status_code == 201
    assert respuesta.data['foto_usuario'].startswith('http://testserver/fotos-usuarios/')


@pytest.mark.django_db(transaction=True)
def test_admin_reemplaza_y_quita_la_foto_de_otro_usuario(admin, operador, carpeta_fotos):
    client = _cliente(admin)
    client.patch(f'/api/usuarios/{operador.id}/', {'foto_usuario': _imagen()}, format='multipart')
    operador.refresh_from_db()
    anterior = operador.foto_usuario.name

    client.patch(f'/api/usuarios/{operador.id}/', {'foto_usuario': _imagen('WEBP', 'nueva.webp')}, format='multipart')
    operador.refresh_from_db()
    assert operador.foto_usuario.name.endswith('.webp')
    assert not (carpeta_fotos / anterior).exists()

    respuesta = client.patch(f'/api/usuarios/{operador.id}/', {'foto_usuario': None}, format='json')
    assert respuesta.status_code == 200
    assert respuesta.data['foto_usuario'] is None


def test_admin_recibe_las_mismas_validaciones(admin, operador):
    respuesta = _cliente(admin).patch(
        f'/api/usuarios/{operador.id}/', {'foto_usuario': _imagen('GIF', 'foto.gif')}, format='multipart',
    )

    assert respuesta.status_code == 400
    assert respuesta.data['foto_usuario'] == ['La fotografía debe ser JPG, PNG o WebP.']


def test_lista_de_usuarios_incluye_la_foto(admin, operador):
    client = _cliente(admin)
    client.patch(f'/api/usuarios/{operador.id}/', {'foto_usuario': _imagen()}, format='multipart')

    filas = {fila['id']: fila for fila in client.get('/api/usuarios/').data}

    assert filas[operador.id]['foto_usuario'].startswith('http://testserver/fotos-usuarios/')
    assert filas[admin.id]['foto_usuario'] is None


def test_operador_no_puede_cambiar_la_foto_de_otro_usuario(operador, otro_operador):
    respuesta = _cliente(operador).patch(
        f'/api/usuarios/{otro_operador.id}/', {'foto_usuario': _imagen()}, format='multipart',
    )

    assert respuesta.status_code == 403
    otro_operador.refresh_from_db()
    assert not otro_operador.foto_usuario
