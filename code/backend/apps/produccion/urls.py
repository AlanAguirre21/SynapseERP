from rest_framework.routers import DefaultRouter

from .views import ProduccionViewSet, RecetaViewSet

router = DefaultRouter()
# 'recetas' debe registrarse antes que '' (Produccion): el patrón de
# detalle de Produccion (`<pk>/`) acepta cualquier valor no numérico, y
# Django resuelve URLs en orden de registro — esto asegura que
# /api/produccion/recetas/ nunca se interprete como Produccion pk="recetas".
router.register('recetas', RecetaViewSet, basename='receta')
router.register('', ProduccionViewSet, basename='produccion')

urlpatterns = router.urls
