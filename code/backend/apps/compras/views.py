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

from .models import Compra
from .serializers import CompraSerializer


def _recibir_linea_producto(compra, detalle, usuario):
    inventario = bloquear_inventario_producto(compra.sucursal, detalle.producto)
    inventario.stock_actual += detalle.cantidad
    inventario.save(update_fields=['stock_actual'])

    registrar_movimiento_inventario(
        sucursal=compra.sucursal, tipo_item=MovimientoInventario.TIPO_PRODUCTO, item_id=detalle.producto_id,
        tipo_movimiento=MovimientoInventario.ENTRADA, cantidad=detalle.cantidad,
        motivo=MovimientoInventario.MOTIVO_COMPRA, referencia_id=compra.id,
        stock_resultante=inventario.stock_actual, usuario=usuario,
    )


def _recibir_linea_materia_prima(compra, detalle, usuario):
    inventario = bloquear_inventario_materia_prima(compra.sucursal, detalle.materia_prima)
    inventario.stock_actual += detalle.cantidad
    inventario.save(update_fields=['stock_actual'])

    registrar_movimiento_inventario(
        sucursal=compra.sucursal, tipo_item=MovimientoInventario.TIPO_MATERIA_PRIMA, item_id=detalle.materia_prima_id,
        tipo_movimiento=MovimientoInventario.ENTRADA, cantidad=detalle.cantidad,
        motivo=MovimientoInventario.MOTIVO_COMPRA, referencia_id=compra.id,
        stock_resultante=inventario.stock_actual, usuario=usuario,
    )


def _revertir_linea_producto(compra, detalle, usuario):
    inventario = bloquear_inventario_producto(compra.sucursal, detalle.producto)
    if inventario.stock_actual < detalle.cantidad:
        raise ValidationError({
            'detail': (
                f'No se puede cancelar: no hay stock suficiente de "{detalle.producto.nombre_producto}" '
                f'en {compra.sucursal.nombre_sucursal} para revertir la entrada '
                f'(disponible: {inventario.stock_actual}, a revertir: {detalle.cantidad}).'
            ),
        })

    inventario.stock_actual -= detalle.cantidad
    inventario.save(update_fields=['stock_actual'])

    registrar_movimiento_inventario(
        sucursal=compra.sucursal, tipo_item=MovimientoInventario.TIPO_PRODUCTO, item_id=detalle.producto_id,
        tipo_movimiento=MovimientoInventario.SALIDA, cantidad=detalle.cantidad,
        motivo=MovimientoInventario.MOTIVO_AJUSTE, referencia_id=compra.id,
        stock_resultante=inventario.stock_actual, usuario=usuario,
    )


def _revertir_linea_materia_prima(compra, detalle, usuario):
    inventario = bloquear_inventario_materia_prima(compra.sucursal, detalle.materia_prima)
    if inventario.stock_actual < detalle.cantidad:
        raise ValidationError({
            'detail': (
                f'No se puede cancelar: no hay stock suficiente de "{detalle.materia_prima.nombre_item}" '
                f'en {compra.sucursal.nombre_sucursal} para revertir la entrada '
                f'(disponible: {inventario.stock_actual}, a revertir: {detalle.cantidad}).'
            ),
        })

    inventario.stock_actual -= detalle.cantidad
    inventario.save(update_fields=['stock_actual'])

    registrar_movimiento_inventario(
        sucursal=compra.sucursal, tipo_item=MovimientoInventario.TIPO_MATERIA_PRIMA, item_id=detalle.materia_prima_id,
        tipo_movimiento=MovimientoInventario.SALIDA, cantidad=detalle.cantidad,
        motivo=MovimientoInventario.MOTIVO_AJUSTE, referencia_id=compra.id,
        stock_resultante=inventario.stock_actual, usuario=usuario,
    )


class CompraViewSet(viewsets.ModelViewSet):
    """CRUD de compras — feature 010 · Compras. Cualquier usuario
    autenticado puede registrar y consultar (mismo criterio que
    Clientes/Proveedores). Solo admite lectura y creación como métodos
    genéricos: una vez creada, una compra solo cambia de estado a través
    de las acciones dedicadas `recibir()`/`cancelar()`, nunca por
    `PUT`/`PATCH`/`DELETE` — de ahí que esos verbos no estén habilitados.
    """

    http_method_names = ['get', 'post', 'head', 'options']
    serializer_class = CompraSerializer
    permission_classes = [IsAuthenticated]
    queryset = (
        Compra.objects.select_related('proveedor', 'sucursal', 'usuario')
        .prefetch_related('detalles_producto__producto', 'detalles_materia_prima__materia_prima')
        .all()
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        proveedor_id = params.get('proveedor')
        if proveedor_id:
            queryset = queryset.filter(proveedor_id=proveedor_id)

        estado = params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        fecha_desde = params.get('fecha_desde')
        if fecha_desde:
            queryset = queryset.filter(fecha__date__gte=fecha_desde)

        fecha_hasta = params.get('fecha_hasta')
        if fecha_hasta:
            queryset = queryset.filter(fecha__date__lte=fecha_hasta)

        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def recibir(self, request, pk=None):
        compra = self.get_object()

        if compra.estado != Compra.ESTADO_PENDIENTE:
            return Response({'detail': 'Solo se puede recibir una compra pendiente.'}, status=400)

        for detalle in compra.detalles_producto.select_related('producto').all():
            _recibir_linea_producto(compra, detalle, request.user)
        for detalle in compra.detalles_materia_prima.select_related('materia_prima').all():
            _recibir_linea_materia_prima(compra, detalle, request.user)

        compra.estado = Compra.ESTADO_RECIBIDA
        compra.save(update_fields=['estado'])

        return Response(self.get_serializer(compra).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancelar(self, request, pk=None):
        compra = self.get_object()

        if compra.estado == Compra.ESTADO_CANCELADA:
            return Response({'detail': 'La compra ya está cancelada.'}, status=400)

        if compra.estado == Compra.ESTADO_RECIBIDA:
            # Genera movimientos de salida inversos por cada línea — nunca
            # se edita ni se borra el movimiento de entrada original
            # (trazabilidad total). Si no hay stock suficiente para
            # revertir, se aborta sin dejar cambios parciales.
            for detalle in compra.detalles_producto.select_related('producto').all():
                _revertir_linea_producto(compra, detalle, request.user)
            for detalle in compra.detalles_materia_prima.select_related('materia_prima').all():
                _revertir_linea_materia_prima(compra, detalle, request.user)

        compra.estado = Compra.ESTADO_CANCELADA
        compra.save(update_fields=['estado'])

        return Response(self.get_serializer(compra).data)
