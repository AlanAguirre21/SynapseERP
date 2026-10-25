from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ConteoFisicoViewSet,
    CorteCajaViewSet,
    DiscrepanciaAuditoriaViewSet,
    EjecucionAuditoriaViewSet,
    ResumenAuditoriaView,
)

router = DefaultRouter()
router.register('cortes-caja', CorteCajaViewSet, basename='corte-caja')
router.register('conteos', ConteoFisicoViewSet, basename='conteo-fisico')
router.register('ejecuciones', EjecucionAuditoriaViewSet, basename='ejecucion-auditoria')
router.register('discrepancias', DiscrepanciaAuditoriaViewSet, basename='discrepancia-auditoria')

urlpatterns = [
    path('resumen/', ResumenAuditoriaView.as_view(), name='auditoria-resumen'),
    *router.urls,
]
