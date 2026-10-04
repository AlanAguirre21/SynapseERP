from django.conf import settings
from django.db import models

from apps.catalogo.models import MateriaPrima, Producto
from apps.sucursales.models import Sucursal


class InventarioSucursalProducto(models.Model):
    """Modelo mínimo — la feature 009 · Inventario agrega el resto
    (MovimientoInventario, historial, etc.). Aquí solo lo necesario para el
    endpoint de alertas de stock de la feature 001 · Header.
    """

    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE, related_name='inventario_productos')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='inventarios')
    stock_actual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        unique_together = ('sucursal', 'producto')

    def __str__(self):
        return f'{self.producto} @ {self.sucursal}'


class InventarioSucursalMateriaPrima(models.Model):
    """Modelo mínimo — ver nota en InventarioSucursalProducto."""

    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE, related_name='inventario_materia_prima')
    materia_prima = models.ForeignKey(MateriaPrima, on_delete=models.CASCADE, related_name='inventarios')
    stock_actual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        unique_together = ('sucursal', 'materia_prima')

    def __str__(self):
        return f'{self.materia_prima} @ {self.sucursal}'


class MovimientoInventario(models.Model):
    """Historial INSERT-only de cambios de stock — feature 009 · Inventario.

    `item_id` no es una FK real de Django: junto con `tipo_item` referencia
    de forma polimórfica a `Producto` o `MateriaPrima` (dos tablas
    distintas), y `referencia_id` de la misma forma a la operación de
    origen (Compra/Venta/Producción, ninguna existe todavía). Es la misma
    decisión de diseño que en `HistorialEstadoSucursal` (006): en una tabla
    de auditoría se prioriza un registro cronológico único sobre
    integridad referencial estricta hacia varias tablas.

    Nombres de campo (`fecha`, `motivo`, `usuario`, `sucursal`) bare, sin
    sufijo de entidad — sigue el precedente de `HistorialEstadoSucursal`
    (tabla de auditoría), no el de las entidades de catálogo.
    """

    TIPO_PRODUCTO = 'producto'
    TIPO_MATERIA_PRIMA = 'materia_prima'
    TIPO_ITEM_CHOICES = [
        (TIPO_PRODUCTO, 'Producto'),
        (TIPO_MATERIA_PRIMA, 'Materia prima'),
    ]

    ENTRADA = 'entrada'
    SALIDA = 'salida'
    TIPO_MOVIMIENTO_CHOICES = [
        (ENTRADA, 'Entrada'),
        (SALIDA, 'Salida'),
    ]

    MOTIVO_COMPRA = 'compra'
    MOTIVO_VENTA = 'venta'
    MOTIVO_PRODUCCION_CONSUMO = 'produccion_consumo'
    MOTIVO_PRODUCCION_ENTRADA = 'produccion_entrada'
    MOTIVO_AJUSTE = 'ajuste'
    MOTIVO_TRASLADO_SALIDA = 'traslado_salida'
    MOTIVO_TRASLADO_ENTRADA = 'traslado_entrada'
    MOTIVOS_TRASLADO = (MOTIVO_TRASLADO_SALIDA, MOTIVO_TRASLADO_ENTRADA)
    MOTIVO_CHOICES = [
        (MOTIVO_COMPRA, 'Compra'),
        (MOTIVO_VENTA, 'Venta'),
        (MOTIVO_PRODUCCION_CONSUMO, 'Consumo de producción'),
        (MOTIVO_PRODUCCION_ENTRADA, 'Entrada de producción'),
        (MOTIVO_AJUSTE, 'Ajuste'),
        (MOTIVO_TRASLADO_SALIDA, 'Traslado (salida)'),
        (MOTIVO_TRASLADO_ENTRADA, 'Traslado (entrada)'),
    ]

    sucursal = models.ForeignKey(Sucursal, on_delete=models.PROTECT, related_name='movimientos_inventario')
    tipo_item = models.CharField(max_length=20, choices=TIPO_ITEM_CHOICES)
    item_id = models.PositiveIntegerField()
    tipo_movimiento = models.CharField(max_length=10, choices=TIPO_MOVIMIENTO_CHOICES)
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    motivo = models.CharField(max_length=20, choices=MOTIVO_CHOICES)
    referencia_id = models.PositiveIntegerField(null=True, blank=True)
    stock_resultante = models.DecimalField(max_digits=12, decimal_places=2)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='movimientos_inventario')
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'movimientos de inventario'
        indexes = [
            models.Index(fields=['sucursal']),
            models.Index(fields=['tipo_item', 'item_id']),
            models.Index(fields=['fecha']),
        ]
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.tipo_movimiento} de {self.cantidad} ({self.tipo_item} #{self.item_id}) @ {self.sucursal}'


class Traslado(models.Model):
    """Cabecera de un traslado de stock entre dos sucursales — feature 011,
    ampliación. INSERT-only: un traslado erróneo se corrige registrando el
    traslado inverso, nunca editando ni borrando este registro.

    Sus líneas (`DetalleTraslado`) pueden mezclar productos y materia
    prima. Cada línea genera dos `MovimientoInventario` (salida en origen,
    entrada en destino) con `referencia_id = traslado.id`. Nombres de campo
    sin sufijo de entidad, siguiendo el precedente de `Venta`.
    """

    sucursal_origen = models.ForeignKey(Sucursal, on_delete=models.PROTECT, related_name='traslados_salida')
    sucursal_destino = models.ForeignKey(Sucursal, on_delete=models.PROTECT, related_name='traslados_entrada')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='traslados')
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-fecha']
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(sucursal_origen=models.F('sucursal_destino')),
                name='traslado_origen_distinto_destino',
            ),
        ]

    def __str__(self):
        return f'Traslado #{self.pk}: {self.sucursal_origen} → {self.sucursal_destino}'


class DetalleTraslado(models.Model):
    """Línea de un `Traslado`. Referencia polimórfica (`tipo_item` +
    `item_id`) igual que `MovimientoInventario`, para poder mezclar
    productos y materia prima en una sola tabla de detalle — una línea de
    traslado no tiene campos propios de cada tipo (ni costo ni precio).
    """

    traslado = models.ForeignKey(Traslado, on_delete=models.CASCADE, related_name='detalles')
    tipo_item = models.CharField(max_length=20, choices=MovimientoInventario.TIPO_ITEM_CHOICES)
    item_id = models.PositiveIntegerField()
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(cantidad__gt=0), name='detalle_traslado_cantidad_positiva'),
            models.UniqueConstraint(
                fields=['traslado', 'tipo_item', 'item_id'], name='detalle_traslado_item_unico',
            ),
        ]

    def __str__(self):
        return f'{self.cantidad} ({self.tipo_item} #{self.item_id}) en traslado #{self.traslado_id}'
