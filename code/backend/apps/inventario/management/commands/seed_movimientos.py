"""Datos de prueba para verificar manualmente la feature 009 · Inventario,
antes de que existan Compras/Ventas/Producción (las features que en
producción generarán estos movimientos). No es parte de la aplicación —
borrar cuando exista un seed/fixture real.

Ejecutar con: python manage.py seed_movimientos
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.inventario.models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
)
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario


class Command(BaseCommand):
    help = (
        'Inserta movimientos de inventario ficticios (compra/venta/producción) para poder '
        'probar visualmente la feature 009 · Inventario. Es idempotente: no hace nada si ya '
        'existe algún MovimientoInventario.'
    )

    def handle(self, *args, **options):
        if MovimientoInventario.objects.exists():
            self.stdout.write('Ya existen movimientos de inventario — no se insertó nada nuevo.')
            return

        usuario = Usuario.objects.filter(email='admin@flebosil.test').first() or Usuario.objects.first()
        if usuario is None:
            self.stderr.write(
                'No hay ningún usuario en la base de datos — corre antes '
                '"python manage.py shell < seed_dev.py".',
            )
            return

        sucursal, _ = Sucursal.objects.get_or_create(
            nombre_sucursal='Matriz', defaults={'ubicacion_sucursal': 'CDMX'},
        )
        categoria, _ = Categoria.objects.get_or_create(
            nombre_categoria='General', defaults={'tipo': Categoria.TIPO_AMBOS},
        )
        producto, _ = Producto.objects.get_or_create(
            sku='SKU-DEV-1',
            defaults={
                'nombre_producto': 'Suero fisiológico 1L', 'unidad_medida': 'pza',
                'categoria': categoria, 'precio_venta': '45.00',
            },
        )
        materia_prima, _ = MateriaPrima.objects.get_or_create(
            nombre_item='Cloruro de sodio', defaults={'unidad_medida': 'kg', 'categoria': categoria},
        )

        movimientos = [
            (
                MovimientoInventario.TIPO_PRODUCTO, producto.id, MovimientoInventario.ENTRADA,
                Decimal('20.00'), MovimientoInventario.MOTIVO_COMPRA, Decimal('20.00'),
            ),
            (
                MovimientoInventario.TIPO_PRODUCTO, producto.id, MovimientoInventario.SALIDA,
                Decimal('18.00'), MovimientoInventario.MOTIVO_VENTA, Decimal('2.00'),
            ),
            (
                MovimientoInventario.TIPO_MATERIA_PRIMA, materia_prima.id, MovimientoInventario.ENTRADA,
                Decimal('10.00'), MovimientoInventario.MOTIVO_COMPRA, Decimal('10.00'),
            ),
            (
                MovimientoInventario.TIPO_MATERIA_PRIMA, materia_prima.id, MovimientoInventario.SALIDA,
                Decimal('9.00'), MovimientoInventario.MOTIVO_PRODUCCION_CONSUMO, Decimal('1.00'),
            ),
        ]

        for tipo_item, item_id, tipo_movimiento, cantidad, motivo, stock_resultante in movimientos:
            MovimientoInventario.objects.create(
                sucursal=sucursal, tipo_item=tipo_item, item_id=item_id, tipo_movimiento=tipo_movimiento,
                cantidad=cantidad, motivo=motivo, stock_resultante=stock_resultante, usuario=usuario,
            )

        # Deja `stock_actual` consistente con el último movimiento de cada ítem,
        # igual que quedaría tras aplicar Compras/Ventas/Producción reales.
        InventarioSucursalProducto.objects.update_or_create(
            sucursal=sucursal, producto=producto, defaults={'stock_actual': '2.00', 'stock_minimo': '10.00'},
        )
        InventarioSucursalMateriaPrima.objects.update_or_create(
            sucursal=sucursal, materia_prima=materia_prima, defaults={'stock_actual': '1.00', 'stock_minimo': '5.00'},
        )

        self.stdout.write(self.style.SUCCESS('Movimientos de inventario ficticios insertados.'))
