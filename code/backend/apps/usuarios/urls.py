from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MeView, UsuarioViewSet

router = DefaultRouter()
router.register('', UsuarioViewSet, basename='usuario')

urlpatterns = [
    # 'me/' debe listarse antes que las rutas del router: aunque el patrón
    # de detalle del router (`<pk>/`) acepta cualquier valor no numérico,
    # Django resuelve URLs en orden y esta coincide primero.
    path('me/', MeView.as_view(), name='usuario-actual'),
    *router.urls,
]
