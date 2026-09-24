from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AlertasStockView, MovimientoInventarioViewSet, StockView

router = DefaultRouter()
router.register('movimientos', MovimientoInventarioViewSet, basename='movimiento-inventario')

urlpatterns = [
    path('alertas/', AlertasStockView.as_view(), name='inventario-alertas'),
    path('stock/', StockView.as_view(), name='inventario-stock'),
    *router.urls,
]
