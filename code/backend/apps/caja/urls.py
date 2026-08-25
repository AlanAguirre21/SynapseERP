from rest_framework.routers import DefaultRouter

from .views import MovimientoCajaViewSet

router = DefaultRouter()
router.register('', MovimientoCajaViewSet, basename='movimiento-caja')

urlpatterns = router.urls
