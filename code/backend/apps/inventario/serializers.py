from rest_framework import serializers

from apps.catalogo.models import MateriaPrima, Producto

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
