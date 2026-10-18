from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalogo.models import MateriaPrima, Producto
from core.permissions import LecturaParaTodosEscrituraSoloAdmin

from .models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
    Traslado,
)
from .serializers import (
    AlertaStockSerializer,
    EditarStockMinimoSerializer,
    MovimientoInventarioSerializer,
    StockItemSerializer,
    TrasladoLecturaSerializer,
    TrasladoSerializer,
)
from .services import (
    bloquear_inventario_materia_prima,
    bloquear_inventario_producto,
    trasladar_stock,
)


class AlertasStockView(ListAPIView):
    """GET /api/inventario/alertas/ — productos y materia prima con
    stock_actual por debajo de stock_minimo, en cualquier sucursal.
    """

    serializer_class = AlertaStockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        alertas_producto = InventarioSucursalProducto.objects.select_related(
            'producto', 'sucursal'
        ).filter(stock_actual__lt=F('stock_minimo'))

        alertas_materia_prima = InventarioSucursalMateriaPrima.objects.select_related(
            'materia_prima', 'sucursal'
        ).filter(stock_actual__lt=F('stock_minimo'))

        alertas = [
            {
                'tipo': 'producto',
                'nombre': item.producto.nombre_producto,
                'sucursal': item.sucursal.nombre_sucursal,
                'stock_actual': item.stock_actual,
                'stock_minimo': item.stock_minimo,
            }
            for item in alertas_producto
        ] + [
            {
                'tipo': 'materia_prima',
                'nombre': item.materia_prima.nombre_item,
                'sucursal': item.sucursal.nombre_sucursal,
                'stock_actual': item.stock_actual,
                'stock_minimo': item.stock_minimo,
            }
            for item in alertas_materia_prima
        ]
        return alertas


def _fila_stock(item_id, nombre, inventario):
    stock_actual = inventario.stock_actual if inventario else Decimal(0)
    stock_minimo = inventario.stock_minimo if inventario else Decimal(0)
    return {
        'id': item_id,
        'nombre': nombre,
        'stock_actual': stock_actual,
        'stock_minimo': stock_minimo,
        'stock_bajo': stock_actual < stock_minimo,
    }


class StockView(APIView):
    """GET /api/inventario/stock/?tipo=producto|materia_prima&sucursal=<id>

    Una fila por cada ítem ACTIVO del catálogo del tipo pedido, con su
    stock en la sucursal indicada. Un ítem sin `InventarioSucursalProducto`/
    `MateriaPrima` en esa sucursal (ej. producto nuevo aún no comprado ahí)
    aparece con stock 0 en vez de omitirse — criterio de aceptación
    explícito de `spec.md`, por lo que no se implementa como un
    `ReadOnlyModelViewSet` directo sobre esas tablas (que solo devolvería
    las filas que ya existen).

    `PATCH` (misma ruta) edita únicamente `stock_minimo` — restringido a
    admin por `LecturaParaTodosEscrituraSoloAdmin`, que ya deja `GET`
    abierto a cualquier autenticado al ser un método seguro. Nunca toca
    `stock_actual` ni genera `MovimientoInventario`: es un umbral de
    configuración, no un movimiento de inventario (ver `spec.md`,
    ampliación).
    """

    permission_classes = [LecturaParaTodosEscrituraSoloAdmin]

    def get(self, request):
        tipo = request.query_params.get('tipo')
        sucursal_id = request.query_params.get('sucursal')

        if tipo not in (MovimientoInventario.TIPO_PRODUCTO, MovimientoInventario.TIPO_MATERIA_PRIMA):
            raise ValidationError({'tipo': 'Debe ser "producto" o "materia_prima".'})
        if not sucursal_id:
            raise ValidationError({'sucursal': 'Este parámetro es obligatorio.'})
        try:
            sucursal_id = int(sucursal_id)
        except ValueError as exc:
            raise ValidationError({'sucursal': 'Debe ser un ID numérico válido.'}) from exc

        if tipo == MovimientoInventario.TIPO_PRODUCTO:
            items = Producto.objects.filter(activo=True).order_by('nombre_producto')
            inventarios = {
                inv.producto_id: inv
                for inv in InventarioSucursalProducto.objects.filter(sucursal_id=sucursal_id)
            }
            filas = [_fila_stock(item.id, item.nombre_producto, inventarios.get(item.id)) for item in items]
        else:
            items = MateriaPrima.objects.filter(activo=True).order_by('nombre_item')
            inventarios = {
                inv.materia_prima_id: inv
                for inv in InventarioSucursalMateriaPrima.objects.filter(sucursal_id=sucursal_id)
            }
            filas = [_fila_stock(item.id, item.nombre_item, inventarios.get(item.id)) for item in items]

        return Response(StockItemSerializer(filas, many=True).data)

    @transaction.atomic
    def patch(self, request):
        serializer = EditarStockMinimoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tipo = serializer.validated_data['tipo']
        sucursal = serializer.validated_data['sucursal']
        item_id = serializer.validated_data['item_id']
        stock_minimo = serializer.validated_data['stock_minimo']

        if tipo == MovimientoInventario.TIPO_PRODUCTO:
            producto = Producto.objects.filter(pk=item_id, activo=True).first()
            if producto is None:
                raise ValidationError({'item_id': 'Producto no encontrado o inactivo.'})
            inventario = bloquear_inventario_producto(sucursal, producto)
            nombre = producto.nombre_producto
        else:
            materia_prima = MateriaPrima.objects.filter(pk=item_id, activo=True).first()
            if materia_prima is None:
                raise ValidationError({'item_id': 'Materia prima no encontrada o inactiva.'})
            inventario = bloquear_inventario_materia_prima(sucursal, materia_prima)
            nombre = materia_prima.nombre_item

        inventario.stock_minimo = stock_minimo
        inventario.save(update_fields=['stock_minimo'])

        return Response(StockItemSerializer(_fila_stock(item_id, nombre, inventario)).data)


class MovimientoInventarioViewSet(viewsets.ReadOnlyModelViewSet):
    """Historial de movimientos de inventario, de solo lectura — ningún
    método de escritura existe en esta ruta a nivel de framework (no solo
    bloqueado por permisos), ver Decisiones en `plan.md` de esta feature.
    Filtrable por `sucursal`, `tipo_item`, `item_id`, `tipo_movimiento` y
    `motivo` vía query params combinables. `motivo=traslado` agrupa
    `traslado_salida` y `traslado_entrada`.
    """

    serializer_class = MovimientoInventarioSerializer
    permission_classes = [IsAuthenticated]
    queryset = MovimientoInventario.objects.select_related('sucursal', 'usuario').all()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        sucursal_id = params.get('sucursal')
        if sucursal_id:
            queryset = queryset.filter(sucursal_id=sucursal_id)

        tipo_item = params.get('tipo_item')
        if tipo_item:
            queryset = queryset.filter(tipo_item=tipo_item)

        item_id = params.get('item_id')
        if item_id:
            queryset = queryset.filter(item_id=item_id)

        tipo_movimiento = params.get('tipo_movimiento')
        if tipo_movimiento:
            queryset = queryset.filter(tipo_movimiento=tipo_movimiento)

        motivo = params.get('motivo')
        if motivo == 'traslado':
            queryset = queryset.filter(motivo__in=MovimientoInventario.MOTIVOS_TRASLADO)
        elif motivo:
            queryset = queryset.filter(motivo=motivo)

        return queryset

    def list(self, request, *args, **kwargs):
        # El historial no está paginado: se evalúa el queryset una vez y se
        # precargan en lote los `Traslado` referenciados, para que
        # `sucursal_contraparte` no haga una consulta por fila.
        movimientos = list(self.filter_queryset(self.get_queryset()))
        ids_traslado = {
            m.referencia_id for m in movimientos
            if m.motivo in MovimientoInventario.MOTIVOS_TRASLADO and m.referencia_id is not None
        }
        traslados = Traslado.objects.select_related('sucursal_origen', 'sucursal_destino').in_bulk(ids_traslado)
        serializer = self.get_serializer(
            movimientos, many=True, context={**self.get_serializer_context(), 'traslados': traslados},
        )
        return Response(serializer.data)


class TrasladoViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """POST /api/inventario/traslados/ — registra un traslado de stock
    (una o varias líneas, productos y/o materia prima) entre dos sucursales.

    Solo creación, vía mixin explícito (precedente de `015 · Caja`): no
    existen `list`/`retrieve`/`update`/`destroy`, así que cualquier otro
    método responde 405 a nivel de framework — un `Traslado` es
    INSERT-only. Abierto a cualquier autenticado (admin u operador): es
    operación diaria, no configuración administrativa.
    """

    serializer_class = TrasladoSerializer
    permission_classes = [IsAuthenticated]
    queryset = Traslado.objects.all()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        traslado = trasladar_stock(
            sucursal_origen=datos['sucursal_origen'],
            sucursal_destino=datos['sucursal_destino'],
            lineas=[(linea['tipo_item'], linea['item'], linea['cantidad']) for linea in datos['detalles']],
            usuario=request.user,
        )
        return Response(TrasladoLecturaSerializer(traslado).data, status=201)
