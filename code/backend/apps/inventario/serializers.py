from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from apps.catalogo.models import MateriaPrima, Producto
from apps.sucursales.models import Sucursal

from .models import MovimientoInventario


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

    class Meta:
        model = MovimientoInventario
        fields = [
            'id', 'fecha', 'sucursal', 'sucursal_nombre', 'tipo_item', 'item_id', 'item_nombre',
            'tipo_movimiento', 'cantidad', 'motivo', 'referencia_id', 'stock_resultante',
            'usuario', 'usuario_nombre',
        ]

    def get_item_nombre(self, movimiento):
        return resolver_nombre_item(movimiento.tipo_item, movimiento.item_id)

    def get_usuario_nombre(self, movimiento):
        return movimiento.usuario.nombre_mostrado()
