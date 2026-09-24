"""Datos de prueba para verificar manualmente la feature 001 · Header.
Ejecutar con: python manage.py shell < seed_dev.py
No es parte de la aplicación — borrar cuando exista un seed/fixture real.
"""

from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.inventario.models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
)
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario

sucursal, _ = Sucursal.objects.get_or_create(
    nombre_sucursal='Matriz', defaults={'ubicacion_sucursal': 'CDMX'}
)

categoria, _ = Categoria.objects.get_or_create(
    nombre_categoria='General', defaults={'tipo': 'ambos'}
)

producto, _ = Producto.objects.get_or_create(
    sku='SKU-DEV-1',
    defaults={
        'nombre_producto': 'Suero fisiológico 1L',
        'unidad_medida': 'pza',
        'categoria': categoria,
        'precio_venta': '45.00',
    },
)

materia_prima, _ = MateriaPrima.objects.get_or_create(
    nombre_item='Cloruro de sodio', defaults={'unidad_medida': 'kg', 'categoria': categoria},
)

InventarioSucursalProducto.objects.update_or_create(
    sucursal=sucursal, producto=producto,
    defaults={'stock_actual': '2.00', 'stock_minimo': '10.00'},
)
InventarioSucursalMateriaPrima.objects.update_or_create(
    sucursal=sucursal, materia_prima=materia_prima,
    defaults={'stock_actual': '1.00', 'stock_minimo': '5.00'},
)

if not Usuario.objects.filter(email='admin@flebosil.test').exists():
    Usuario.objects.create_user(
        username='admin1', email='admin@flebosil.test', password='clave-admin-123',
        rol_usuario='admin',
    )

if not Usuario.objects.filter(email='operador@flebosil.test').exists():
    Usuario.objects.create_user(
        username='operador1', email='operador@flebosil.test', password='clave-operador-123',
        rol_usuario='operador',
    )

print('Seed listo: admin@flebosil.test / operador@flebosil.test (contraseñas en este script)')
