import pytest
from rest_framework.test import APIClient

from apps.personas.models import Cliente, Empleado, Proveedor
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
def cliente(db):
    return Cliente.objects.create(nombre_cliente='Hospital San Rafael')


@pytest.fixture
def proveedor(db):
    return Proveedor.objects.create(nombre_proveedor='Distribuidora Médica SA')


@pytest.fixture
def empleado(db):
    return Empleado.objects.create(nombre_completo='Laura Gómez', puesto='Almacén', salario='8000.00')


# --- Cliente: escritura abierta a cualquier autenticado -----------------


@pytest.mark.django_db
def test_operador_puede_crear_cliente(operador_client):
    response = operador_client.post(
        '/api/personas/clientes/', {'nombre_cliente': 'Farmacia del Centro'}, format='json',
    )
    assert response.status_code == 201
    assert Cliente.objects.filter(nombre_cliente='Farmacia del Centro', activo=True).exists()


@pytest.mark.django_db
def test_operador_puede_desactivar_cliente_sin_borrado_fisico(operador_client, cliente):
    response = operador_client.delete(f'/api/personas/clientes/{cliente.id}/')
    assert response.status_code == 204

    cliente.refresh_from_db()
    assert cliente.activo is False
    assert Cliente.objects.filter(id=cliente.id).exists()


@pytest.mark.django_db
def test_listado_clientes_requiere_autenticacion(cliente):
    response = APIClient().get('/api/personas/clientes/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_cliente_sin_requiere_factura_no_exige_datos_fiscales(operador_client):
    response = operador_client.post(
        '/api/personas/clientes/',
        {'nombre_cliente': 'Cliente mostrador', 'datos_fiscales': {'requiere_factura': False}},
        format='json',
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_cliente_requiere_factura_sin_datos_fiscales_completos_es_rechazado(operador_client):
    response = operador_client.post(
        '/api/personas/clientes/',
        {
            'nombre_cliente': 'Cliente facturable',
            'datos_fiscales': {'requiere_factura': True, 'rfc': 'XAXX010101000'},
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'datos_fiscales' in response.data


@pytest.mark.django_db
def test_cliente_requiere_factura_con_datos_fiscales_completos_es_aceptado(operador_client):
    response = operador_client.post(
        '/api/personas/clientes/',
        {
            'nombre_cliente': 'Cliente facturable',
            'datos_fiscales': {
                'requiere_factura': True,
                'rfc': 'XAXX010101000',
                'razon_social': 'Cliente Facturable SA de CV',
                'codigo_postal_fiscal': '01000',
                'regimen_fiscal': '601',
                'uso_cfdi_default': 'G03',
            },
        },
        format='json',
    )
    assert response.status_code == 201
    cliente_creado = Cliente.objects.get(nombre_cliente='Cliente facturable')
    assert cliente_creado.datos_fiscales.requiere_factura is True


@pytest.mark.django_db
def test_editar_cliente_no_rompe_si_ya_tenia_datos_fiscales(operador_client, cliente):
    respuesta_creacion = operador_client.post(
        '/api/personas/clientes/',
        {
            'nombre_cliente': 'Cliente con factura',
            'datos_fiscales': {
                'requiere_factura': True,
                'rfc': 'XAXX010101000',
                'razon_social': 'Cliente Con Factura SA',
                'codigo_postal_fiscal': '01000',
                'regimen_fiscal': '601',
            },
        },
        format='json',
    )
    id_cliente = respuesta_creacion.data['id']

    respuesta_edicion = operador_client.patch(
        f'/api/personas/clientes/{id_cliente}/', {'telefono': '5555555555'}, format='json',
    )
    assert respuesta_edicion.status_code == 200
    assert respuesta_edicion.data['datos_fiscales']['requiere_factura'] is True


# --- Proveedor: escritura abierta a cualquier autenticado ----------------


@pytest.mark.django_db
def test_operador_puede_crear_proveedor(operador_client):
    response = operador_client.post(
        '/api/personas/proveedores/', {'nombre_proveedor': 'Insumos Médicos SA'}, format='json',
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_operador_puede_desactivar_proveedor(operador_client, proveedor):
    response = operador_client.delete(f'/api/personas/proveedores/{proveedor.id}/')
    assert response.status_code == 204
    proveedor.refresh_from_db()
    assert proveedor.activo is False


# --- Empleado: escritura solo admin --------------------------------------


@pytest.mark.django_db
def test_operador_puede_listar_empleados(operador_client, empleado):
    response = operador_client.get('/api/personas/empleados/')
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_operador_no_puede_crear_empleado(operador_client):
    response = operador_client.post(
        '/api/personas/empleados/', {'nombre_completo': 'Nuevo Empleado', 'salario': '5000.00'}, format='json',
    )
    assert response.status_code == 403
    assert not Empleado.objects.filter(nombre_completo='Nuevo Empleado').exists()


@pytest.mark.django_db
def test_admin_puede_crear_empleado(admin_client):
    response = admin_client.post(
        '/api/personas/empleados/', {'nombre_completo': 'Nuevo Empleado', 'salario': '5000.00'}, format='json',
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_admin_desactiva_empleado_sin_borrado_fisico(admin_client, empleado):
    response = admin_client.delete(f'/api/personas/empleados/{empleado.id}/')
    assert response.status_code == 204
    empleado.refresh_from_db()
    assert empleado.activo is False
    assert Empleado.objects.filter(id=empleado.id).exists()


@pytest.mark.django_db
def test_rechaza_salario_negativo(admin_client):
    response = admin_client.post(
        '/api/personas/empleados/', {'nombre_completo': 'Empleado inválido', 'salario': '-100.00'}, format='json',
    )
    assert response.status_code == 400
    assert 'salario' in response.data
