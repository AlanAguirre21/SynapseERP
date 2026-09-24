from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.inventario.models import MovimientoInventario
from apps.inventario.services import (
    bloquear_inventario_materia_prima,
    bloquear_inventario_producto,
    registrar_movimiento_inventario,
)
from core.permissions import LecturaParaTodosEscrituraSoloAdmin

from .models import DetalleProduccion, Produccion, Receta
from .serializers import ProduccionSerializer, RecetaSerializer


def _calcular_subtotal(cantidad, costo_unitario):
    return (cantidad * costo_unitario).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class RecetaViewSet(viewsets.ModelViewSet):
    """CRUD de líneas de receta. Lectura para cualquier usuario
    autenticado, escritura (crear/editar/desactivar/reactivar) solo para
    rol admin — mismo criterio que Catálogo.
    """

    queryset = (
        Receta.objects.select_related('producto', 'materia_prima')
        .all()
        .order_by('producto__nombre_producto', 'materia_prima__nombre_item')
    )
    serializer_class = RecetaSerializer
    permission_classes = [LecturaParaTodosEscrituraSoloAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        producto_id = self.request.query_params.get('producto')
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)
        return queryset

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        receta = self.get_object()

        if receta.activo:
            return Response({'detail': 'Esta línea de receta ya está activa.'}, status=400)

        receta.activo = True
        receta.save(update_fields=['activo'])

        return Response(self.get_serializer(receta).data)


class ProduccionViewSet(viewsets.ModelViewSet):
    """Registro de lotes de producción — feature 012 · Producción.
    Cualquier usuario autenticado puede registrar y consultar. Solo
    lectura y creación (sin `PUT`/`PATCH`/`DELETE`): una producción
    confirmada no se edita, cancela ni revierte (fuera de alcance
    explícito de `spec.md`).
    """

    http_method_names = ['get', 'post', 'head', 'options']
    serializer_class = ProduccionSerializer
    permission_classes = [IsAuthenticated]
    queryset = (
        Produccion.objects.select_related('producto', 'sucursal', 'usuario')
        .prefetch_related('detalles__materia_prima')
        .all()
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        sucursal_id = params.get('sucursal')
        if sucursal_id:
            queryset = queryset.filter(sucursal_id=sucursal_id)

        producto_id = params.get('producto')
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)

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

        producto = serializer.validated_data['producto']
        sucursal = serializer.validated_data['sucursal']
        cantidad_producida = serializer.validated_data['cantidad_producida']

        recetas = list(
            Receta.objects.filter(producto=producto, activo=True)
            .select_related('materia_prima')
            .order_by('materia_prima_id'),
        )
        if not recetas:
            raise ValidationError({
                'producto': [
                    f'"{producto.nombre_producto}" no tiene una receta activa configurada — no se puede producir.',
                ],
            })

        # Todo-o-nada: se bloquean y validan TODAS las materias primas
        # requeridas antes de modificar cualquiera. El orden ascendente por
        # `materia_prima_id` es deliberado — evita deadlocks cuando dos
        # producciones concurrentes comparten ingredientes y bloquearían
        # filas en orden distinto.
        requerimientos = []
        faltantes = []
        for receta in recetas:
            requerido = receta.cantidad_requerida * cantidad_producida
            inventario = bloquear_inventario_materia_prima(sucursal, receta.materia_prima)
            requerimientos.append((receta, inventario, requerido))
            if inventario.stock_actual < requerido:
                faltantes.append(
                    f'{receta.materia_prima.nombre_item} (disponible: {inventario.stock_actual}, '
                    f'requerido: {requerido})',
                )

        if faltantes:
            raise ValidationError({'detail': f'Stock insuficiente de: {"; ".join(faltantes)}.'})

        # `serializer.save()` (no una creación manual del modelo) para que
        # `serializer.instance` quede fijado — de lo contrario `serializer.data`
        # más abajo caería a `to_representation(validated_data)`, un dict sin
        # `usuario` ni relaciones reales, y `get_usuario_nombre()` fallaría.
        produccion = serializer.save(usuario=request.user)
        costo_total = Decimal(0)

        for receta, inventario, requerido in requerimientos:
            inventario.stock_actual -= requerido
            inventario.save(update_fields=['stock_actual'])

            costo_unitario_momento = receta.materia_prima.costo_promedio
            subtotal = _calcular_subtotal(requerido, costo_unitario_momento)
            DetalleProduccion.objects.create(
                produccion=produccion, materia_prima=receta.materia_prima, cantidad_consumida=requerido,
                costo_unitario_momento=costo_unitario_momento, subtotal=subtotal,
            )
            costo_total += subtotal

            registrar_movimiento_inventario(
                sucursal=sucursal, tipo_item=MovimientoInventario.TIPO_MATERIA_PRIMA,
                item_id=receta.materia_prima_id, tipo_movimiento=MovimientoInventario.SALIDA,
                cantidad=requerido, motivo=MovimientoInventario.MOTIVO_PRODUCCION_CONSUMO,
                referencia_id=produccion.id, stock_resultante=inventario.stock_actual, usuario=request.user,
            )

        inventario_producto = bloquear_inventario_producto(sucursal, producto)
        inventario_producto.stock_actual += cantidad_producida
        inventario_producto.save(update_fields=['stock_actual'])

        registrar_movimiento_inventario(
            sucursal=sucursal, tipo_item=MovimientoInventario.TIPO_PRODUCTO, item_id=producto.id,
            tipo_movimiento=MovimientoInventario.ENTRADA, cantidad=cantidad_producida,
            motivo=MovimientoInventario.MOTIVO_PRODUCCION_ENTRADA, referencia_id=produccion.id,
            stock_resultante=inventario_producto.stock_actual, usuario=request.user,
        )

        produccion.costo_total = costo_total
        produccion.save(update_fields=['costo_total'])

        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(produccion).data, status=201, headers=headers)
