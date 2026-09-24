"""Fuente única de verdad de navegación: qué módulos existen, a qué ruta
apuntan y qué roles pueden verlos. Sidebar.jsx en el frontend NO reimplementa
esta lógica — consume la lista ya filtrada que expone /api/usuarios/me/.
"""

from .permissions import ROL_ADMIN, ROL_OPERADOR

MODULOS = [
    {'slug': 'ventas', 'nombre': 'Ventas', 'ruta': '/ventas', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    {'slug': 'compras', 'nombre': 'Compras', 'ruta': '/compras', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    {'slug': 'produccion', 'nombre': 'Producción', 'ruta': '/produccion', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    {'slug': 'inventario', 'nombre': 'Inventario', 'ruta': '/inventario', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    {'slug': 'facturacion', 'nombre': 'Facturación', 'ruta': '/facturacion', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    {'slug': 'caja', 'nombre': 'Caja', 'ruta': '/caja', 'roles': [ROL_ADMIN]},
    {'slug': 'catalogo', 'nombre': 'Catálogo', 'ruta': '/catalogo', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    # Admin-only, sin excepción de lectura — mismo criterio que Caja/Contabilidad/
    # Configuración Fiscal/Usuarios (ver feature 008 · RRHH, aún sin implementar:
    # esta entrada solo habilita el ítem del sidebar, la página en sí llega con esa feature).
    {'slug': 'rrhh', 'nombre': 'Recursos Humanos', 'ruta': '/rrhh', 'roles': [ROL_ADMIN]},
    {'slug': 'terceros', 'nombre': 'Terceros', 'ruta': '/terceros', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    # Agrupado junto a RRHH/Terceros (los tres módulos "de personas"), en vez
    # de al final de la lista — orden explícito pedido por el usuario.
    {'slug': 'usuarios', 'nombre': 'Usuarios', 'ruta': '/usuarios', 'roles': [ROL_ADMIN]},
    {'slug': 'sucursales', 'nombre': 'Sucursales', 'ruta': '/sucursales', 'roles': [ROL_ADMIN, ROL_OPERADOR]},
    {'slug': 'contabilidad', 'nombre': 'Contabilidad', 'ruta': '/contabilidad', 'roles': [ROL_ADMIN]},
    {'slug': 'configuracion_fiscal', 'nombre': 'Configuración Fiscal', 'ruta': '/configuracion-fiscal', 'roles': [ROL_ADMIN]},
]


def modulos_para_rol(rol):
    return [
        {'slug': m['slug'], 'nombre': m['nombre'], 'ruta': m['ruta']}
        for m in MODULOS
        if rol in m['roles']
    ]
