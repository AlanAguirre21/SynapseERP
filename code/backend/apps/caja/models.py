from decimal import Decimal

from django.conf import settings
from django.db import models


class MovimientoCaja(models.Model):
    """Movimiento de caja global a la empresa — sin `sucursal`, por
    principio de la constitución (ganancias/caja no se segmentan por
    sucursal). Creado en `011 · Ventas` para el ingreso automático al
    confirmar una venta y su reverso al cancelarla; `013 · Caja` agrega el
    registro manual de ingreso/retiro (motivo `manual`) y la vista de
    consulta, reutilizando el mismo modelo y migración inicial.

    INSERT-only, igual que `MovimientoInventario` — ninguna corrección se
    hace vía `UPDATE`/`DELETE`, siempre con un movimiento inverso.

    `saldo_resultante` se calcula sobre el saldo del movimiento anterior
    (`services.registrar_movimiento_caja`), bloqueado con
    `select_for_update()` — nunca recalculando la suma de toda la tabla —
    para que dos movimientos concurrentes (ej. una venta y un retiro
    manual simultáneos) no lean el mismo saldo "seguro" antes de que
    ninguno se confirme.
    """

    INGRESO = 'ingreso'
    RETIRO = 'retiro'
    TIPO_MOVIMIENTO_CHOICES = [
        (INGRESO, 'Ingreso'),
        (RETIRO, 'Retiro'),
    ]

    MOTIVO_VENTA = 'venta'
    MOTIVO_AJUSTE = 'ajuste'
    MOTIVO_MANUAL = 'manual'
    MOTIVO_COMPRA = 'compra'
    MOTIVO_ENVIO = 'envio'
    MOTIVO_CHOICES = [
        (MOTIVO_VENTA, 'Venta'),
        (MOTIVO_AJUSTE, 'Ajuste'),
        (MOTIVO_MANUAL, 'Manual'),
        (MOTIVO_COMPRA, 'Compra'),
        (MOTIVO_ENVIO, 'Envío'),
    ]

    monto = models.DecimalField(max_digits=12, decimal_places=2)
    tipo_movimiento = models.CharField(max_length=10, choices=TIPO_MOVIMIENTO_CHOICES)
    motivo = models.CharField(max_length=20, choices=MOTIVO_CHOICES)
    referencia_id = models.PositiveIntegerField(null=True, blank=True)
    saldo_resultante = models.DecimalField(max_digits=12, decimal_places=2)
    # Saldo acumulado exclusivo de movimientos `motivo=envio` — respaldo del
    # ajuste "saldo adicional por costo de envío" (`013 · Caja`): se arrastra
    # igual que `saldo_resultante` en cualquier otro movimiento, y solo
    # cambia cuando `motivo == MOTIVO_ENVIO`. `saldo_actual` (el que excluye
    # envío) se deriva como `saldo_resultante - saldo_adicional_resultante`,
    # nunca se guarda por separado.
    saldo_adicional_resultante = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    observacion = models.TextField(blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='movimientos_caja')
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'movimientos de caja'
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.tipo_movimiento} de {self.monto} ({self.motivo})'
