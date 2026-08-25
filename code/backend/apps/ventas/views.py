import io

from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from xhtml2pdf import pisa

from apps.caja.models import MovimientoCaja
from apps.caja.services import registrar_movimiento_caja
from apps.inventario.models import MovimientoInventario
from apps.inventario.services import (
    bloquear_inventario_producto,
    registrar_movimiento_inventario,
)

from .models import Venta
from .serializers import VentaSerializer


def _confirmar_linea_venta(venta, detalle, usuario):
    """Valida stock suficiente y lo descuenta. Si falla, la excepción se
    propaga fuera de la `transaction.atomic()` de `VentaViewSet.create()`
    y revierte también la cabecera/líneas ya insertadas por el serializer
    — nada queda guardado a medias.
    """

    inventario = bloquear_inventario_producto(venta.sucursal, detalle.producto)
    if inventario.stock_actual < detalle.cantidad:
        mensaje = (
            f'Stock insuficiente de "{detalle.producto.nombre_producto}" en {venta.sucursal.nombre_sucursal} '
            f'(disponible: {inventario.stock_actual}, solicitado: {detalle.cantidad}).'
        )
        raise ValidationError({'detalles': [mensaje]})

    inventario.stock_actual -= detalle.cantidad
    inventario.save(update_fields=['stock_actual'])

    registrar_movimiento_inventario(
        sucursal=venta.sucursal, tipo_item=MovimientoInventario.TIPO_PRODUCTO, item_id=detalle.producto_id,
        tipo_movimiento=MovimientoInventario.SALIDA, cantidad=detalle.cantidad,
        motivo=MovimientoInventario.MOTIVO_VENTA, referencia_id=venta.id,
        stock_resultante=inventario.stock_actual, usuario=usuario,
    )


def _revertir_linea_venta(venta, detalle, usuario):
    inventario = bloquear_inventario_producto(venta.sucursal, detalle.producto)
    inventario.stock_actual += detalle.cantidad
    inventario.save(update_fields=['stock_actual'])

    registrar_movimiento_inventario(
        sucursal=venta.sucursal, tipo_item=MovimientoInventario.TIPO_PRODUCTO, item_id=detalle.producto_id,
        tipo_movimiento=MovimientoInventario.ENTRADA, cantidad=detalle.cantidad,
        motivo=MovimientoInventario.MOTIVO_AJUSTE, referencia_id=venta.id,
        stock_resultante=inventario.stock_actual, usuario=usuario,
    )


class VentaViewSet(viewsets.ModelViewSet):
    """CRUD de ventas — feature 011 · Ventas. Cualquier usuario autenticado
    puede registrar y consultar, sin restricción de rol. Solo lectura y
    creación como métodos genéricos (sin `PUT`/`PATCH`/`DELETE`): una vez
    creada, una venta solo cambia de estado vía `entregar()`/`cancelar()`.
    """

    http_method_names = ['get', 'post', 'head', 'options']
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated]
    queryset = (
        Venta.objects.select_related('cliente', 'sucursal', 'usuario')
        .prefetch_related('detalles__producto')
        .all()
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        sucursal_id = params.get('sucursal')
        if sucursal_id:
            queryset = queryset.filter(sucursal_id=sucursal_id)

        estado = params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        cliente_id = params.get('cliente')
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)

        producto_id = params.get('producto')
        if producto_id:
            queryset = queryset.filter(detalles__producto_id=producto_id).distinct()

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
        venta = serializer.save()

        for detalle in venta.detalles.select_related('producto').all():
            _confirmar_linea_venta(venta, detalle, request.user)

        registrar_movimiento_caja(
            tipo_movimiento=MovimientoCaja.INGRESO, monto=venta.total, motivo=MovimientoCaja.MOTIVO_VENTA,
            referencia_id=venta.id, usuario=request.user, observacion=f'Venta #{venta.id}',
        )

        headers = self.get_success_headers(serializer.data)
        return Response(self.get_serializer(venta).data, status=201, headers=headers)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def entregar(self, request, pk=None):
        venta = self.get_object()

        if venta.estado != Venta.ESTADO_PENDIENTE:
            return Response({'detail': 'Solo se puede entregar una venta pendiente.'}, status=400)

        venta.estado = Venta.ESTADO_ENTREGADA
        venta.fecha_entrega_real = timezone.now()
        venta.save(update_fields=['estado', 'fecha_entrega_real'])

        return Response(self.get_serializer(venta).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancelar(self, request, pk=None):
        venta = self.get_object()

        if venta.estado == Venta.ESTADO_CANCELADA:
            return Response({'detail': 'La venta ya está cancelada.'}, status=400)

        # El stock y el ingreso de caja ya ocurrieron al crear la venta,
        # sin importar si su estado es pendiente o entregada — cancelar
        # siempre revierte ambos, nunca editando los movimientos originales.
        for detalle in venta.detalles.select_related('producto').all():
            _revertir_linea_venta(venta, detalle, request.user)

        registrar_movimiento_caja(
            tipo_movimiento=MovimientoCaja.RETIRO, monto=venta.total, motivo=MovimientoCaja.MOTIVO_AJUSTE,
            referencia_id=venta.id, usuario=request.user,
            observacion=f'Reverso por cancelación de venta #{venta.id}',
        )

        venta.estado = Venta.ESTADO_CANCELADA
        venta.save(update_fields=['estado'])

        return Response(self.get_serializer(venta).data)

    @action(detail=True, methods=['get'])
    def ticket(self, request, pk=None):
        venta = self.get_object()
        html = render_to_string('ventas/ticket.html', {
            'venta': venta,
            'detalles': venta.detalles.select_related('producto').all(),
            'cliente_nombre': venta.cliente.nombre_cliente if venta.cliente else 'Sin cliente',
            'usuario_nombre': venta.usuario.nombre_mostrado(),
        })

        buffer = io.BytesIO()
        resultado = pisa.CreatePDF(html, dest=buffer)
        if resultado.err:
            return Response({'detail': 'No se pudo generar el ticket en PDF.'}, status=500)

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="venta-{venta.id}.pdf"'
        return response
