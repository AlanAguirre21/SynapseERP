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
def test_operador_no_puede_listar_usuarios(operador_client, admin):
    """A diferencia de otras entidades (`LecturaParaTodosEscrituraSoloAdmin`),
    Usuarios es admin-only también en lectura — ver `spec.md`."""
    response = operador_client.get('/api/usuarios/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_operador_no_puede_leer_un_usuario_puntual(operador_client, admin):
    response = operador_client.get(f'/api/usuarios/{admin.id}/')
    assert response.status_code == 403


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
def test_admin_no_puede_desactivarse_a_si_mismo(admin_client, admin):
    response = admin_client.delete(f'/api/usuarios/{admin.id}/')
    assert response.status_code == 400
    assert response.data['detail'] == 'No puedes desactivar tu propia cuenta.'

    admin.refresh_from_db()
    assert admin.is_active is True


@pytest.mark.django_db
def test_no_se_puede_desactivar_al_ultimo_admin_activo(admin):
    """La guarda de "último admin" (`UsuarioViewSet._error_no_desactivable`)
    solo es alcanzable en la práctica cuando el actor y el objetivo son la
    misma cuenta: `JWTAuthentication` exige que `request.user` esté activo
    en cada petición, así que un tercero que logra autenticarse como admin
    ya cuenta, por definición, como "otro admin activo" distinto del
    objetivo. Por eso esta prueba llama al helper directamente en vez de
    vía HTTP, con un actor distinto del objetivo para aislar esta rama de
    la de autodesactivación (que la antecede en `_error_no_desactivable`).
    """
    from rest_framework.test import APIRequestFactory

    from apps.usuarios.views import UsuarioViewSet

    otro_admin = Usuario.objects.create_user(
        username='admin2', email='admin2@flebosil.test', password='clave-segura-123',
        rol_usuario='admin',
    )
    # `admin` (fixture) queda como el único admin activo del sistema.
    otro_admin.is_active = False
    otro_admin.save(update_fields=['is_active'])

    vista = UsuarioViewSet()
    vista.request = APIRequestFactory().delete('/api/usuarios/')
    vista.request.user = otro_admin  # actor distinto del objetivo evaluado

    error = vista._error_no_desactivable(admin)
    assert error == 'No puedes desactivar al único administrador activo del sistema.'


@pytest.mark.django_db
def test_se_puede_desactivar_un_admin_si_existe_otro_admin_activo(admin_client, admin):
    otro_admin = Usuario.objects.create_user(
        username='admin2', email='admin2@flebosil.test', password='clave-segura-123',
        rol_usuario='admin',
    )
    response = admin_client.delete(f'/api/usuarios/{otro_admin.id}/')
    assert response.status_code == 204

    otro_admin.refresh_from_db()
    assert otro_admin.is_active is False


@pytest.mark.django_db
def test_empleado_ya_vinculado_no_puede_asignarse_a_otro_usuario(admin_client, operador):
    from apps.rrhh.models import Empleado

    empleado = Empleado.objects.create(nombre_completo='Laura Gómez')
    operador.empleado = empleado
    operador.save(update_fields=['empleado'])

    response = admin_client.post(
        '/api/usuarios/',
        {
            'email': 'otro@flebosil.test', 'password': 'clave-super-123', 'rol_usuario': 'operador',
            'empleado': empleado.id,
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'empleado' in response.data


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


@pytest.mark.django_db
def test_usuario_desactivado_no_puede_refrescar_su_token(admin_client, operador):
    """Complementa la prueba anterior: la desactivación también debe
    bloquear un intento de refresh (no solo peticiones autenticadas
    directas) — `simplejwt` valida `is_active` en `TokenRefreshSerializer`
    por default (`USER_AUTHENTICATION_RULE`), sin necesitar código propio.
    """
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh_token = str(RefreshToken.for_user(operador))

    admin_client.delete(f'/api/usuarios/{operador.id}/')

    cliente_sin_auth = APIClient()
    respuesta = cliente_sin_auth.post('/api/token/refresh/', {'refresh': refresh_token}, format='json')
    assert respuesta.status_code == 401
