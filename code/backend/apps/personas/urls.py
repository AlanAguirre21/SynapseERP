from rest_framework.routers import DefaultRouter

from .views import ClienteViewSet, EmpleadoViewSet, ProveedorViewSet

router = DefaultRouter()
router.register('clientes', ClienteViewSet, basename='cliente')
router.register('proveedores', ProveedorViewSet, basename='proveedor')
router.register('empleados', EmpleadoViewSet, basename='empleado')

urlpatterns = router.urls
