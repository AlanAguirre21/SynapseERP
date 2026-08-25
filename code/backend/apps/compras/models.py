from django.conf import settings
from django.db import models


class Compra(models.Model):
    """Cabecera de una compra a un proveedor — feature 010 · Compras.

    `estado` es de solo lectura desde la API general: pasa de `pendiente` a
    `recibida`/`cancelada` únicamente a través de las acciones dedicadas
    `recibir()`/`cancelar()` de `CompraViewSet`, nunca por un `PATCH`
    genérico — esos endpoints son los que disparan los efectos de
    inventario (ver `views.py`).
    """

    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_RECIBIDA = 'recibida'
    ESTADO_CANCELADA = 'cancelada'
    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_RECIBIDA, 'Recibida'),
        (ESTADO_CANCELADA, 'Cancelada'),
    ]

    proveedor = models.ForeignKey('personas.Proveedor', on_delete=models.PROTECT, related_name='compras')
    sucursal = models.ForeignKey('sucursales.Sucursal', on_delete=models.PROTECT, related_name='compras')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='compras')
    # `db_index=True`: 014 · Dashboard filtra/agrega por rango de `fecha`
    # en cada carga (día/semana/mes) — sin índice, esa consulta escanea
    # toda la tabla conforme crece.
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)
    fecha_entrega = models.DateField(null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_PENDIENTE)

    class Meta:
        verbose_name_plural = 'compras'
        ordering = ['-fecha']

    def __str__(self):
        return f'Compra #{self.id} — {self.proveedor} ({self.estado})'


class DetalleCompraProducto(models.Model):
    """Línea de compra de un producto terminado. `costo_unitario`/
    `subtotal` se congelan al crear la compra — nunca se recalculan si
    cambia `Producto.costo_produccion` después (regla de congelamiento
    cabecera-detalle de `tech-stack.md`).
    """

    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name='detalles_producto')
    producto = models.ForeignKey('catalogo.Producto', on_delete=models.PROTECT, related_name='detalles_compra')
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f'{self.cantidad} x {self.producto} (compra #{self.compra_id})'


class DetalleCompraMateriaPrima(models.Model):
    """Línea de compra de materia prima. Ver nota de congelamiento en
    `DetalleCompraProducto`.
    """

    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name='detalles_materia_prima')
    materia_prima = models.ForeignKey(
        'catalogo.MateriaPrima', on_delete=models.PROTECT, related_name='detalles_compra',
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f'{self.cantidad} x {self.materia_prima} (compra #{self.compra_id})'
