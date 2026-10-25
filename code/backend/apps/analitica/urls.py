from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DemandaView,
    GeneracionPronosticoViewSet,
    PronosticoViewSet,
    ProyeccionDashboardView,
    VistaPronosticoView,
)

router = DefaultRouter()
router.register('generaciones', GeneracionPronosticoViewSet, basename='generacion-pronostico')
router.register('pronosticos', PronosticoViewSet, basename='pronostico')

urlpatterns = [
    path('vista/', VistaPronosticoView.as_view(), name='analitica-vista'),
    path('proyeccion-dashboard/', ProyeccionDashboardView.as_view(), name='analitica-proyeccion-dashboard'),
    path('demanda/', DemandaView.as_view(), name='analitica-demanda'),
    *router.urls,
]
