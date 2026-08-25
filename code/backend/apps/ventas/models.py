from django.conf import settings
from django.db import models


class Venta(models.Model):
    """Cabecera de una venta — feature 011 · Ventas.

    A diferencia de `Compra` (que separa creación y recepción), aquí el
    stock y el ingreso de caja se descuentan/registran en el mismo paso de
    creación — no hay estado intermedio "por confirmar" (ver Decisiones de
    `plan.md`). `estado` solo cambia después vía las acciones dedicadas
    `entregar()`/`cancelar()`, nunca por un `PATCH` genérico.
    """

    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_ENTREGADA = 'entregada'
    ESTADO_CANCELADA = 'cancelada'
    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_ENTREGADA, 'Entregada'),
        (ESTADO_CANCELADA, 'Cancelada'),
    ]

    cliente = models.ForeignKey(
        'personas.Cliente', on_delete=models.PROTECT, null=True, blank=True, related_name='ventas',
    )
    sucursal = models.ForeignKey('sucursales.Sucursal', on_delete=models.PROTECT, related_name='ventas')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='ventas')
    fecha = models.DateTimeField(auto_now_add=True)
    fecha_entrega = models.DateField(null=True, blank=True)
    fecha_entrega_real = models.DateTimeField(null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_ENTREGADA)

    class Meta:
        verbose_name_plural = 'ventas'
        ordering = ['-fecha']

    def __str__(self):
        return f'Venta #{self.id} — {self.cliente or "sin cliente"} ({self.estado})'


class DetalleVenta(models.Model):
    """Línea de venta de un producto. `precio_unitario`/`subtotal` se
    congelan al crear la venta a partir del `precio_venta` vigente del
    producto en ese momento — nunca se recalculan si el precio cambia
    después (regla de congelamiento cabecera-detalle de `tech-stack.md`).
    Ventas solo vende `Producto`, nunca `MateriaPrima` directamente.
    """

    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey('catalogo.Producto', on_delete=models.PROTECT, related_name='detalles_venta')
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f'{self.cantidad} x {self.producto} (venta #{self.venta_id})'
