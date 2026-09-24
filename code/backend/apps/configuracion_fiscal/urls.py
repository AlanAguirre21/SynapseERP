from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ConfiguracionPACView, DatosFiscalesEmpresaView, SerieFolioViewSet

router = DefaultRouter()
router.register('series', SerieFolioViewSet, basename='serie-folio')

urlpatterns = [
    path('datos-empresa/', DatosFiscalesEmpresaView.as_view(), name='configuracion-fiscal-datos-empresa'),
    path('pac/', ConfiguracionPACView.as_view(), name='configuracion-fiscal-pac'),
    *router.urls,
]
