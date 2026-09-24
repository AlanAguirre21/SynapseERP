import pytest
from rest_framework.test import APIClient

from apps.sucursales.models import HistorialEstadoSucursal, Sucursal
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


@pytest.fixture
def sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz', ubicacion_sucursal='Centro')


@pytest.mark.django_db
def test_operador_puede_listar_sucursales(operador_client, sucursal):
    response = operador_client.get('/api/sucursales/')
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_admin_puede_crear_sucursal(admin_client):
    response = admin_client.post(
        '/api/sucursales/',
        {'nombre_sucursal': 'Sucursal Norte', 'ubicacion_sucursal': 'Av. Norte 123', 'telefono_sucursal': '555-1234'},
        format='json',
    )
    assert response.status_code == 201
    assert Sucursal.objects.filter(nombre_sucursal='Sucursal Norte', activo=True).exists()


@pytest.mark.django_db
def test_operador_no_puede_crear_sucursal(operador_client):
    response = operador_client.post(
        '/api/sucursales/', {'nombre_sucursal': 'Sucursal Norte'}, format='json',
    )
    assert response.status_code == 403
    assert not Sucursal.objects.filter(nombre_sucursal='Sucursal Norte').exists()


@pytest.mark.django_db
def test_admin_puede_editar_sucursal(admin_client, sucursal):
    response = admin_client.patch(
        f'/api/sucursales/{sucursal.id}/', {'telefono_sucursal': '555-9999'}, format='json',
    )
    assert response.status_code == 200
    sucursal.refresh_from_db()
    assert sucursal.telefono_sucursal == '555-9999'


@pytest.mark.django_db
def test_operador_no_puede_editar_sucursal(operador_client, sucursal):
    response = operador_client.patch(
        f'/api/sucursales/{sucursal.id}/', {'telefono_sucursal': '555-9999'}, format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_desactiva_sucursal_sin_borrado_fisico(admin_client, sucursal):
    response = admin_client.delete(f'/api/sucursales/{sucursal.id}/')
    assert response.status_code == 204

    sucursal.refresh_from_db()
    assert sucursal.activo is False
    assert Sucursal.objects.filter(id=sucursal.id).exists()


@pytest.mark.django_db
def test_operador_no_puede_desactivar_sucursal(operador_client, sucursal):
    response = operador_client.delete(f'/api/sucursales/{sucursal.id}/')
    assert response.status_code == 403

    sucursal.refresh_from_db()
    assert sucursal.activo is True


@pytest.mark.django_db
def test_listado_requiere_autenticacion(sucursal):
    client = APIClient()
    response = client.get('/api/sucursales/')
    assert response.status_code == 401


# --- Reactivación ---------------------------------------------------------


@pytest.mark.django_db
def test_admin_puede_reactivar_sucursal(admin_client, sucursal):
    sucursal.activo = False
    sucursal.save(update_fields=['activo'])

    response = admin_client.post(f'/api/sucursales/{sucursal.id}/reactivar/')
    assert response.status_code == 200

    sucursal.refresh_from_db()
    assert sucursal.activo is True


@pytest.mark.django_db
def test_operador_no_puede_reactivar_sucursal(operador_client, sucursal):
    sucursal.activo = False
    sucursal.save(update_fields=['activo'])

    response = operador_client.post(f'/api/sucursales/{sucursal.id}/reactivar/')
    assert response.status_code == 403

    sucursal.refresh_from_db()
    assert sucursal.activo is False


@pytest.mark.django_db
def test_reactivar_sucursal_ya_activa_devuelve_error(admin_client, sucursal):
    response = admin_client.post(f'/api/sucursales/{sucursal.id}/reactivar/')
    assert response.status_code == 400


# --- Validación de nombre duplicado ---------------------------------------


@pytest.mark.django_db
def test_rechaza_crear_sucursal_con_nombre_de_una_activa(admin_client, sucursal):
    response = admin_client.post(
        '/api/sucursales/',
        {'nombre_sucursal': sucursal.nombre_sucursal, 'ubicacion_sucursal': 'Otra ubicación'},
        format='json',
    )
    assert response.status_code == 400
    assert 'nombre_sucursal' in response.data


@pytest.mark.django_db
def test_permite_nombre_repetido_si_original_inactiva_y_ubicacion_distinta(admin_client, sucursal):
    sucursal.activo = False
    sucursal.save(update_fields=['activo'])

    response = admin_client.post(
        '/api/sucursales/',
        {'nombre_sucursal': sucursal.nombre_sucursal, 'ubicacion_sucursal': 'Ubicación distinta'},
        format='json',
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_rechaza_nombre_y_ubicacion_repetidos_aunque_original_inactiva(admin_client, sucursal):
    sucursal.activo = False
    sucursal.save(update_fields=['activo'])

    response = admin_client.post(
        '/api/sucursales/',
        {'nombre_sucursal': sucursal.nombre_sucursal, 'ubicacion_sucursal': sucursal.ubicacion_sucursal},
        format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_rechaza_nombre_repetido_con_ubicaciones_vacias_coincidentes(admin_client):
    Sucursal.objects.create(nombre_sucursal='Sin ubicación', ubicacion_sucursal='', activo=False)

    response = admin_client.post(
        '/api/sucursales/',
        {'nombre_sucursal': 'Sin ubicación', 'ubicacion_sucursal': ''},
        format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_rechaza_renombrar_sucursal_hacia_nombre_de_otra_activa(admin_client, sucursal):
    otra = Sucursal.objects.create(nombre_sucursal='Otra Sucursal', ubicacion_sucursal='Otra ciudad')

    response = admin_client.patch(
        f'/api/sucursales/{sucursal.id}/', {'nombre_sucursal': otra.nombre_sucursal}, format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_reactivar_rechazada_si_ya_existe_otra_activa_con_el_mismo_nombre(admin_client, sucursal):
    sucursal.activo = False
    sucursal.save(update_fields=['activo'])
    Sucursal.objects.create(nombre_sucursal=sucursal.nombre_sucursal, ubicacion_sucursal='Otra ubicación')

    response = admin_client.post(f'/api/sucursales/{sucursal.id}/reactivar/')
    assert response.status_code == 400

    sucursal.refresh_from_db()
    assert sucursal.activo is False


# --- HistorialEstadoSucursal ----------------------------------------------


@pytest.mark.django_db
def test_desactivar_sucursal_crea_historial(admin_client, admin, sucursal):
    admin_client.delete(f'/api/sucursales/{sucursal.id}/')

    historial = HistorialEstadoSucursal.objects.get(sucursal=sucursal)
    assert historial.estado_anterior is True
    assert historial.estado_nuevo is False
    assert historial.usuario_id == admin.id


@pytest.mark.django_db
def test_reactivar_sucursal_crea_historial(admin_client, admin, sucursal):
    sucursal.activo = False
    sucursal.save(update_fields=['activo'])

    admin_client.post(f'/api/sucursales/{sucursal.id}/reactivar/')

    historial = HistorialEstadoSucursal.objects.get(sucursal=sucursal)
    assert historial.estado_anterior is False
    assert historial.estado_nuevo is True
    assert historial.usuario_id == admin.id


@pytest.mark.django_db
def test_desactivar_sucursal_ya_inactiva_no_duplica_historial(admin_client, sucursal):
    sucursal.activo = False
    sucursal.save(update_fields=['activo'])

    admin_client.delete(f'/api/sucursales/{sucursal.id}/')

    assert HistorialEstadoSucursal.objects.filter(sucursal=sucursal).count() == 0
