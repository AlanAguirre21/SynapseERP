from django.conf import settings
from django.db import models

from apps.catalogo.models import Categoria, Producto


class GeneracionPronostico(models.Model):
    """Una corrida de pronósticos para un horizonte — `023 · Analítica
    predictiva`. INSERT-only junto con sus `Pronostico`/`PuntoPronostico`:
    una generación nueva nunca reemplaza a las anteriores, para poder citar
    "el pronóstico generado el día X" (`024`) y medir la precisión real.
    """

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

    HORIZONTE_DIAS_7 = 'dias_7'
    HORIZONTE_SEMANAS_4 = 'semanas_4'
    HORIZONTE_MESES_3 = 'meses_3'
    HORIZONTE_PERSONALIZADO = 'personalizado'
    HORIZONTE_CHOICES = [
        (HORIZONTE_DIAS_7, 'Próximos 7 días'),
        (HORIZONTE_SEMANAS_4, 'Próximas 4 semanas'),
        (HORIZONTE_MESES_3, 'Próximos 3 meses'),
        (HORIZONTE_PERSONALIZADO, 'Rango personalizado'),
    ]
    HORIZONTES_ESTANDAR = (HORIZONTE_DIAS_7, HORIZONTE_SEMANAS_4, HORIZONTE_MESES_3)

    GRANULARIDAD_DIA = 'dia'
    GRANULARIDAD_SEMANA = 'semana'
    GRANULARIDAD_MES = 'mes'
    GRANULARIDAD_CHOICES = [
        (GRANULARIDAD_DIA, 'Diaria'),
        (GRANULARIDAD_SEMANA, 'Semanal'),
        (GRANULARIDAD_MES, 'Mensual'),
    ]

    origen = models.CharField(max_length=20, choices=ORIGEN_CHOICES)
    # Vacío cuando la inició el cron.
    iniciada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name='generaciones_pronostico',
    )
    fecha_inicio = models.DateTimeField(auto_now_add=True, db_index=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_EN_CURSO)
    horizonte = models.CharField(max_length=20, choices=HORIZONTE_CHOICES)
    granularidad = models.CharField(max_length=10, choices=GRANULARIDAD_CHOICES)
    # Primer y último periodo pronosticado (inicio de cada periodo).
    periodo_desde = models.DateField()
    periodo_hasta = models.DateField()
    # Historial completo usado (nulo si todavía no hay ventas).
    historial_desde = models.DateField(null=True, blank=True)
    historial_hasta = models.DateField(null=True, blank=True)
    mensaje_error = models.TextField(blank=True)

    class Meta:
        ordering = ['-fecha_inicio', '-id']

    def __str__(self):
        return f'Generación #{self.pk} ({self.horizonte}, {self.estado})'


class Pronostico(models.Model):
    """Una serie pronosticada: métrica × dimensión (producto o categoría,
    cuando aplica) dentro de una generación."""

    METRICA_MONTO_VENTAS = 'monto_ventas'
    METRICA_NUMERO_VENTAS = 'numero_ventas'
    METRICA_MONTO_CATEGORIA = 'monto_categoria'
    METRICA_UNIDADES_PRODUCTO = 'unidades_producto'
    METRICA_CLIENTES_NUEVOS = 'clientes_nuevos'
    METRICA_CLIENTES_ACTIVOS = 'clientes_activos'
    METRICA_BASE_CLIENTES = 'base_clientes'
    METRICA_CHOICES = [
        (METRICA_MONTO_VENTAS, 'Monto vendido'),
        (METRICA_NUMERO_VENTAS, 'Número de ventas'),
        (METRICA_MONTO_CATEGORIA, 'Monto vendido por categoría'),
        (METRICA_UNIDADES_PRODUCTO, 'Unidades por producto'),
        (METRICA_CLIENTES_NUEVOS, 'Clientes nuevos'),
        (METRICA_CLIENTES_ACTIVOS, 'Clientes activos'),
        (METRICA_BASE_CLIENTES, 'Base de clientes acumulada'),
    ]

    ESTADO_GENERADO = 'generado'
    ESTADO_HISTORIAL_INSUFICIENTE = 'historial_insuficiente'
    ESTADO_CHOICES = [
        (ESTADO_GENERADO, 'Generado'),
        (ESTADO_HISTORIAL_INSUFICIENTE, 'Historial insuficiente'),
    ]

    METODO_TENDENCIA = 'tendencia'
    METODO_TENDENCIA_ESTACIONAL = 'tendencia_estacional'
    METODO_CHOICES = [
        (METODO_TENDENCIA, 'Tendencia lineal'),
        (METODO_TENDENCIA_ESTACIONAL, 'Tendencia lineal × estacionalidad'),
    ]

    generacion = models.ForeignKey(GeneracionPronostico, on_delete=models.PROTECT, related_name='pronosticos')
    metrica = models.CharField(max_length=30, choices=METRICA_CHOICES)
    producto = models.ForeignKey(
        Producto, on_delete=models.PROTECT, null=True, blank=True, related_name='pronosticos',
    )
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, null=True, blank=True, related_name='pronosticos',
    )
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES)
    periodos_historial = models.PositiveIntegerField()
    periodos_minimos = models.PositiveIntegerField()
    metodo = models.CharField(max_length=30, choices=METODO_CHOICES, blank=True)
    # Error de validación (0.2500 = 25 %); nulo sin validación suficiente.
    wape = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    # Suma del horizonte (en `base_clientes`, el valor al final del horizonte).
    total_pronosticado = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    total_inferior = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    total_superior = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['metrica', 'generacion']),
        ]

    def __str__(self):
        return f'Pronóstico #{self.pk} ({self.metrica})'


class PuntoPronostico(models.Model):
    pronostico = models.ForeignKey(Pronostico, on_delete=models.PROTECT, related_name='puntos')
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    limite_inferior = models.DecimalField(max_digits=14, decimal_places=2)
    limite_superior = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['periodo_inicio']
        constraints = [
            models.UniqueConstraint(fields=['pronostico', 'periodo_inicio'], name='punto_pronostico_periodo_unico'),
            models.CheckConstraint(
                condition=models.Q(valor__gte=0, limite_inferior__gte=0), name='punto_pronostico_no_negativo',
            ),
        ]

    def __str__(self):
        return f'{self.periodo_inicio}: {self.valor}'
