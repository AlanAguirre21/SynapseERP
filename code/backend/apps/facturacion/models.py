from django.conf import settings
from django.db import models


class Factura(models.Model):
    """CFDI generado a partir de una `Venta` (`011`) — feature `017 ·
    Facturación`. `plan.md` proponía `venta` como `OneToOneField`, pero el
    criterio de aceptación "cancelar una factura y, si aplica, volver a
    generar una nueva a partir de la misma venta" es incompatible con una
    relación 1:1 estricta a nivel de base de datos (bloquearía para
    siempre una segunda fila tras cancelar la primera). Se usa
    `ForeignKey`, y la regla real — "como máximo una factura vigente por
    venta" — se aplica en `FacturaViewSet.create()`, no en el esquema;
    así se conserva el historial de intentos con error y de facturas ya
    canceladas en vez de perderlo.
    """

    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_TIMBRADA = 'timbrada'
    ESTADO_PENDIENTE_CANCELACION = 'pendiente_cancelacion'
    ESTADO_CANCELADA = 'cancelada'
    ESTADO_ERROR = 'error'
    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_TIMBRADA, 'Timbrada'),
        (ESTADO_PENDIENTE_CANCELACION, 'Pendiente de cancelación'),
        (ESTADO_CANCELADA, 'Cancelada'),
        (ESTADO_ERROR, 'Error'),
    ]

    METODO_PUE = 'PUE'
    METODO_PPD = 'PPD'
    METODO_PAGO_CHOICES = [
        (METODO_PUE, 'Pago en una sola exhibición'),
        (METODO_PPD, 'Pago en parcialidades o diferido'),
    ]

    MOTIVO_CANCELACION_CHOICES = [
        ('01', '01 — Comprobante emitido con errores con relación'),
        ('02', '02 — Comprobante emitido con errores sin relación'),
        ('03', '03 — No se llevó a cabo la operación'),
        ('04', '04 — Operación nominativa relacionada en una factura global'),
    ]

    venta = models.ForeignKey('ventas.Venta', on_delete=models.PROTECT, related_name='facturas')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='facturas')

    folio_fiscal = models.CharField('UUID fiscal', max_length=36, blank=True)
    serie = models.CharField(max_length=10, blank=True)
    folio_interno = models.PositiveIntegerField(null=True, blank=True)

    # Catálogos del SAT (uso de CFDI, forma de pago): se guardan como texto
    # libre, igual que `regimen_fiscal`/`uso_cfdi_default` en
    # `DatosFiscalesCliente` (008) — el catálogo vigente vive en el
    # frontend (`api/facturacion.ts`), no se duplica aquí como `choices`.
    uso_cfdi = models.CharField(max_length=4)
    forma_pago = models.CharField(max_length=2)
    metodo_pago = models.CharField(max_length=3, choices=METODO_PAGO_CHOICES)

    estado = models.CharField(max_length=25, choices=ESTADO_CHOICES, default=ESTADO_PENDIENTE)
    mensaje_error = models.TextField(blank=True)

    # Rutas relativas a `MEDIA_ROOT` — la descarga siempre pasa por las
    # acciones autenticadas de `FacturaViewSet`, nunca por una URL pública
    # de `MEDIA_URL`.
    xml_path = models.CharField(max_length=255, blank=True)
    pdf_path = models.CharField(max_length=255, blank=True)

    motivo_cancelacion = models.CharField(max_length=2, choices=MOTIVO_CANCELACION_CHOICES, blank=True)
    fecha_solicitud_cancelacion = models.DateTimeField(null=True, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True, db_index=True)
    fecha_timbrado = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = 'facturas'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f'Factura #{self.id} — venta #{self.venta_id} ({self.estado})'


class ComplementoPago(models.Model):
    """Complemento de Pago (REP) — CFDI propio, timbrado por separado del
    de la factura original, para reportar un pago parcial/diferido de una
    factura con `metodo_pago = PPD` (ver criterio de aceptación en
    `spec.md`).
    """

    ESTADO_TIMBRADO = 'timbrada'
    ESTADO_ERROR = 'error'
    ESTADO_CHOICES = [
        (ESTADO_TIMBRADO, 'Timbrado'),
        (ESTADO_ERROR, 'Error'),
    ]

    factura = models.ForeignKey(Factura, on_delete=models.PROTECT, related_name='complementos_pago')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='complementos_pago')

    monto_pagado = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_pago = models.DateField()

    folio_fiscal_rep = models.CharField('UUID fiscal del REP', max_length=36, blank=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default=ESTADO_TIMBRADO)
    mensaje_error = models.TextField(blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'complementos de pago'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f'Complemento de pago #{self.id} — factura #{self.factura_id}'
