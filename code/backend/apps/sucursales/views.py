from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import LecturaParaTodosEscrituraSoloAdmin

from .models import HistorialEstadoSucursal, Sucursal
from .serializers import SucursalSerializer
from .validators import validar_nombre_disponible


class SucursalViewSet(viewsets.ModelViewSet):
    """CRUD de sucursales. Lectura para cualquier usuario autenticado,
    escritura (crear/editar/desactivar/reactivar) solo para rol admin — ver
    `core.permissions.LecturaParaTodosEscrituraSoloAdmin`.
    """

    queryset = Sucursal.objects.all().order_by('nombre_sucursal')
    serializer_class = SucursalSerializer
    permission_classes = [LecturaParaTodosEscrituraSoloAdmin]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # Envuelto en una transacción explícita: `validar_nombre_disponible()`
        # usa `select_for_update()` durante `serializer.is_valid()`, y eso
        # requiere estar dentro de un bloque atómico activo.
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # Cubre tanto PUT como PATCH (`partial_update` delega en `update`).
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def perform_destroy(self, instance):
        # Idempotente: desactivar una sucursal ya inactiva no genera un
        # historial falso de "cambio" que en realidad nunca ocurrió.
        if not instance.activo:
            return

        HistorialEstadoSucursal.objects.create(
            sucursal=instance,
            estado_anterior=True,
            estado_nuevo=False,
            usuario=self.request.user,
        )
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reactivar(self, request, pk=None):
        sucursal = self.get_object()

        if sucursal.activo:
            return Response({'detail': 'La sucursal ya está activa.'}, status=400)

        validar_nombre_disponible(
            sucursal.nombre_sucursal, sucursal.ubicacion_sucursal, excluir_pk=sucursal.pk,
        )

        HistorialEstadoSucursal.objects.create(
            sucursal=sucursal,
            estado_anterior=False,
            estado_nuevo=True,
            usuario=request.user,
        )
        sucursal.activo = True
        sucursal.save(update_fields=['activo'])

        return Response(self.get_serializer(sucursal).data)
