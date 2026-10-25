from django.conf import settings
from django.db import models


class ConversacionAsistente(models.Model):
    """Una conversación del panel del asistente — `024 · Asistente
    conversacional`. Pertenece a un solo usuario; recargar la página abre
    una nueva."""

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='conversaciones_asistente',
    )
    fecha_inicio = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-fecha_inicio', '-id']

    def __str__(self):
        return f'Conversación #{self.pk} de {self.usuario}'


class MensajeAsistente(models.Model):
    """Un intercambio pregunta → respuesta. INSERT-only: es el registro de
    auditoría del asistente (qué preguntó quién, qué entendió y qué cifras
    se le dieron)."""

    ENTRADA_TEXTO = 'texto'
    ENTRADA_BOTON = 'boton'
    ENTRADA_CHOICES = [
        (ENTRADA_TEXTO, 'Texto escrito'),
        (ENTRADA_BOTON, 'Botón'),
    ]

    CONFIANZA_ALTA = 'alta'
    CONFIANZA_MEDIA = 'media'
    CONFIANZA_BAJA = 'baja'
    CONFIANZA_BOTON = 'boton'
    CONFIANZA_CHOICES = [
        (CONFIANZA_ALTA, 'Alta'),
        (CONFIANZA_MEDIA, 'Media'),
        (CONFIANZA_BAJA, 'Baja'),
        (CONFIANZA_BOTON, 'Botón (sin clasificador)'),
    ]

    MODO_SEMANTICO = 'semantico'
    MODO_SOLO_ARBOL = 'solo_arbol'
    MODO_CHOICES = [
        (MODO_SEMANTICO, 'Clasificador semántico'),
        (MODO_SOLO_ARBOL, 'Solo árbol de botones'),
    ]

    conversacion = models.ForeignKey(ConversacionAsistente, on_delete=models.PROTECT, related_name='mensajes')
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)
    entrada_tipo = models.CharField(max_length=10, choices=ENTRADA_CHOICES)
    entrada_texto = models.TextField(blank=True)
    nodo_solicitado = models.CharField(max_length=100, blank=True)
    intencion = models.CharField(max_length=50, blank=True, db_index=True)
    confianza = models.CharField(max_length=10, choices=CONFIANZA_CHOICES)
    # Similitud coseno del ejemplo más cercano (solo auditoría, no dinero).
    puntuacion = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    alternativas = models.JSONField(default=list, blank=True)
    periodo = models.CharField(max_length=20, blank=True)
    periodo_desde = models.DateTimeField(null=True, blank=True)
    periodo_hasta = models.DateTimeField(null=True, blank=True)
    nodo_respuesta = models.CharField(max_length=100, blank=True)
    version_catalogo = models.CharField(max_length=20)
    respuesta_texto = models.TextField()
    # Cifras usadas, serializadas como texto decimal (nunca float).
    respuesta_datos = models.JSONField(default=dict, blank=True)
    modo = models.CharField(max_length=20, choices=MODO_CHOICES)

    class Meta:
        ordering = ['fecha', 'id']
        indexes = [models.Index(fields=['confianza', 'fecha'])]

    def __str__(self):
        return f'Mensaje #{self.pk} ({self.intencion or self.nodo_solicitado})'


class EjemploIndexado(models.Model):
    """Caché derivada del catálogo de intenciones en código: el vector de cada
    frase de ejemplo. Se reconstruye completa con `indexar_intenciones`; no
    es un libro, así que reemplazarla es válido."""

    intencion = models.CharField(max_length=50, db_index=True)
    texto = models.CharField(max_length=255)
    # float32 empaquetado (`numpy.ndarray.tobytes()`).
    vector = models.BinaryField()
    modelo = models.CharField(max_length=150)
    version_catalogo = models.CharField(max_length=20)

    class Meta:
        ordering = ['intencion', 'id']

    def __str__(self):
        return f'{self.intencion}: {self.texto}'
