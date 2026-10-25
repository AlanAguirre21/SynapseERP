"""Genera los pronósticos estándar (7 días, 4 semanas, 3 meses) —
`023 · Analítica predictiva`. Pensado para cron, los lunes después de las
auditorías de `022` (ver `plan.md`):

    30 0 * * 1  python manage.py generar_pronosticos

Termina con código de salida 1 si alguna generación falló.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.analitica.models import GeneracionPronostico, Pronostico
from apps.analitica.services import generar_estandar


class Command(BaseCommand):
    help = 'Genera los pronósticos de ventas y clientes para los horizontes estándar.'

    def handle(self, *args, **options):
        generaciones = generar_estandar(GeneracionPronostico.ORIGEN_PROGRAMADA)

        fallidas = 0
        for generacion in generaciones:
            if generacion.estado == GeneracionPronostico.ESTADO_FALLIDA:
                fallidas += 1
                self.stderr.write(f'{generacion.get_horizonte_display()}: falló — {generacion.mensaje_error}')
                continue
            generados = generacion.pronosticos.filter(estado=Pronostico.ESTADO_GENERADO).count()
            insuficientes = generacion.pronosticos.filter(estado=Pronostico.ESTADO_HISTORIAL_INSUFICIENTE).count()
            self.stdout.write(
                f'{generacion.get_horizonte_display()}: {generados} serie(s) pronosticada(s), '
                f'{insuficientes} con historial insuficiente.',
            )

        if fallidas:
            raise CommandError(f'{fallidas} generación(es) fallaron.')
