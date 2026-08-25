from decimal import ROUND_HALF_UP, Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from apps.catalogo.models import MateriaPrima, Producto
from apps.personas.models import Proveedor
from apps.sucursales.models import Sucursal

from .models import Compra, DetalleCompraMateriaPrima, DetalleCompraProducto

CANTIDAD_MINIMA = Decimal('0.01')
COSTO_MINIMO = Decimal(0)


def calcular_subtotal(cantidad, costo_unitario):
    """Misma regla de redondeo (2 decimales, `ROUND_HALF_UP`) que debe
    replicar el frontend para el total en vivo — documentada en el riesgo
    de `plan.md` sobre diferencias de centavos entre lo mostrado y lo
    guardado.
    """

    return (cantidad * costo_unitario).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class DetalleCompraProductoSerializer(serializers.ModelSerializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.filter(activo=True))
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(CANTIDAD_MINIMA)])
    costo_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(COSTO_MINIMO)])

    class Meta:
        model = DetalleCompraProducto
        fields = ['id', 'producto', 'cantidad', 'costo_unitario', 'subtotal']
        read_only_fields = ['id', 'subtotal']


class DetalleCompraMateriaPrimaSerializer(serializers.ModelSerializer):
    materia_prima = serializers.PrimaryKeyRelatedField(queryset=MateriaPrima.objects.filter(activo=True))
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(CANTIDAD_MINIMA)])
    costo_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(COSTO_MINIMO)])

    class Meta:
        model = DetalleCompraMateriaPrima
        fields = ['id', 'materia_prima', 'cantidad', 'costo_unitario', 'subtotal']
        read_only_fields = ['id', 'subtotal']


class CompraSerializer(serializers.ModelSerializer):
    """El total se calcula siempre en el backend a partir de las líneas —
    nunca se confía en un `total` enviado por el cliente (decisión
    explícita de `plan.md`, por eso no aparece como campo de escritura).
    """

    proveedor = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.filter(activo=True))
    sucursal = serializers.PrimaryKeyRelatedField(queryset=Sucursal.objects.filter(activo=True))
    proveedor_nombre = serializers.CharField(source='proveedor.nombre_proveedor', read_only=True)
    sucursal_nombre = serializers.CharField(source='sucursal.nombre_sucursal', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    detalles_producto = DetalleCompraProductoSerializer(many=True, required=False)
    detalles_materia_prima = DetalleCompraMateriaPrimaSerializer(many=True, required=False)

    class Meta:
        model = Compra
        fields = [
            'id', 'proveedor', 'proveedor_nombre', 'sucursal', 'sucursal_nombre', 'usuario', 'usuario_nombre',
            'fecha', 'fecha_entrega', 'total', 'estado', 'detalles_producto', 'detalles_materia_prima',
        ]
        read_only_fields = ['id', 'usuario', 'fecha', 'total', 'estado']

    def get_usuario_nombre(self, compra):
        return compra.usuario.nombre_mostrado()

    def validate(self, attrs):
        detalles_producto = attrs.get('detalles_producto', [])
        detalles_materia_prima = attrs.get('detalles_materia_prima', [])
        if not detalles_producto and not detalles_materia_prima:
            raise serializers.ValidationError('Una compra debe tener al menos una línea de producto o materia prima.')
        return attrs

    def create(self, validated_data):
        detalles_producto_data = validated_data.pop('detalles_producto', [])
        detalles_materia_prima_data = validated_data.pop('detalles_materia_prima', [])

        compra = Compra.objects.create(usuario=self.context['request'].user, **validated_data)
        total = Decimal(0)

        for linea in detalles_producto_data:
            subtotal = calcular_subtotal(linea['cantidad'], linea['costo_unitario'])
            DetalleCompraProducto.objects.create(compra=compra, subtotal=subtotal, **linea)
            total += subtotal

        for linea in detalles_materia_prima_data:
            subtotal = calcular_subtotal(linea['cantidad'], linea['costo_unitario'])
            DetalleCompraMateriaPrima.objects.create(compra=compra, subtotal=subtotal, **linea)
            total += subtotal

        compra.total = total
        compra.save(update_fields=['total'])
        return compra
