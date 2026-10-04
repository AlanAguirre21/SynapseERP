from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from apps.catalogo.models import MateriaPrima, Producto
from apps.sucursales.models import Sucursal

from .models import DetalleTraslado, MovimientoInventario, Traslado


class AlertaStockSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=['producto', 'materia_prima'])
    nombre = serializers.CharField()
    sucursal = serializers.CharField()
    stock_actual = serializers.DecimalField(max_digits=12, decimal_places=2)
    stock_minimo = serializers.DecimalField(max_digits=12, decimal_places=2)


class StockItemSerializer(serializers.Serializer):
    """Una fila de la tabla de stock — no es un `ModelSerializer` porque no
    representa una única fila de `InventarioSucursalProducto`/
    `MateriaPrima`: cada `Producto`/`MateriaPrima` activo aparece una vez
    aunque no tenga registro de inventario en la sucursal seleccionada
    (`stock_actual`/`stock_minimo` en 0 en ese caso), según el criterio de
    aceptación de `spec.md`.
    """

    id = serializers.IntegerField()
    nombre = serializers.CharField()
    stock_actual = serializers.DecimalField(max_digits=12, decimal_places=2)
    stock_minimo = serializers.DecimalField(max_digits=12, decimal_places=2)
    stock_bajo = serializers.BooleanField()


def validar_stock_minimo_entero(valor):
    """`stock_minimo` es un umbral de configuración, no una cantidad física
    fraccionaria — a diferencia de `stock_actual` de materia prima (kg/L),
    siempre se fija en unidades enteras (ver `spec.md`, ampliación)."""

    if valor != valor.to_integral_value():
        raise serializers.ValidationError('El stock mínimo debe ser un número entero.')


class EditarStockMinimoSerializer(serializers.Serializer):
    """Valida la edición de `stock_minimo` (solo rol admin, permiso a nivel
    de vista). No es un `ModelSerializer`: identifica el ítem de forma
    polimórfica (`tipo` + `item_id`), igual que `StockItemSerializer`."""

    tipo = serializers.ChoiceField(
        choices=[MovimientoInventario.TIPO_PRODUCTO, MovimientoInventario.TIPO_MATERIA_PRIMA],
    )
    sucursal = serializers.PrimaryKeyRelatedField(queryset=Sucursal.objects.filter(activo=True))
    item_id = serializers.IntegerField()
    stock_minimo = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal(0)), validar_stock_minimo_entero],
    )


def resolver_nombre_item(tipo_item, item_id):
    """Resuelve el nombre de un ítem referenciado de forma polimórfica por
    `MovimientoInventario.tipo_item`/`item_id`. No filtra por `activo`: un
    movimiento histórico debe seguir mostrando el nombre aunque el ítem ya
    esté desactivado.
    """

    modelo = Producto if tipo_item == MovimientoInventario.TIPO_PRODUCTO else MateriaPrima
    campo_nombre = 'nombre_producto' if tipo_item == MovimientoInventario.TIPO_PRODUCTO else 'nombre_item'

    item = modelo.objects.filter(pk=item_id).first()
    return getattr(item, campo_nombre) if item else f'#{item_id} (eliminado)'


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    item_nombre = serializers.SerializerMethodField()
    sucursal_nombre = serializers.CharField(source='sucursal.nombre_sucursal', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    sucursal_contraparte = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoInventario
        fields = [
            'id', 'fecha', 'sucursal', 'sucursal_nombre', 'tipo_item', 'item_id', 'item_nombre',
            'tipo_movimiento', 'cantidad', 'motivo', 'referencia_id', 'stock_resultante',
            'usuario', 'usuario_nombre', 'sucursal_contraparte',
        ]

    def get_sucursal_contraparte(self, movimiento):
        """Nombre de la otra sucursal de un traslado (destino para una
        salida, origen para una entrada); `None` para cualquier otro motivo.
        Los `Traslado` llegan precargados en lote vía `context['traslados']`
        (ver `MovimientoInventarioViewSet.list`), para no hacer una consulta
        por fila."""

        if movimiento.motivo not in MovimientoInventario.MOTIVOS_TRASLADO:
            return None
        traslado = self.context.get('traslados', {}).get(movimiento.referencia_id)
        if traslado is None:
            return None
        if movimiento.motivo == MovimientoInventario.MOTIVO_TRASLADO_SALIDA:
            return traslado.sucursal_destino.nombre_sucursal
        return traslado.sucursal_origen.nombre_sucursal

    def get_item_nombre(self, movimiento):
        return resolver_nombre_item(movimiento.tipo_item, movimiento.item_id)

    def get_usuario_nombre(self, movimiento):
        return movimiento.usuario.nombre_mostrado()


# --- Traslados -------------------------------------------------------------

class DetalleTrasladoSerializer(serializers.Serializer):
    """Una línea de entrada de un traslado. Identifica el ítem de forma
    polimórfica (`tipo_item` + `item_id`); `validate()` lo resuelve contra
    `Producto`/`MateriaPrima` activos y lo deja en `validated_data['item']`.
    """

    tipo_item = serializers.ChoiceField(
        choices=[MovimientoInventario.TIPO_PRODUCTO, MovimientoInventario.TIPO_MATERIA_PRIMA],
    )
    item_id = serializers.IntegerField()
    cantidad = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal('0.01'),
        error_messages={
            'min_value': 'La cantidad debe ser mayor a 0.',
            'max_decimal_places': 'La cantidad admite como máximo 2 decimales.',
            'invalid': 'La cantidad debe ser un número válido.',
        },
    )

    def validate(self, datos):
        if datos['tipo_item'] == MovimientoInventario.TIPO_PRODUCTO:
            item = Producto.objects.filter(pk=datos['item_id'], activo=True).first()
            if item is None:
                raise serializers.ValidationError({'item_id': 'Producto no encontrado o inactivo.'})
        else:
            item = MateriaPrima.objects.filter(pk=datos['item_id'], activo=True).first()
            if item is None:
                raise serializers.ValidationError({'item_id': 'Materia prima no encontrada o inactiva.'})
        datos['item'] = item
        return datos


class TrasladoSerializer(serializers.Serializer):
    """Entrada de `POST /api/inventario/traslados/`. Solo valida; la
    escritura la hace `services.trasladar_stock()`."""

    sucursal_origen = serializers.PrimaryKeyRelatedField(
        queryset=Sucursal.objects.filter(activo=True),
        error_messages={'does_not_exist': 'La sucursal origen no existe o está inactiva.'},
    )
    sucursal_destino = serializers.PrimaryKeyRelatedField(
        queryset=Sucursal.objects.filter(activo=True),
        error_messages={'does_not_exist': 'La sucursal destino no existe o está inactiva.'},
    )
    detalles = DetalleTrasladoSerializer(
        many=True, allow_empty=False,
        error_messages={'empty': 'El traslado debe incluir al menos un ítem.'},
    )

    def validate(self, datos):
        if datos['sucursal_origen'] == datos['sucursal_destino']:
            raise serializers.ValidationError(
                {'sucursal_destino': 'La sucursal destino debe ser distinta de la sucursal origen.'},
            )

        vistos = set()
        for numero, linea in enumerate(datos['detalles'], start=1):
            clave = (linea['tipo_item'], linea['item_id'])
            if clave in vistos:
                raise serializers.ValidationError({
                    'detalles': f'El ítem de la línea {numero} ya está en otra línea del traslado; '
                                'ajusta la cantidad de esa línea en vez de repetirlo.',
                })
            vistos.add(clave)
        return datos


class DetalleTrasladoLecturaSerializer(serializers.ModelSerializer):
    item_nombre = serializers.SerializerMethodField()

    class Meta:
        model = DetalleTraslado
        fields = ['id', 'tipo_item', 'item_id', 'item_nombre', 'cantidad']

    def get_item_nombre(self, detalle):
        return resolver_nombre_item(detalle.tipo_item, detalle.item_id)


class TrasladoLecturaSerializer(serializers.ModelSerializer):
    sucursal_origen_nombre = serializers.CharField(source='sucursal_origen.nombre_sucursal', read_only=True)
    sucursal_destino_nombre = serializers.CharField(source='sucursal_destino.nombre_sucursal', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    detalles = DetalleTrasladoLecturaSerializer(many=True, read_only=True)

    class Meta:
        model = Traslado
        fields = [
            'id', 'fecha', 'sucursal_origen', 'sucursal_origen_nombre', 'sucursal_destino',
            'sucursal_destino_nombre', 'usuario', 'usuario_nombre', 'detalles',
        ]

    def get_usuario_nombre(self, traslado):
        return traslado.usuario.nombre_mostrado()
