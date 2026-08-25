from django.db import models


class Categoria(models.Model):
    """CRUD completo — feature 007 · Catálogo."""

    TIPO_PRODUCTO = 'producto'
    TIPO_MATERIA_PRIMA = 'materia_prima'
    TIPO_AMBOS = 'ambos'
    TIPO_CHOICES = [
        (TIPO_PRODUCTO, 'Producto'),
        (TIPO_MATERIA_PRIMA, 'Materia prima'),
        (TIPO_AMBOS, 'Ambos'),
    ]

    nombre_categoria = models.CharField(max_length=100)
    descripcion_categoria = models.TextField(blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'categorías'

    def __str__(self):
        return self.nombre_categoria


class Producto(models.Model):
    """CRUD completo — feature 007 · Catálogo. No incluye todavía todos los
    campos de Base de Datos FleboSil.txt (ej. fecha_registro), solo lo
    necesario para catálogo/inventario/alertas.
    """

    nombre_producto = models.CharField(max_length=150)
    sku = models.CharField(max_length=50, unique=True)
    unidad_medida = models.CharField(max_length=30)
    descripcion_producto = models.TextField(blank=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='productos')
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2)
    costo_produccion = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_producto


class MateriaPrima(models.Model):
    """CRUD completo — feature 007 · Catálogo. `proveedor_principal` se
    agregó en la feature 008 · Personas mediante un `AddField` separado,
    una vez existió el modelo `Proveedor` — una FK no puede declararse
    apuntando a un modelo que todavía no está en el registro de apps de
    Django.
    """

    nombre_item = models.CharField(max_length=150)
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='materias_primas')
    unidad_medida = models.CharField(max_length=30)
    costo_promedio = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    proveedor_principal = models.ForeignKey(
        'personas.Proveedor', on_delete=models.SET_NULL, null=True, blank=True, related_name='materias_primas',
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'materias primas'

    def __str__(self):
        return self.nombre_item
