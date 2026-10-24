from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers
<<<<<<< HEAD
=======
from rest_framework.validators import UniqueTogetherValidator
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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
<<<<<<< HEAD
=======
    creado_por_nombre = serializers.SerializerMethodField()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

    class Meta:
        model = Receta
        fields = [
            'id', 'producto', 'producto_nombre', 'materia_prima', 'materia_prima_nombre',
<<<<<<< HEAD
            'cantidad_requerida', 'activo',
        ]
        read_only_fields = ['id', 'activo']
=======
            'cantidad_requerida', 'activo', 'creado_por', 'creado_por_nombre',
        ]
        # `creado_por` lo asigna el ViewSet desde la sesión, nunca la petición.
        read_only_fields = ['id', 'activo', 'creado_por']
        # Mensaje propio en español: el de DRF por defecto sale en inglés
        # (`LANGUAGE_CODE = 'en-us'`) y el frontend lo muestra tal cual.
        validators = [
            UniqueTogetherValidator(
                queryset=Receta.objects.all(),
                fields=['producto', 'materia_prima'],
                message='Esta materia prima ya forma parte de la receta de este producto.',
            ),
        ]

    def get_creado_por_nombre(self, receta):
        return receta.creado_por.nombre_mostrado() if receta.creado_por else None
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b


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
