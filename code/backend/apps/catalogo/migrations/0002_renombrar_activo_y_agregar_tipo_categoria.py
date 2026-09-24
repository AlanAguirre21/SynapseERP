import django.db.models.deletion
from django.db import migrations, models


def asignar_categoria_por_defecto(apps, schema_editor):
    MateriaPrima = apps.get_model('catalogo', 'MateriaPrima')
    Categoria = apps.get_model('catalogo', 'Categoria')
    if not MateriaPrima.objects.filter(categoria__isnull=True).exists():
        return
    categoria_defecto, _ = Categoria.objects.get_or_create(
        nombre_categoria='General',
        defaults={'tipo': 'ambos'},
    )
    MateriaPrima.objects.filter(categoria__isnull=True).update(categoria=categoria_defecto)


def revertir_categoria_por_defecto(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalogo', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='categoria',
            old_name='activo_categoria',
            new_name='activo',
        ),
        migrations.RenameField(
            model_name='producto',
            old_name='activo_producto',
            new_name='activo',
        ),
        migrations.RenameField(
            model_name='producto',
            old_name='precio_unitario',
            new_name='precio_venta',
        ),
        migrations.RenameField(
            model_name='materiaprima',
            old_name='activo_item',
            new_name='activo',
        ),
        migrations.AddField(
            model_name='categoria',
            name='tipo',
            field=models.CharField(
                choices=[
                    ('producto', 'Producto'),
                    ('materia_prima', 'Materia prima'),
                    ('ambos', 'Ambos'),
                ],
                default='ambos',
                max_length=20,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='materiaprima',
            name='categoria',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='materias_primas',
                to='catalogo.categoria',
            ),
        ),
        migrations.RunPython(asignar_categoria_por_defecto, revertir_categoria_por_defecto),
        migrations.AlterField(
            model_name='materiaprima',
            name='categoria',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='materias_primas',
                to='catalogo.categoria',
            ),
        ),
    ]
