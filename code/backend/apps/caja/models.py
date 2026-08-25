from django.conf import settings
from django.db import models


class MovimientoCaja(models.Model):
    """Movimiento de caja global a la empresa — sin `sucursal`, por
    principio de la constitución (ganancias/caja no se segmentan por
    sucursal). Modelo mínimo: la feature 013 · Caja agrega el resto (vista
    de movimientos, registro manual de ingreso/retiro). Aquí solo lo
    necesario para que `011 · Ventas` genere el ingreso automático al
    confirmar una venta, y su reverso al cancelarla.

    INSERT-only, igual que `MovimientoInventario` — ninguna corrección se
    hace vía `UPDATE`/`DELETE`, siempre con un movimiento inverso.

    `saldo_resultante` se calcula sumando/restando sobre el total de
    movimientos previos (`services.calcular_saldo_actual`) sin bloqueo
    adicional a nivel de fila — aceptable para el volumen esperado (5-10
    usuarios) mientras no existe todavía un mecanismo de saldo global
    bloqueable; `013 · Caja`, al definir el resto del módulo, debe revisar
    si hace falta serializar esta lectura bajo concurrencia real.
    """

    INGRESO = 'ingreso'
    RETIRO = 'retiro'
    TIPO_MOVIMIENTO_CHOICES = [
        (INGRESO, 'Ingreso'),
        (RETIRO, 'Retiro'),
    ]

    MOTIVO_VENTA = 'venta'
    MOTIVO_GASTO = 'gasto'
    MOTIVO_AJUSTE = 'ajuste'
    MOTIVO_RETIRO = 'retiro'
    MOTIVO_CHOICES = [
        (MOTIVO_VENTA, 'Venta'),
        (MOTIVO_GASTO, 'Gasto'),
        (MOTIVO_AJUSTE, 'Ajuste'),
        (MOTIVO_RETIRO, 'Retiro'),
    ]

    monto = models.DecimalField(max_digits=12, decimal_places=2)
    tipo_movimiento = models.CharField(max_length=10, choices=TIPO_MOVIMIENTO_CHOICES)
    motivo = models.CharField(max_length=20, choices=MOTIVO_CHOICES)
    referencia_id = models.PositiveIntegerField(null=True, blank=True)
    saldo_resultante = models.DecimalField(max_digits=12, decimal_places=2)
    observacion = models.TextField(blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='movimientos_caja')
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'movimientos de caja'
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.tipo_movimiento} de {self.monto} ({self.motivo})'
