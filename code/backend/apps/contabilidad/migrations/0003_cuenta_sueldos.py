"""Cuenta de sistema "Sueldos y salarios" (5300) para el pago de nómina desde
Caja — `008 · RRHH`, "Actualización: nómina con pago en caja", y `020 ·
Contabilidad`, "Actualización: cuenta Sueldos y salarios".

Código y nombre hardcodeados, como en `0002_cuentas_base.py`: una migración
es un snapshot congelado, independiente de `constants.py`. Idempotente: si
un admin ya hubiera creado una cuenta 5300, no se toca.
"""

from django.db import migrations


def crear_cuenta_sueldos(apps, schema_editor):
    CuentaContable = apps.get_model('contabilidad', 'CuentaContable')
    egresos = CuentaContable.objects.filter(codigo='5000').first()
    CuentaContable.objects.get_or_create(
        codigo='5300', defaults={'nombre': 'Sueldos y salarios', 'tipo': 'egreso', 'cuenta_padre': egresos},
    )


def eliminar_cuenta_sueldos(apps, schema_editor):
    CuentaContable = apps.get_model('contabilidad', 'CuentaContable')
    CuentaContable.objects.filter(codigo='5300', movimientos_contables__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('contabilidad', '0002_cuentas_base'),
    ]

    operations = [
        migrations.RunPython(crear_cuenta_sueldos, eliminar_cuenta_sueldos),
    ]
