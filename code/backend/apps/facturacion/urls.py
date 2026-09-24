from rest_framework.routers import DefaultRouter

from .views import ComplementoPagoViewSet, FacturaViewSet

router = DefaultRouter()
router.register('complementos-pago', ComplementoPagoViewSet, basename='complemento-pago')
router.register('', FacturaViewSet, basename='factura')

urlpatterns = router.urls
