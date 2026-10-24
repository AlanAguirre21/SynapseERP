from django.urls import path

from .views import (
    ClientesTopView,
    MovimientosCajaReporteView,
    ProductosTopView,
    ResumenComprasView,
    ResumenDashboardView,
<<<<<<< HEAD
=======
    ResumenFacturacionView,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    ResumenVentasView,
)

urlpatterns = [
    path('resumen/', ResumenDashboardView.as_view(), name='reportes-resumen'),
    path('ventas/', ResumenVentasView.as_view(), name='reportes-ventas'),
    path('compras/', ResumenComprasView.as_view(), name='reportes-compras'),
    path('productos-top/', ProductosTopView.as_view(), name='reportes-productos-top'),
    path('clientes-top/', ClientesTopView.as_view(), name='reportes-clientes-top'),
    path('movimientos-caja/', MovimientosCajaReporteView.as_view(), name='reportes-movimientos-caja'),
<<<<<<< HEAD
=======
    path('facturacion/', ResumenFacturacionView.as_view(), name='reportes-facturacion'),
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
]
