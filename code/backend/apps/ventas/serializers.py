from decimal import ROUND_HALF_UP, Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from apps.catalogo.models import Producto
from apps.personas.models import Cliente
from apps.sucursales.models import Sucursal

from .models import DetalleVenta, Venta

CANTIDAD_MINIMA = Decimal('0.01')


def calcular_subtotal(cantidad, precio_unitario):
    """Misma regla de redondeo (2 decimales, `ROUND_HALF_UP`) usada en
    Compras — documentada para evitar diferencias de centavos entre lo
    mostrado en el frontend y lo guardado.
    """

    return (cantidad * precio_unitario).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class DetalleVentaSerializer(serializers.ModelSerializer):
    """`precio_unitario` y `subtotal` son de solo lectura: el precio
    siempre es el `precio_venta` vigente del producto al momento de la
    venta, nunca un valor capturado por el cliente — a diferencia de
    Compras, donde el costo unitario sí lo define quien compra (Fuera de
    alcance de `spec.md`: "no incluye descuentos ni precios especiales").
    """

    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.filter(activo=True))
    cantidad = serializers.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(CANTIDAD_MINIMA)],
    )

    class Meta:
        model = DetalleVenta
        fields = ['id', 'producto', 'cantidad', 'precio_unitario', 'subtotal']
        read_only_fields = ['id', 'precio_unitario', 'subtotal']


class VentaSerializer(serializers.ModelSerializer):
    """Solo construye la cabecera y las líneas (con precio congelado y
    total calculado) — la validación de stock, el descuento de inventario
    y el ingreso de caja NO viven aquí, sino en `VentaViewSet.create()`,
    dentro de la misma `transaction.atomic()`. Así esta clase se queda
    enfocada en dar forma a los datos, igual que `CompraSerializer`.
    """

    cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.filter(activo=True), required=False, allow_null=True,
    )
    sucursal = serializers.PrimaryKeyRelatedField(queryset=Sucursal.objects.filter(activo=True))
    cliente_nombre = serializers.SerializerMethodField()
    sucursal_nombre = serializers.CharField(source='sucursal.nombre_sucursal', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    detalles = DetalleVentaSerializer(many=True)

    class Meta:
        model = Venta
        fields = [
            'id', 'cliente', 'cliente_nombre', 'sucursal', 'sucursal_nombre', 'usuario', 'usuario_nombre',
            'fecha', 'fecha_entrega', 'fecha_entrega_real', 'total', 'estado', 'detalles',
        ]
        read_only_fields = ['id', 'usuario', 'fecha', 'fecha_entrega_real', 'total', 'estado']

    def get_cliente_nombre(self, venta):
        return venta.cliente.nombre_cliente if venta.cliente else 'Sin cliente'

    def get_usuario_nombre(self, venta):
        return venta.usuario.nombre_mostrado()

    def validate_detalles(self, detalles):
        if not detalles:
            raise serializers.ValidationError('Una venta debe tener al menos una línea de producto.')
        return detalles

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        fecha_entrega = validated_data.get('fecha_entrega')
        estado_inicial = Venta.ESTADO_PENDIENTE if fecha_entrega else Venta.ESTADO_ENTREGADA

        venta = Venta.objects.create(
            usuario=self.context['request'].user, estado=estado_inicial, **validated_data,
        )
        total = Decimal(0)

        for linea in detalles_data:
            producto = linea['producto']
            cantidad = linea['cantidad']
            precio_unitario = producto.precio_venta
            subtotal = calcular_subtotal(cantidad, precio_unitario)

            DetalleVenta.objects.create(
                venta=venta, producto=producto, cantidad=cantidad, precio_unitario=precio_unitario,
                subtotal=subtotal,
            )
            total += subtotal

        venta.total = total
        venta.save(update_fields=['total'])
        return venta
