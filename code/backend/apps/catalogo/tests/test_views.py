import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, MateriaPrima, Producto
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
def categoria_producto(db):
    return Categoria.objects.create(nombre_categoria='Insumos médicos', tipo=Categoria.TIPO_PRODUCTO)


@pytest.fixture
def categoria_materia_prima(db):
    return Categoria.objects.create(nombre_categoria='Químicos', tipo=Categoria.TIPO_MATERIA_PRIMA)


@pytest.fixture
def categoria_ambos(db):
    return Categoria.objects.create(nombre_categoria='General', tipo=Categoria.TIPO_AMBOS)


@pytest.fixture
def producto(categoria_producto):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico 1L', sku='SKU-1', unidad_medida='pza',
        categoria=categoria_producto, precio_venta='45.00',
    )


@pytest.fixture
def materia_prima(categoria_materia_prima):
    return MateriaPrima.objects.create(
        nombre_item='Cloruro de sodio', categoria=categoria_materia_prima, unidad_medida='kg',
    )


# --- Categoría --------------------------------------------------------------


@pytest.mark.django_db
def test_operador_puede_listar_categorias(operador_client, categoria_ambos):
    response = operador_client.get('/api/catalogo/categorias/')
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_admin_puede_crear_categoria(admin_client):
    response = admin_client.post(
        '/api/catalogo/categorias/',
        {'nombre_categoria': 'Envases', 'tipo': Categoria.TIPO_PRODUCTO},
        format='json',
    )
    assert response.status_code == 201
    assert Categoria.objects.filter(nombre_categoria='Envases', activo=True).exists()


@pytest.mark.django_db
def test_operador_no_puede_crear_categoria(operador_client):
    response = operador_client.post(
        '/api/catalogo/categorias/', {'nombre_categoria': 'Envases', 'tipo': Categoria.TIPO_PRODUCTO},
        format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_desactiva_categoria_sin_borrado_fisico(admin_client, categoria_ambos):
    response = admin_client.delete(f'/api/catalogo/categorias/{categoria_ambos.id}/')
    assert response.status_code == 204

    categoria_ambos.refresh_from_db()
    assert categoria_ambos.activo is False
    assert Categoria.objects.filter(id=categoria_ambos.id).exists()


# --- Producto -----------------------------------------------------------


@pytest.mark.django_db
def test_admin_puede_crear_producto(admin_client, categoria_producto):
    response = admin_client.post(
        '/api/catalogo/productos/',
        {
            'nombre_producto': 'Gasa estéril', 'sku': 'SKU-GASA', 'unidad_medida': 'caja',
            'categoria': categoria_producto.id, 'precio_venta': '120.00',
        },
        format='json',
    )
    assert response.status_code == 201
    assert Producto.objects.filter(sku='SKU-GASA', activo=True).exists()


@pytest.mark.django_db
def test_operador_no_puede_crear_producto(operador_client, categoria_producto):
    response = operador_client.post(
        '/api/catalogo/productos/',
        {
            'nombre_producto': 'Gasa estéril', 'sku': 'SKU-GASA', 'unidad_medida': 'caja',
            'categoria': categoria_producto.id, 'precio_venta': '120.00',
        },
        format='json',
    )
    assert response.status_code == 403
    assert not Producto.objects.filter(sku='SKU-GASA').exists()


@pytest.mark.django_db
def test_rechaza_sku_duplicado_con_mensaje_claro(admin_client, categoria_producto, producto):
    response = admin_client.post(
        '/api/catalogo/productos/',
        {
            'nombre_producto': 'Otro producto', 'sku': producto.sku, 'unidad_medida': 'pza',
            'categoria': categoria_producto.id, 'precio_venta': '10.00',
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'sku' in response.data
    assert 'SKU' in str(response.data['sku'][0])


@pytest.mark.django_db
def test_rechaza_producto_con_categoria_de_materia_prima(admin_client, categoria_materia_prima):
    response = admin_client.post(
        '/api/catalogo/productos/',
        {
            'nombre_producto': 'Producto inválido', 'sku': 'SKU-X', 'unidad_medida': 'pza',
            'categoria': categoria_materia_prima.id, 'precio_venta': '10.00',
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'categoria' in response.data


@pytest.mark.django_db
def test_admin_desactiva_producto_sin_borrado_fisico(admin_client, producto):
    response = admin_client.delete(f'/api/catalogo/productos/{producto.id}/')
    assert response.status_code == 204

    producto.refresh_from_db()
    assert producto.activo is False
    assert Producto.objects.filter(id=producto.id).exists()


@pytest.mark.django_db
def test_rechaza_precio_venta_negativo(admin_client, categoria_producto):
    response = admin_client.post(
        '/api/catalogo/productos/',
        {
            'nombre_producto': 'Producto inválido', 'sku': 'SKU-NEG', 'unidad_medida': 'pza',
            'categoria': categoria_producto.id, 'precio_venta': '-10.00',
        },
        format='json',
    )
    assert response.status_code == 400
    assert 'precio_venta' in response.data


# --- Materia prima --------------------------------------------------------


@pytest.mark.django_db
def test_admin_puede_crear_materia_prima(admin_client, categoria_materia_prima):
    response = admin_client.post(
        '/api/catalogo/materia-prima/',
        {
            'nombre_item': 'Alcohol etílico', 'categoria': categoria_materia_prima.id,
            'unidad_medida': 'L', 'costo_promedio': '30.00',
        },
        format='json',
    )
    assert response.status_code == 201
    assert MateriaPrima.objects.filter(nombre_item='Alcohol etílico', activo=True).exists()


@pytest.mark.django_db
def test_operador_no_puede_crear_materia_prima(operador_client, categoria_materia_prima):
    response = operador_client.post(
        '/api/catalogo/materia-prima/',
        {'nombre_item': 'Alcohol etílico', 'categoria': categoria_materia_prima.id, 'unidad_medida': 'L'},
        format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_rechaza_materia_prima_con_categoria_de_producto(admin_client, categoria_producto):
    response = admin_client.post(
        '/api/catalogo/materia-prima/',
        {'nombre_item': 'Inválida', 'categoria': categoria_producto.id, 'unidad_medida': 'L'},
        format='json',
    )
    assert response.status_code == 400
    assert 'categoria' in response.data


@pytest.mark.django_db
def test_categoria_ambos_es_valida_para_producto_y_materia_prima(admin_client, categoria_ambos):
    response_producto = admin_client.post(
        '/api/catalogo/productos/',
        {
            'nombre_producto': 'Producto ambos', 'sku': 'SKU-AMBOS', 'unidad_medida': 'pza',
            'categoria': categoria_ambos.id, 'precio_venta': '10.00',
        },
        format='json',
    )
    response_materia_prima = admin_client.post(
        '/api/catalogo/materia-prima/',
        {'nombre_item': 'Materia prima ambos', 'categoria': categoria_ambos.id, 'unidad_medida': 'kg'},
        format='json',
    )
    assert response_producto.status_code == 201
    assert response_materia_prima.status_code == 201


@pytest.mark.django_db
def test_admin_desactiva_materia_prima_sin_borrado_fisico(admin_client, materia_prima):
    response = admin_client.delete(f'/api/catalogo/materia-prima/{materia_prima.id}/')
    assert response.status_code == 204

    materia_prima.refresh_from_db()
    assert materia_prima.activo is False
    assert MateriaPrima.objects.filter(id=materia_prima.id).exists()


@pytest.mark.django_db
def test_listado_requiere_autenticacion(producto):
    client = APIClient()
    response = client.get('/api/catalogo/productos/')
    assert response.status_code == 401


# --- Reactivación ------------------------------------------------------------


@pytest.mark.django_db
def test_admin_reactiva_categoria(admin_client, categoria_ambos):
    categoria_ambos.activo = False
    categoria_ambos.save(update_fields=['activo'])

    response = admin_client.post(f'/api/catalogo/categorias/{categoria_ambos.id}/reactivar/')
    assert response.status_code == 200

    categoria_ambos.refresh_from_db()
    assert categoria_ambos.activo is True


@pytest.mark.django_db
def test_reactivar_categoria_ya_activa_es_rechazado(admin_client, categoria_ambos):
    response = admin_client.post(f'/api/catalogo/categorias/{categoria_ambos.id}/reactivar/')
    assert response.status_code == 400
    assert 'detail' in response.data


@pytest.mark.django_db
def test_operador_no_puede_reactivar_categoria(operador_client, categoria_ambos):
    categoria_ambos.activo = False
    categoria_ambos.save(update_fields=['activo'])

    response = operador_client.post(f'/api/catalogo/categorias/{categoria_ambos.id}/reactivar/')
    assert response.status_code == 403

    categoria_ambos.refresh_from_db()
    assert categoria_ambos.activo is False


@pytest.mark.django_db
def test_admin_reactiva_producto(admin_client, producto):
    producto.activo = False
    producto.save(update_fields=['activo'])

    response = admin_client.post(f'/api/catalogo/productos/{producto.id}/reactivar/')
    assert response.status_code == 200

    producto.refresh_from_db()
    assert producto.activo is True


@pytest.mark.django_db
def test_reactivar_producto_ya_activo_es_rechazado(admin_client, producto):
    response = admin_client.post(f'/api/catalogo/productos/{producto.id}/reactivar/')
    assert response.status_code == 400
    assert 'detail' in response.data


@pytest.mark.django_db
def test_operador_no_puede_reactivar_producto(operador_client, producto):
    producto.activo = False
    producto.save(update_fields=['activo'])

    response = operador_client.post(f'/api/catalogo/productos/{producto.id}/reactivar/')
    assert response.status_code == 403

    producto.refresh_from_db()
    assert producto.activo is False


@pytest.mark.django_db
def test_admin_reactiva_materia_prima(admin_client, materia_prima):
    materia_prima.activo = False
    materia_prima.save(update_fields=['activo'])

    response = admin_client.post(f'/api/catalogo/materia-prima/{materia_prima.id}/reactivar/')
    assert response.status_code == 200

    materia_prima.refresh_from_db()
    assert materia_prima.activo is True


@pytest.mark.django_db
def test_reactivar_materia_prima_ya_activa_es_rechazado(admin_client, materia_prima):
    response = admin_client.post(f'/api/catalogo/materia-prima/{materia_prima.id}/reactivar/')
    assert response.status_code == 400
    assert 'detail' in response.data


@pytest.mark.django_db
def test_operador_no_puede_reactivar_materia_prima(operador_client, materia_prima):
    materia_prima.activo = False
    materia_prima.save(update_fields=['activo'])

    response = operador_client.post(f'/api/catalogo/materia-prima/{materia_prima.id}/reactivar/')
    assert response.status_code == 403

    materia_prima.refresh_from_db()
    assert materia_prima.activo is False
