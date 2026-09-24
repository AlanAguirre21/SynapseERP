"""Precarga el catálogo de cuentas contables base — sin esto, el sistema
arrancaría sin ninguna cuenta configurada y la primera venta/compra
fallaría al intentar generar su asiento (ver `plan.md`, Decisiones).

Los códigos van hardcodeados aquí en vez de importarse de
`apps.contabilidad.constants` a propósito: una migración debe ser un
snapshot congelado en el tiempo, independiente de que ese módulo cambie
después.
"""

from django.db import migrations

# (codigo, nombre, tipo, codigo_padre) — padres siempre antes que hijos.
CUENTAS_BASE = [
    ('1000', 'Activo', 'activo', None),
    ('1100', 'Caja', 'activo', '1000'),
    ('1200', 'Clientes', 'activo', '1000'),
    ('1300', 'Inventario', 'activo', '1000'),
    ('2000', 'Pasivo', 'pasivo', None),
    ('2100', 'Proveedores', 'pasivo', '2000'),
    ('3000', 'Capital', 'capital', None),
    ('4000', 'Ingresos', 'ingreso', None),
    ('4100', 'Ventas', 'ingreso', '4000'),
    ('5000', 'Egresos', 'egreso', None),
    ('5100', 'Costo de ventas', 'egreso', '5000'),
    ('5200', 'Gastos generales', 'egreso', '5000'),
]


def cargar_catalogo_base(apps, schema_editor):
    CuentaContable = apps.get_model('contabilidad', 'CuentaContable')
    por_codigo = {}
    for codigo, nombre, tipo, codigo_padre in CUENTAS_BASE:
        cuenta_padre = por_codigo.get(codigo_padre) if codigo_padre else None
        cuenta, _ = CuentaContable.objects.get_or_create(
            codigo=codigo, defaults={'nombre': nombre, 'tipo': tipo, 'cuenta_padre': cuenta_padre},
        )
        por_codigo[codigo] = cuenta


def eliminar_catalogo_base(apps, schema_editor):
    CuentaContable = apps.get_model('contabilidad', 'CuentaContable')
    # Hijos primero, en un `.delete()` aparte — `cuenta_padre` usa
    # `on_delete=PROTECT`, así que un padre con hijos aún presentes no se
    # puede borrar en la misma pasada (catálogo de 2 niveles: todo código
    # con `codigo_padre` es hoja).
    codigos_hijo = [codigo for codigo, _, _, padre in CUENTAS_BASE if padre]
    codigos_raiz = [codigo for codigo, _, _, padre in CUENTAS_BASE if not padre]
    CuentaContable.objects.filter(codigo__in=codigos_hijo).delete()
    CuentaContable.objects.filter(codigo__in=codigos_raiz).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('contabilidad', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(cargar_catalogo_base, eliminar_catalogo_base),
    ]
