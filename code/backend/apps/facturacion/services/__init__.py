"""Vencimiento del plazo de 72 horas para cancelaciones pendientes ante el
SAT — feature `017 · Facturación`. Se invoca desde dos puntos (ver
`plan.md`, tarea 7): perezosamente en `FacturaViewSet.get_queryset()`
(para que la lista se refleje sin depender de un cron), y desde el
management command `verificar_cancelaciones_facturacion` (para las
facturas que nadie vuelve a consultar). Una sola función compartida evita
duplicar la regla en dos lugares.
"""

from datetime import timedelta

from django.utils import timezone

from apps.facturacion.models import Factura

VENTANA_CANCELACION = timedelta(hours=72)


def expirar_cancelaciones_pendientes():
    limite = timezone.now() - VENTANA_CANCELACION
    return Factura.objects.filter(
        estado=Factura.ESTADO_PENDIENTE_CANCELACION,
        fecha_solicitud_cancelacion__lte=limite,
    ).update(estado=Factura.ESTADO_CANCELADA)
