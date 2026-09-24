from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from apps.catalogo.models import MateriaPrima, Producto
from apps.sucursales.models import Sucursal

from .models import DetalleProduccion, Produccion, Receta

CANTIDAD_MINIMA = Decimal(1)


def validar_cantidad_entera(valor):
    """Los productos se producen/venden por unidad completa — mismo
    criterio ya aplicado en `apps.ventas.serializers` a `DetalleVenta`."""

    if valor != valor.to_integral_value():
        raise serializers.ValidationError(
            'La cantidad debe ser un número entero — no se producen fracciones de producto.',
        )


class RecetaSerializer(serializers.ModelSerializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.filter(activo=True))
    materia_prima = serializers.PrimaryKeyRelatedField(queryset=MateriaPrima.objects.filter(activo=True))
    producto_nombre = serializers.CharField(source='producto.nombre_producto', read_only=True)
    materia_prima_nombre = serializers.CharField(source='materia_prima.nombre_item', read_only=True)
    cantidad_requerida = serializers.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))],
    )

    class Meta:
        model = Receta
        fields = [
            'id', 'producto', 'producto_nombre', 'materia_prima', 'materia_prima_nombre',
            'cantidad_requerida', 'activo',
        ]
        read_only_fields = ['id', 'activo']


class DetalleProduccionSerializer(serializers.ModelSerializer):
    """Siempre de solo lectura: es un snapshot que solo genera
    `ProduccionViewSet.create()`, nunca un payload de entrada del cliente.
    """

    materia_prima_nombre = serializers.CharField(source='materia_prima.nombre_item', read_only=True)

    class Meta:
        model = DetalleProduccion
        fields = ['id', 'materia_prima', 'materia_prima_nombre', 'cantidad_consumida', 'costo_unitario_momento', 'subtotal']
        read_only_fields = fields


class ProduccionSerializer(serializers.ModelSerializer):
    """Solo recibe `producto`/`sucursal`/`cantidad_producida` del cliente
    — a diferencia de Compras/Ventas, las líneas (`detalles`) no las
    manda el cliente: las calcula `ProduccionViewSet.create()` a partir de
    la receta vigente del producto, y quedan expuestas de solo lectura.
    """

    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.filter(activo=True))
    sucursal = serializers.PrimaryKeyRelatedField(queryset=Sucursal.objects.filter(activo=True))
    cantidad_producida = serializers.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(CANTIDAD_MINIMA), validar_cantidad_entera],
    )
    producto_nombre = serializers.CharField(source='producto.nombre_producto', read_only=True)
    sucursal_nombre = serializers.CharField(source='sucursal.nombre_sucursal', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    detalles = DetalleProduccionSerializer(many=True, read_only=True)

    class Meta:
        model = Produccion
        fields = [
            'id', 'producto', 'producto_nombre', 'sucursal', 'sucursal_nombre', 'usuario', 'usuario_nombre',
            'fecha', 'cantidad_producida', 'costo_total', 'detalles',
        ]
        read_only_fields = ['id', 'usuario', 'fecha', 'costo_total']

    def get_usuario_nombre(self, produccion):
        return produccion.usuario.nombre_mostrado()
