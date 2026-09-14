from django.urls import path

from .views import (
    ClientesTopView,
    MovimientosCajaReporteView,
    ProductosTopView,
    ResumenComprasView,
    ResumenDashboardView,
    ResumenVentasView,
)

urlpatterns = [
    path('resumen/', ResumenDashboardView.as_view(), name='reportes-resumen'),
    path('ventas/', ResumenVentasView.as_view(), name='reportes-ventas'),
    path('compras/', ResumenComprasView.as_view(), name='reportes-compras'),
    path('productos-top/', ProductosTopView.as_view(), name='reportes-productos-top'),
    path('clientes-top/', ClientesTopView.as_view(), name='reportes-clientes-top'),
    path('movimientos-caja/', MovimientosCajaReporteView.as_view(), name='reportes-movimientos-caja'),
]
