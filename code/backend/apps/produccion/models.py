from django.conf import settings
from django.db import models


class Receta(models.Model):
    """Una línea de receta: cuánta materia prima se necesita por cada
    unidad de `producto` producida. La receta completa de un producto es
    el conjunto de filas `Receta` activas con ese `producto` — no hay un
    modelo "Receta" único por producto, sino una por cada ingrediente.

    CRUD restringido a admin; operador solo consulta (mismo criterio que
    Catálogo). Soft-delete vía `activo`, igual que el resto del catálogo.
    """

    producto = models.ForeignKey('catalogo.Producto', on_delete=models.PROTECT, related_name='receta')
    materia_prima = models.ForeignKey('catalogo.MateriaPrima', on_delete=models.PROTECT, related_name='usada_en_recetas')
    cantidad_requerida = models.DecimalField(max_digits=12, decimal_places=2)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'recetas'
        unique_together = ('producto', 'materia_prima')

    def __str__(self):
        return f'{self.cantidad_requerida} de {self.materia_prima} por {self.producto}'


class Produccion(models.Model):
    """Cabecera de un lote de producción — feature 012 · Producción.

    No tiene `estado`: a diferencia de Compras/Ventas, una producción
    confirmada no admite edición, cancelación ni reversión (fuera de
    alcance explícito de `spec.md`, dada la complejidad de revertir
    varios consumos de materia prima a la vez) — es un hecho histórico
    fijo desde el momento en que se crea.
    """

    producto = models.ForeignKey('catalogo.Producto', on_delete=models.PROTECT, related_name='producciones')
    sucursal = models.ForeignKey('sucursales.Sucursal', on_delete=models.PROTECT, related_name='producciones')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='producciones')
    cantidad_producida = models.DecimalField(max_digits=12, decimal_places=2)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'producciones'
        ordering = ['-fecha']

    def __str__(self):
        return f'Producción #{self.id} — {self.cantidad_producida} de {self.producto}'


class DetalleProduccion(models.Model):
    """Snapshot de una materia prima consumida en una producción.
    `costo_unitario_momento`/`subtotal` congelan el `costo_promedio`
    vigente de la materia prima al momento de producir — si la receta o
    el costo cambian después, este registro no se altera (regla de
    congelamiento cabecera-detalle de `tech-stack.md`).
    """

    produccion = models.ForeignKey(Produccion, on_delete=models.CASCADE, related_name='detalles')
    materia_prima = models.ForeignKey(
        'catalogo.MateriaPrima', on_delete=models.PROTECT, related_name='consumida_en_producciones',
    )
    cantidad_consumida = models.DecimalField(max_digits=12, decimal_places=2)
    costo_unitario_momento = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f'{self.cantidad_consumida} de {self.materia_prima} (producción #{self.produccion_id})'
