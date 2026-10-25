"""Ejecuta la conciliación de caja y/o la auditoría de inventario —
`022 · Auditoría automatizada`. Pensado para cron (ver `plan.md`):

    30 23 * * *  python manage.py ejecutar_auditorias --tipo caja
    45 23 * * 0  python manage.py ejecutar_auditorias --tipo inventario

Sin `--tipo` corre ambas. Termina con código de salida 1 si alguna falló,
para que cron lo registre.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.auditoria.models import EjecucionAuditoria
from apps.auditoria.services import ejecutar_auditoria


class Command(BaseCommand):
    help = 'Ejecuta las auditorías programadas (conciliación de caja y auditoría de inventario).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tipo', choices=[tipo for tipo, _ in EjecucionAuditoria.TIPO_CHOICES],
            help='Ejecuta solo una auditoría; sin este argumento se ejecutan ambas.',
        )

    def handle(self, *args, **options):
        tipos = [options['tipo']] if options['tipo'] else [tipo for tipo, _ in EjecucionAuditoria.TIPO_CHOICES]

        fallidas = []
        for tipo in tipos:
            ejecucion = ejecutar_auditoria(tipo, EjecucionAuditoria.ORIGEN_PROGRAMADA)
            if ejecucion.estado == EjecucionAuditoria.ESTADO_FALLIDA:
                fallidas.append(ejecucion)
                self.stderr.write(f'{ejecucion.get_tipo_display()}: falló — {ejecucion.mensaje_error}')
            else:
                self.stdout.write(
                    f'{ejecucion.get_tipo_display()}: {ejecucion.elementos_revisados} elemento(s) revisado(s), '
                    f'{ejecucion.discrepancias_encontradas} discrepancia(s).',
                )

        if fallidas:
            raise CommandError(f'{len(fallidas)} auditoría(s) fallaron.')
