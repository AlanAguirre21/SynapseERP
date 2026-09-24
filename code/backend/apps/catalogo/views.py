from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import LecturaParaTodosEscrituraSoloAdmin

from .models import Categoria, MateriaPrima, Producto
from .serializers import CategoriaSerializer, MateriaPrimaSerializer, ProductoSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    """CRUD de categorías. Lectura para cualquier usuario autenticado,
    escritura (crear/editar/desactivar/reactivar) solo para rol admin.
    """

    queryset = Categoria.objects.all().order_by('nombre_categoria')
    serializer_class = CategoriaSerializer
    permission_classes = [LecturaParaTodosEscrituraSoloAdmin]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        categoria = self.get_object()

        if categoria.activo:
            return Response({'detail': 'La categoría ya está activa.'}, status=400)

        categoria.activo = True
        categoria.save(update_fields=['activo'])

        return Response(self.get_serializer(categoria).data)


class ProductoViewSet(viewsets.ModelViewSet):
    """CRUD de productos. Lectura para cualquier usuario autenticado,
    escritura (crear/editar/desactivar/reactivar) solo para rol admin.
    """

    queryset = Producto.objects.select_related('categoria').all().order_by('nombre_producto')
    serializer_class = ProductoSerializer
    permission_classes = [LecturaParaTodosEscrituraSoloAdmin]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        producto = self.get_object()

        if producto.activo:
            return Response({'detail': 'El producto ya está activo.'}, status=400)

        producto.activo = True
        producto.save(update_fields=['activo'])

        return Response(self.get_serializer(producto).data)


class MateriaPrimaViewSet(viewsets.ModelViewSet):
    """CRUD de materia prima. Lectura para cualquier usuario autenticado,
    escritura (crear/editar/desactivar/reactivar) solo para rol admin.
    """

    queryset = MateriaPrima.objects.select_related('categoria').all().order_by('nombre_item')
    serializer_class = MateriaPrimaSerializer
    permission_classes = [LecturaParaTodosEscrituraSoloAdmin]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        materia_prima = self.get_object()

        if materia_prima.activo:
            return Response({'detail': 'La materia prima ya está activa.'}, status=400)

        materia_prima.activo = True
        materia_prima.save(update_fields=['activo'])

        return Response(self.get_serializer(materia_prima).data)
