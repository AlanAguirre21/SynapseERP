from rest_framework.routers import DefaultRouter

from .views import SucursalViewSet

router = DefaultRouter()
router.register('', SucursalViewSet, basename='sucursal')

urlpatterns = router.urls
