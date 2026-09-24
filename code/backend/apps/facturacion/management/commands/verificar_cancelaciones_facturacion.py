"""Vence automáticamente las facturas en `pendiente_cancelacion` que ya
superaron la ventana de 72 horas exigida por el SAT para que el receptor
acepte o rechace la cancelación (`spec.md`, criterio de aceptación) —
pensado para ejecutarse periódicamente vía cron (ver Riesgos de
`plan.md`). La misma regla también corre de forma perezosa en cada
`GET` de `FacturaViewSet`, así que este comando es un respaldo para
facturas que nadie vuelve a consultar.

Ejecutar con: python manage.py verificar_cancelaciones_facturacion
"""

from django.core.management.base import BaseCommand

from apps.facturacion.services import expirar_cancelaciones_pendientes


class Command(BaseCommand):
    help = 'Marca como canceladas las facturas en pendiente_cancelacion que superaron las 72 horas del SAT.'

    def handle(self, *args, **options):
        actualizadas = expirar_cancelaciones_pendientes()
        self.stdout.write(f'{actualizadas} factura(s) marcada(s) como cancelada(s) tras vencer el plazo de 72 horas.')
