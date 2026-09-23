from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Cliente, Proveedor
from .serializers import ClienteSerializer, ProveedorSerializer


class ClienteViewSet(viewsets.ModelViewSet):
    """CRUD de clientes. Cualquier usuario autenticado puede crear, editar
    y desactivar — a diferencia de Empleados/Usuarios, refleja la operación
    diaria real (registrar un cliente nuevo al momento de una venta).
    """

    queryset = Cliente.objects.select_related('datos_fiscales').all().order_by('nombre_cliente')
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        cliente = self.get_object()

        if cliente.activo:
            return Response({'detail': 'El cliente ya está activo.'}, status=400)

        cliente.activo = True
        cliente.save(update_fields=['activo'])

        return Response(self.get_serializer(cliente).data)


class ProveedorViewSet(viewsets.ModelViewSet):
    """CRUD de proveedores. Mismo nivel de permiso abierto que Clientes."""

    queryset = Proveedor.objects.all().order_by('nombre_proveedor')
    serializer_class = ProveedorSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        proveedor = self.get_object()

        if proveedor.activo:
            return Response({'detail': 'El proveedor ya está activo.'}, status=400)

        proveedor.activo = True
        proveedor.save(update_fields=['activo'])

        return Response(self.get_serializer(proveedor).data)
