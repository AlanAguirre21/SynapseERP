from django.conf import settings
from django.db import models


class CuentaContable(models.Model):
    """Catálogo de cuentas contables — feature `018 · Contabilidad`. CRUD
    exclusivo de admin. `cuenta_padre` da soporte de jerarquía (cuentas
    de agrupación como "Activo" sin movimientos propios, con subcuentas
    como "Caja"/"Inventario" que sí reciben `MovimientoContable`) — mismo
    patrón reutilizable de `activo` que el resto del proyecto: nunca hay
    borrado físico vía API, solo desactivación (`CuentaContableViewSet`
    además bloquea desactivar las cuentas que `generador_asientos.py`
    referencia en tiempo de ejecución, ver `constants.py`).
    """

    TIPO_ACTIVO = 'activo'
    TIPO_PASIVO = 'pasivo'
    TIPO_CAPITAL = 'capital'
    TIPO_INGRESO = 'ingreso'
    TIPO_EGRESO = 'egreso'
    TIPO_CHOICES = [
        (TIPO_ACTIVO, 'Activo'),
        (TIPO_PASIVO, 'Pasivo'),
        (TIPO_CAPITAL, 'Capital'),
        (TIPO_INGRESO, 'Ingreso'),
        (TIPO_EGRESO, 'Egreso'),
    ]

    codigo = models.CharField(max_length=10, unique=True)
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cuenta_padre = models.ForeignKey(
        'self', on_delete=models.PROTECT, null=True, blank=True, related_name='subcuentas',
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'cuentas contables'
        ordering = ['codigo']

    def __str__(self):
        return f'{self.codigo} — {self.nombre}'


class AsientoContable(models.Model):
    """Cabecera de un asiento contable — generado únicamente por
    `services/generador_asientos.py` a partir de una venta, compra o
    movimiento de caja ya existente. Sin creación manual desde la API
    (decisión explícita de `plan.md`): no hay `create`/`update`/`destroy`
    expuestos, `AsientoContableViewSet` es de solo lectura.
    """

    ORIGEN_VENTA = 'venta'
    ORIGEN_COMPRA = 'compra'
    ORIGEN_CAJA = 'caja'
    ORIGEN_AJUSTE = 'ajuste'
    TIPO_ORIGEN_CHOICES = [
        (ORIGEN_VENTA, 'Venta'),
        (ORIGEN_COMPRA, 'Compra'),
        (ORIGEN_CAJA, 'Caja'),
        (ORIGEN_AJUSTE, 'Ajuste'),
    ]

    # `db_index=True`: el libro diario y el balance de comprobación
    # filtran/agregan por rango de `fecha` en cada consulta — mismo
    # criterio que `Venta.fecha`/`Compra.fecha` en `014 · Dashboard`.
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)
    concepto = models.CharField(max_length=255)
    tipo_origen = models.CharField(max_length=10, choices=TIPO_ORIGEN_CHOICES)
    referencia_id = models.PositiveIntegerField(null=True, blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='asientos_contables')

    class Meta:
        verbose_name_plural = 'asientos contables'
        ordering = ['-fecha']

    def __str__(self):
        return f'Asiento #{self.id} — {self.concepto}'


class MovimientoContable(models.Model):
    """Línea de cargo/abono de un `AsientoContable`. INSERT-only, igual
    que `MovimientoCaja`/`MovimientoInventario` — nunca se edita ni se
    borra un movimiento contable ya creado; la única forma de corregir
    una operación es revertir la venta/compra/movimiento de caja que la
    originó, lo cual genera su propio asiento inverso.
    """

    CARGO = 'cargo'
    ABONO = 'abono'
    TIPO_MOVIMIENTO_CHOICES = [
        (CARGO, 'Cargo'),
        (ABONO, 'Abono'),
    ]

    asiento = models.ForeignKey(AsientoContable, on_delete=models.CASCADE, related_name='movimientos')
    cuenta_contable = models.ForeignKey(
        CuentaContable, on_delete=models.PROTECT, related_name='movimientos_contables',
    )
    tipo_movimiento = models.CharField(max_length=5, choices=TIPO_MOVIMIENTO_CHOICES)
    monto = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name_plural = 'movimientos contables'

    def __str__(self):
        return f'{self.tipo_movimiento} {self.monto} — {self.cuenta_contable.codigo}'
