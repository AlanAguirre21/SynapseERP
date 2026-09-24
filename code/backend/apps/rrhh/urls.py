from rest_framework.routers import DefaultRouter

from .views import (
    ContactoEmergenciaViewSet,
    DepartamentoViewSet,
    DependienteViewSet,
    EmpleadoPosicionViewSet,
    EmpleadoViewSet,
    PosicionViewSet,
    SolicitudNominaViewSet,
)

router = DefaultRouter()
router.register('departamentos', DepartamentoViewSet, basename='departamento')
router.register('posiciones', PosicionViewSet, basename='posicion')
router.register('empleados', EmpleadoViewSet, basename='empleado')
router.register('empleado-posiciones', EmpleadoPosicionViewSet, basename='empleado-posicion')
router.register('contactos-emergencia', ContactoEmergenciaViewSet, basename='contacto-emergencia')
router.register('dependientes', DependienteViewSet, basename='dependiente')
router.register('solicitudes-nomina', SolicitudNominaViewSet, basename='solicitud-nomina')

urlpatterns = router.urls
