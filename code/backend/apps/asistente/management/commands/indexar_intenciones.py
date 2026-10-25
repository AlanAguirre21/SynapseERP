"""Calcula los vectores de las frases de ejemplo del catálogo y reemplaza el
índice (`EjemploIndexado`) — `024`. Corre en cada despliegue, después de
`migrate`; la primera vez descarga el modelo a `ASISTENTE_CACHE_MODELOS`.

    python manage.py indexar_intenciones
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.asistente import clasificador, periodos
from apps.asistente.catalogo import VERSION_CATALOGO, ejemplos
from apps.asistente.models import EjemploIndexado


class Command(BaseCommand):
    help = 'Indexa las frases de ejemplo del asistente con el modelo de embeddings local.'

    def handle(self, *args, **options):
        try:
            pares = ejemplos()
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        # Mismo preprocesamiento que las preguntas: normalizado y sin periodo.
        textos = [periodos.detectar_periodo(texto)[1] or periodos.normalizar(texto) for _, texto in pares]
        try:
            vectores = clasificador.vectorizar(textos)
        except clasificador.ClasificadorNoDisponible as exc:
            raise CommandError(str(exc)) from exc

        modelo = clasificador.nombre_modelo()
        with transaction.atomic():
            EjemploIndexado.objects.all().delete()
            EjemploIndexado.objects.bulk_create([
                EjemploIndexado(
                    intencion=intencion, texto=texto, vector=vector.tobytes(), modelo=modelo,
                    version_catalogo=VERSION_CATALOGO,
                )
                for (intencion, texto), vector in zip(pares, vectores, strict=True)
            ])
        clasificador.reiniciar()
        self.stdout.write(self.style.SUCCESS(
            f'{len(pares)} frases indexadas ({modelo}, catálogo {VERSION_CATALOGO}).',
        ))
