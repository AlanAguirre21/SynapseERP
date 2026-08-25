from django.db import transaction
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import EsAdmin

from .models import MovimientoCaja
from .serializers import MovimientoCajaSerializer
from .services import SaldoInsuficienteError, calcular_saldo_actual, registrar_movimiento_caja


class MovimientoCajaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                             viewsets.GenericViewSet):
    """Historial de movimientos de caja — feature 013 · Caja. Sin
    `UpdateModelMixin` ni `DestroyModelMixin`: edición/eliminación no
    existen como rutas a nivel de framework, no solo bloqueadas por
    permisos (mismo criterio que `MovimientoInventarioViewSet`).

    Restringido a rol admin en su totalidad (lectura y escritura), a
    diferencia de Ventas/Compras/Producción/Inventario — así lo define
    `spec.md` de esta feature.
    """

    serializer_class = MovimientoCajaSerializer
    permission_classes = [EsAdmin]
    queryset = MovimientoCaja.objects.select_related('usuario').all()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        tipo_movimiento = params.get('tipo_movimiento')
        if tipo_movimiento:
            queryset = queryset.filter(tipo_movimiento=tipo_movimiento)

        motivo = params.get('motivo')
        if motivo:
            queryset = queryset.filter(motivo=motivo)

        fecha_desde = params.get('fecha_desde')
        if fecha_desde:
            queryset = queryset.filter(fecha__date__gte=fecha_desde)

        fecha_hasta = params.get('fecha_hasta')
        if fecha_hasta:
            queryset = queryset.filter(fecha__date__lte=fecha_hasta)

        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            movimiento = registrar_movimiento_caja(
                tipo_movimiento=serializer.validated_data['tipo_movimiento'],
                monto=serializer.validated_data['monto'],
                motivo=MovimientoCaja.MOTIVO_MANUAL,
                referencia_id=None,
                usuario=request.user,
                observacion=serializer.validated_data['observacion'],
            )
        except SaldoInsuficienteError as exc:
            raise ValidationError({'monto': [str(exc)]}) from exc

        # `serializer.instance` nunca se fija (no se llamó `serializer.save()`
        # — la creación real ocurre en `registrar_movimiento_caja()`), así que
        # los headers se construyen desde el serializer de respuesta, ya
        # ligado a la instancia real — no desde `serializer.data`, que caería
        # a `to_representation(validated_data)` (un dict sin `usuario`).
        respuesta = self.get_serializer(movimiento)
        headers = self.get_success_headers(respuesta.data)
        return Response(respuesta.data, status=201, headers=headers)

    @action(detail=False, methods=['get'])
    def saldo(self, request):
        campo_decimal = serializers.DecimalField(max_digits=12, decimal_places=2)
        return Response({'saldo_actual': campo_decimal.to_representation(calcular_saldo_actual())})
