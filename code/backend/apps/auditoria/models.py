from django.conf import settings
from django.db import models

from apps.inventario.models import MovimientoInventario
from apps.sucursales.models import Sucursal


class EjecucionAuditoria(models.Model):
    """Una corrida de la conciliación de caja o de la auditoría de
    inventario — `022 · Auditoría automatizada`. La crea el management
    command `ejecutar_auditorias` (cron, `origen=programada`) o el botón
    "Ejecutar ahora" del admin (`origen=manual`), siempre a través de
    `services.ejecutar_auditoria()`.
    """

    TIPO_CAJA = 'caja'
    TIPO_INVENTARIO = 'inventario'
    TIPO_CHOICES = [
        (TIPO_CAJA, 'Conciliación de caja'),
        (TIPO_INVENTARIO, 'Auditoría de inventario'),
    ]

    ORIGEN_PROGRAMADA = 'programada'
    ORIGEN_MANUAL = 'manual'
    ORIGEN_CHOICES = [
        (ORIGEN_PROGRAMADA, 'Programada'),
        (ORIGEN_MANUAL, 'Manual'),
    ]

    ESTADO_EN_CURSO = 'en_curso'
    ESTADO_EXITOSA = 'exitosa'
    ESTADO_FALLIDA = 'fallida'
    ESTADO_CHOICES = [
        (ESTADO_EN_CURSO, 'En curso'),
        (ESTADO_EXITOSA, 'Exitosa'),
        (ESTADO_FALLIDA, 'Fallida'),
    ]

    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    origen = models.CharField(max_length=20, choices=ORIGEN_CHOICES)
    # Vacío cuando la inició el cron.
    iniciada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name='ejecuciones_auditoria',
    )
    fecha_inicio = models.DateTimeField(auto_now_add=True, db_index=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_EN_CURSO)
    elementos_revisados = models.PositiveIntegerField(default=0)
    discrepancias_encontradas = models.PositiveIntegerField(default=0)
    mensaje_error = models.TextField(blank=True)
    # Solo conciliación de caja: id del último `MovimientoCaja` cuya cadena de
    # saldos se verificó; la siguiente ejecución continúa desde ahí.
    ultimo_movimiento_caja_verificado = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-fecha_inicio', '-id']

    def __str__(self):
        return f'Ejecución #{self.pk} ({self.tipo}, {self.estado})'


class CorteCaja(models.Model):
    """Efectivo contado físicamente por el admin en un momento dado. Se
    compara contra el `saldo_resultante` (saldo total, incluye envíos) del
    último `MovimientoCaja` registrado hasta `fecha_hora_corte`.

    INSERT-only: un corte mal capturado se corrige con un corte nuevo que lo
    `reemplaza` (solo si el original no se ha auditado); nunca se edita.
    """

    fecha_hora_corte = models.DateTimeField(db_index=True)
    monto_contado = models.DecimalField(max_digits=12, decimal_places=2)
    observacion = models.TextField(blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cortes_caja')
    fecha_registro = models.DateTimeField(auto_now_add=True)
    # `OneToOne`: un corte solo puede reemplazarse una vez.
    reemplaza = models.OneToOneField(
        'self', on_delete=models.PROTECT, null=True, blank=True, related_name='reemplazado_por',
    )
    # Se fijan al auditarse; un corte con ejecución ya no es "pendiente".
    # `saldo_esperado` guarda el saldo derivado contra el que se comparó.
    ejecucion = models.ForeignKey(
        EjecucionAuditoria, on_delete=models.PROTECT, null=True, blank=True, related_name='cortes',
    )
    saldo_esperado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['-fecha_hora_corte', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(monto_contado__gte=0), name='corte_caja_monto_no_negativo'),
        ]

    def __str__(self):
        return f'Corte #{self.pk} ({self.fecha_hora_corte:%Y-%m-%d %H:%M})'


class ConteoFisico(models.Model):
    """Cabecera de un conteo físico de inventario en una sucursal. Sus
    líneas (`DetalleConteoFisico`) congelan el stock teórico del momento de
    la captura. INSERT-only salvo el descarte por un admin, que solo marca
    el conteo (nunca lo borra) y solo si todavía no se auditó.
    """

    sucursal = models.ForeignKey(Sucursal, on_delete=models.PROTECT, related_name='conteos_fisicos')
    fecha_conteo = models.DateTimeField(auto_now_add=True, db_index=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='conteos_fisicos')
    observacion = models.TextField(blank=True)
    descartado = models.BooleanField(default=False)
    descartado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name='conteos_descartados',
    )
    fecha_descarte = models.DateTimeField(null=True, blank=True)
    ejecucion = models.ForeignKey(
        EjecucionAuditoria, on_delete=models.PROTECT, null=True, blank=True, related_name='conteos',
    )

    class Meta:
        ordering = ['-fecha_conteo', '-id']

    def __str__(self):
        return f'Conteo #{self.pk} @ {self.sucursal}'


class DetalleConteoFisico(models.Model):
    """Línea de un conteo. Referencia polimórfica (`tipo_item` + `item_id`),
    igual que `DetalleTraslado`/`MovimientoInventario`, para mezclar
    productos y materia prima en un mismo conteo.

    `stock_teorico` es el `stock_actual` congelado al guardar el conteo
    (mismo principio que el precio en `DetalleVenta`): la auditoría compara
    contra el valor de ese instante, no contra el stock del día en que corre.
    """

    conteo = models.ForeignKey(ConteoFisico, on_delete=models.PROTECT, related_name='detalles')
    tipo_item = models.CharField(max_length=20, choices=MovimientoInventario.TIPO_ITEM_CHOICES)
    item_id = models.PositiveIntegerField()
    cantidad_contada = models.DecimalField(max_digits=12, decimal_places=2)
    stock_teorico = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cantidad_contada__gte=0), name='detalle_conteo_cantidad_no_negativa',
            ),
            models.UniqueConstraint(fields=['conteo', 'tipo_item', 'item_id'], name='detalle_conteo_item_unico'),
        ]

    def __str__(self):
        return f'{self.tipo_item} #{self.item_id}: {self.cantidad_contada}'


class DiscrepanciaAuditoria(models.Model):
    """Hallazgo de una ejecución: un valor esperado que no coincide con el
    registrado. `estado` sí se actualiza al resolverse (como
    `SolicitudNomina.estado` en `008`): la regla insert-only aplica a los
    libros y a las capturas, no al estado de revisión de un hallazgo.
    """

    CATEGORIA_CAJA_CORTE = 'caja_corte'
    CATEGORIA_CAJA_INTEGRIDAD = 'caja_integridad'
    CATEGORIA_INVENTARIO_CONTEO = 'inventario_conteo'
    CATEGORIA_INVENTARIO_INTEGRIDAD = 'inventario_integridad'
    CATEGORIA_CHOICES = [
        (CATEGORIA_CAJA_CORTE, 'Corte de caja'),
        (CATEGORIA_CAJA_INTEGRIDAD, 'Integridad del libro de caja'),
        (CATEGORIA_INVENTARIO_CONTEO, 'Conteo físico'),
        (CATEGORIA_INVENTARIO_INTEGRIDAD, 'Integridad del libro de inventario'),
    ]
    CATEGORIAS_CAJA = (CATEGORIA_CAJA_CORTE, CATEGORIA_CAJA_INTEGRIDAD)
    CATEGORIAS_INVENTARIO = (CATEGORIA_INVENTARIO_CONTEO, CATEGORIA_INVENTARIO_INTEGRIDAD)

    ESTADO_ABIERTA = 'abierta'
    ESTADO_AJUSTADA = 'ajustada'
    ESTADO_JUSTIFICADA = 'justificada'
    ESTADO_CHOICES = [
        (ESTADO_ABIERTA, 'Abierta'),
        (ESTADO_AJUSTADA, 'Ajustada'),
        (ESTADO_JUSTIFICADA, 'Justificada'),
    ]

    ejecucion = models.ForeignKey(EjecucionAuditoria, on_delete=models.PROTECT, related_name='discrepancias')
    categoria = models.CharField(max_length=30, choices=CATEGORIA_CHOICES)
    # Texto legible del hallazgo para el reporte (ej. "Saldo del movimiento #12").
    descripcion = models.CharField(max_length=255, blank=True)
    corte = models.ForeignKey(
        CorteCaja, on_delete=models.PROTECT, null=True, blank=True, related_name='discrepancias',
    )
    detalle_conteo = models.ForeignKey(
        DetalleConteoFisico, on_delete=models.PROTECT, null=True, blank=True, related_name='discrepancias',
    )
    # Eslabón roto del libro de caja (referencia simple, como `referencia_id`).
    movimiento_caja_id = models.PositiveIntegerField(null=True, blank=True)
    sucursal = models.ForeignKey(
        Sucursal, on_delete=models.PROTECT, null=True, blank=True, related_name='discrepancias_auditoria',
    )
    tipo_item = models.CharField(max_length=20, choices=MovimientoInventario.TIPO_ITEM_CHOICES, blank=True)
    item_id = models.PositiveIntegerField(null=True, blank=True)
    valor_esperado = models.DecimalField(max_digits=12, decimal_places=2)
    valor_registrado = models.DecimalField(max_digits=12, decimal_places=2)
    # registrado − esperado: negativo es faltante, positivo es sobrante.
    diferencia = models.DecimalField(max_digits=12, decimal_places=2)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_ABIERTA)
    resuelta_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name='discrepancias_resueltas',
    )
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    comentario_resolucion = models.TextField(blank=True)
    # `MovimientoInventario` motivo `ajuste` generado al aprobar.
    movimiento_ajuste_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-ejecucion__fecha_inicio', 'id']
        indexes = [
            models.Index(fields=['estado', 'categoria']),
        ]

    def __str__(self):
        return f'Discrepancia #{self.pk} ({self.categoria}: {self.diferencia})'
