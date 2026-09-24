import io
from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.rrhh.models import (
    Departamento,
    Empleado,
    EmpleadoPosicion,
    Posicion,
    SolicitudNomina,
)
from apps.usuarios.models import Usuario


def _imagen_prueba():
    buffer = io.BytesIO()
    Image.new('RGB', (10, 10), color='white').save(buffer, format='PNG')
    buffer.seek(0)
    return SimpleUploadedFile('foto.png', buffer.read(), content_type='image/png')


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
def departamento(db):
    return Departamento.objects.create(nombre_departamento='Ventas')


@pytest.fixture
def posicion(departamento):
    return Posicion.objects.create(
        titulo_posicion='Vendedor', departamento=departamento,
        salario_minimo='5000.00', salario_maximo='9000.00',
    )


@pytest.fixture
def empleado(db):
    return Empleado.objects.create(nombre_completo='Laura Gómez')


# --- Permisos: admin-only en todo RRHH, ni lectura para operador --------


@pytest.mark.parametrize('ruta', [
    '/api/rrhh/departamentos/',
    '/api/rrhh/posiciones/',
    '/api/rrhh/empleados/',
    '/api/rrhh/empleado-posiciones/',
    '/api/rrhh/contactos-emergencia/',
    '/api/rrhh/dependientes/',
    '/api/rrhh/solicitudes-nomina/',
])
@pytest.mark.django_db
def test_operador_no_tiene_ni_lectura(operador_client, ruta):
    response = operador_client.get(ruta)
    assert response.status_code == 403


@pytest.mark.django_db
def test_operador_no_puede_crear_departamento(operador_client):
    response = operador_client.post(
        '/api/rrhh/departamentos/', {'nombre_departamento': 'Compras'}, format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_puede_listar_departamentos(admin_client, departamento):
    response = admin_client.get('/api/rrhh/departamentos/')
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_peticion_sin_autenticar_es_rechazada():
    response = APIClient().get('/api/rrhh/empleados/')
    assert response.status_code == 401


# --- Posicion: rango salarial ---------------------------------------------


@pytest.mark.django_db
def test_rechaza_salario_minimo_mayor_al_maximo(admin_client, departamento):
    response = admin_client.post(
        '/api/rrhh/posiciones/',
        {
            'titulo_posicion': 'Gerente', 'departamento': departamento.id,
            'salario_minimo': '10000.00', 'salario_maximo': '8000.00',
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'salario_maximo' in response.data


# --- EmpleadoViewSet.contratar: alta combinada atómica --------------------


@pytest.mark.django_db
def test_contratar_crea_empleado_y_asignacion_juntos(admin_client, posicion):
    response = admin_client.post(
        '/api/rrhh/empleados/contratar/',
        {
            'nombre_completo': 'Nueva Empleada', 'posicion': posicion.id,
            'salario_asignado': '7000.00', 'fecha_inicio': '2026-01-01',
        },
        format='json',
    )
    assert response.status_code == 201

    empleado = Empleado.objects.get(nombre_completo='Nueva Empleada')
    asignacion = empleado.asignaciones.get()
    assert asignacion.posicion_id == posicion.id
    assert asignacion.motivo_cambio == 'contratacion'


@pytest.mark.django_db
def test_contratar_guarda_datos_completos_y_fotografia(admin_client, posicion):
    """Regresión: el formulario de alta ("Nuevo empleado") solo pedía
    nombre/salario/fecha — curp/rfc/nss/teléfono/correo/cuenta bancaria y la
    fotografía quedaban sin forma de capturarse hasta editar al empleado
    por separado.
    """
    response = admin_client.post(
        '/api/rrhh/empleados/contratar/',
        {
            'nombre_completo': 'Empleada Completa', 'curp': 'ABCD900101HDFXXX01', 'rfc': 'ABCD900101XXX',
            'nss': '12345678901', 'telefono': '5551234567', 'email': 'empleada@flebosil.test',
            'cuenta_bancaria': '1234567890', 'posicion': posicion.id, 'salario_asignado': '7000.00',
            'fecha_inicio': '2026-01-01', 'fotografia': _imagen_prueba(),
        },
        format='multipart',
    )
    assert response.status_code == 201

    empleado = Empleado.objects.get(nombre_completo='Empleada Completa')
    assert empleado.curp == 'ABCD900101HDFXXX01'
    assert empleado.rfc == 'ABCD900101XXX'
    assert empleado.nss == '12345678901'
    assert empleado.telefono == '5551234567'
    assert empleado.email == 'empleada@flebosil.test'
    assert empleado.cuenta_bancaria == '1234567890'
    assert empleado.fotografia.name


@pytest.mark.django_db
def test_contratar_no_deja_empleado_huerfano_si_el_salario_esta_fuera_de_rango(admin_client, posicion):
    """Regresión: antes de este endpoint, el frontend hacía dos peticiones
    separadas (crear empleado, luego crear asignación); si la segunda
    fallaba por rango salarial, el empleado ya creado quedaba huérfano, sin
    ninguna posición y sin aviso claro de esa inconsistencia.
    """
    response = admin_client.post(
        '/api/rrhh/empleados/contratar/',
        {
            'nombre_completo': 'Empleada Huérfana', 'posicion': posicion.id,
            'salario_asignado': '20000.00', 'fecha_inicio': '2026-01-01',
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'salario_asignado' in response.data
    assert not Empleado.objects.filter(nombre_completo='Empleada Huérfana').exists()


@pytest.mark.django_db
def test_operador_no_puede_contratar(operador_client, posicion):
    response = operador_client.post(
        '/api/rrhh/empleados/contratar/',
        {
            'nombre_completo': 'Intento Operador', 'posicion': posicion.id,
            'salario_asignado': '7000.00', 'fecha_inicio': '2026-01-01',
        },
        format='json',
    )
    assert response.status_code == 403
    assert not Empleado.objects.filter(nombre_completo='Intento Operador').exists()


# --- EmpleadoPosicion: salario_asignado dentro del rango de la posición ---


@pytest.mark.django_db
def test_rechaza_salario_asignado_fuera_de_rango(admin_client, empleado, posicion):
    response = admin_client.post(
        '/api/rrhh/empleado-posiciones/',
        {
            'empleado': empleado.id, 'posicion': posicion.id, 'salario_asignado': '20000.00',
            'fecha_inicio': '2026-01-01', 'motivo_cambio': 'contratacion',
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'salario_asignado' in response.data


@pytest.mark.django_db
def test_acepta_salario_asignado_dentro_de_rango(admin_client, empleado, posicion):
    response = admin_client.post(
        '/api/rrhh/empleado-posiciones/',
        {
            'empleado': empleado.id, 'posicion': posicion.id, 'salario_asignado': '7000.00',
            'fecha_inicio': '2026-01-01', 'motivo_cambio': 'contratacion',
        },
        format='json',
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_filtra_empleados_vigentes_por_posicion_ordenados_por_antiguedad(admin_client, posicion):
    empleado_reciente = Empleado.objects.create(nombre_completo='Empleado B')
    empleado_antiguo = Empleado.objects.create(nombre_completo='Empleado A')

    EmpleadoPosicion.objects.create(
        empleado=empleado_reciente, posicion=posicion, salario_asignado='6000.00',
        fecha_inicio=date(2026, 6, 1), motivo_cambio='contratacion',
    )
    EmpleadoPosicion.objects.create(
        empleado=empleado_antiguo, posicion=posicion, salario_asignado='6000.00',
        fecha_inicio=date(2025, 1, 1), motivo_cambio='contratacion',
    )

    response = admin_client.get(f'/api/rrhh/empleado-posiciones/?posicion={posicion.id}&vigente=true')
    assert response.status_code == 200
    ids = [fila['empleado'] for fila in response.data]
    assert ids == [empleado_antiguo.id, empleado_reciente.id]


# --- Empleado: desactivación cierra la asignación vigente ------------------


@pytest.mark.django_db
def test_desactivar_empleado_con_posicion_vigente_exige_motivo_cambio(admin_client, empleado, posicion):
    EmpleadoPosicion.objects.create(
        empleado=empleado, posicion=posicion, salario_asignado='6000.00',
        fecha_inicio=date(2026, 1, 1), motivo_cambio='contratacion',
    )

    response = admin_client.delete(f'/api/rrhh/empleados/{empleado.id}/')
    assert response.status_code == 400
    assert 'motivo_cambio' in response.data

    empleado.refresh_from_db()
    assert empleado.activo is True


@pytest.mark.django_db
def test_desactivar_empleado_cierra_asignacion_vigente(admin_client, empleado, posicion):
    asignacion = EmpleadoPosicion.objects.create(
        empleado=empleado, posicion=posicion, salario_asignado='6000.00',
        fecha_inicio=date(2026, 1, 1), motivo_cambio='contratacion',
    )

    response = admin_client.delete(
        f'/api/rrhh/empleados/{empleado.id}/', {'motivo_cambio': 'renuncia'}, format='json',
    )
    assert response.status_code == 204

    empleado.refresh_from_db()
    asignacion.refresh_from_db()
    assert empleado.activo is False
    assert asignacion.fecha_termino is not None
    assert asignacion.motivo_cambio == 'renuncia'


@pytest.mark.django_db
def test_desactivar_empleado_sin_posicion_vigente_no_exige_motivo(admin_client, empleado):
    response = admin_client.delete(f'/api/rrhh/empleados/{empleado.id}/')
    assert response.status_code == 204
    empleado.refresh_from_db()
    assert empleado.activo is False


@pytest.mark.django_db
def test_desactivar_empleado_es_idempotente(admin_client, empleado):
    admin_client.delete(f'/api/rrhh/empleados/{empleado.id}/')
    response = admin_client.delete(f'/api/rrhh/empleados/{empleado.id}/')
    assert response.status_code == 204


@pytest.mark.django_db
def test_desactivar_empleado_desactiva_su_cuenta_de_usuario_vinculada(admin_client, empleado):
    usuario = Usuario.objects.create_user(
        username='laura', email='laura@flebosil.test', password='clave-segura-123', empleado=empleado,
    )

    response = admin_client.delete(f'/api/rrhh/empleados/{empleado.id}/')
    assert response.status_code == 204

    usuario.refresh_from_db()
    assert usuario.is_active is False


@pytest.mark.django_db
def test_reactivar_empleado(admin_client, empleado):
    empleado.activo = False
    empleado.save(update_fields=['activo'])

    response = admin_client.post(f'/api/rrhh/empleados/{empleado.id}/reactivar/')
    assert response.status_code == 200
    empleado.refresh_from_db()
    assert empleado.activo is True


# --- SolicitudNomina: aprobar/rechazar ------------------------------------


@pytest.fixture
def solicitud(empleado):
    return SolicitudNomina.objects.create(
        empleado=empleado, periodo_inicio=date(2026, 1, 1), periodo_fin=date(2026, 1, 15),
        monto='4500.00',
    )


@pytest.mark.django_db
def test_lista_solicitudes_filtradas_por_estado(admin_client, solicitud):
    response = admin_client.get('/api/rrhh/solicitudes-nomina/?estado=pendiente')
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_admin_aprueba_solicitud_nomina(admin_client, admin, solicitud):
    response = admin_client.post(f'/api/rrhh/solicitudes-nomina/{solicitud.id}/aprobar/')
    assert response.status_code == 200

    solicitud.refresh_from_db()
    assert solicitud.estado == 'aprobado'
    assert solicitud.resuelto_por_id == admin.id
    assert solicitud.fecha_resolucion is not None


@pytest.mark.django_db
def test_admin_rechaza_solicitud_nomina(admin_client, solicitud):
    response = admin_client.post(f'/api/rrhh/solicitudes-nomina/{solicitud.id}/rechazar/')
    assert response.status_code == 200
    solicitud.refresh_from_db()
    assert solicitud.estado == 'rechazado'


@pytest.mark.django_db
def test_no_se_puede_resolver_una_solicitud_ya_resuelta(admin_client, solicitud):
    admin_client.post(f'/api/rrhh/solicitudes-nomina/{solicitud.id}/aprobar/')
    response = admin_client.post(f'/api/rrhh/solicitudes-nomina/{solicitud.id}/rechazar/')
    assert response.status_code == 400


@pytest.mark.django_db
def test_operador_no_puede_aprobar_solicitud(operador_client, solicitud):
    response = operador_client.post(f'/api/rrhh/solicitudes-nomina/{solicitud.id}/aprobar/')
    assert response.status_code == 403


# --- Filtro `?disponible=true` (selector de empleado en 010 · Usuarios) --


@pytest.mark.django_db
def test_disponible_excluye_empleados_ya_vinculados_a_un_usuario(admin_client, empleado):
    empleado_libre = Empleado.objects.create(nombre_completo='Empleado Libre')
    Usuario.objects.create_user(
        username='con-cuenta', email='con-cuenta@flebosil.test', password='clave-segura-123',
        empleado=empleado,
    )

    response = admin_client.get('/api/rrhh/empleados/?disponible=true')
    assert response.status_code == 200
    ids = [e['id'] for e in response.data]
    assert empleado_libre.id in ids
    assert empleado.id not in ids


@pytest.mark.django_db
def test_disponible_excluye_empleados_inactivos(admin_client):
    Empleado.objects.create(nombre_completo='Empleado Inactivo', activo=False)
    response = admin_client.get('/api/rrhh/empleados/?disponible=true')
    assert response.data == []


@pytest.mark.django_db
def test_sin_el_query_param_devuelve_todos_los_empleados(admin_client, empleado):
    Usuario.objects.create_user(
        username='con-cuenta', email='con-cuenta@flebosil.test', password='clave-segura-123',
        empleado=empleado,
    )
    response = admin_client.get('/api/rrhh/empleados/')
    ids = [e['id'] for e in response.data]
    assert empleado.id in ids
