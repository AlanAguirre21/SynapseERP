from rest_framework.routers import DefaultRouter

from .views import CategoriaViewSet, MateriaPrimaViewSet, ProductoViewSet

router = DefaultRouter()
router.register('categorias', CategoriaViewSet, basename='categoria')
router.register('productos', ProductoViewSet, basename='producto')
router.register('materia-prima', MateriaPrimaViewSet, basename='materiaprima')

urlpatterns = router.urls
