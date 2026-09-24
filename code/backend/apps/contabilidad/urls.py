from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AsientoContableViewSet,
    BalanceComprobacionView,
    CuentaContableViewSet,
    ExportarContabilidadView,
)

router = DefaultRouter()
router.register('cuentas', CuentaContableViewSet, basename='cuenta-contable')
router.register('asientos', AsientoContableViewSet, basename='asiento-contable')

urlpatterns = [
    path('balance/', BalanceComprobacionView.as_view(), name='contabilidad-balance'),
    path('exportar/', ExportarContabilidadView.as_view(), name='contabilidad-exportar'),
    *router.urls,
]
