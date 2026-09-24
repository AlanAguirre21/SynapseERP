from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Categoria, MateriaPrima, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre_categoria', 'descripcion_categoria', 'tipo', 'activo']
        read_only_fields = ['id', 'activo']


def _validar_categoria_para_tipo(categoria, tipo_requerido, etiqueta):
    if categoria.tipo not in (tipo_requerido, Categoria.TIPO_AMBOS):
        raise serializers.ValidationError({
            'categoria': f'La categoría seleccionada no aplica para {etiqueta}.'
        })


class ProductoSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(
        max_length=50,
        validators=[UniqueValidator(
            queryset=Producto.objects.all(), message='Ya existe un producto con ese SKU.',
        )],
    )
    precio_venta = serializers.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal(0))]
    )
    costo_produccion = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
        validators=[MinValueValidator(Decimal(0))],
    )

    class Meta:
        model = Producto
        fields = [
            'id', 'nombre_producto', 'sku', 'descripcion_producto', 'categoria',
            'unidad_medida', 'precio_venta', 'costo_produccion', 'activo',
        ]
        read_only_fields = ['id', 'activo']

    def validate(self, attrs):
        categoria = attrs.get('categoria', getattr(self.instance, 'categoria', None))
        if categoria is not None:
            _validar_categoria_para_tipo(categoria, Categoria.TIPO_PRODUCTO, 'productos')
        return attrs


class MateriaPrimaSerializer(serializers.ModelSerializer):
    costo_promedio = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False,
        validators=[MinValueValidator(Decimal(0))],
    )

    class Meta:
        model = MateriaPrima
        fields = [
            'id', 'nombre_item', 'categoria', 'unidad_medida', 'costo_promedio',
            'proveedor_principal', 'activo',
        ]
        read_only_fields = ['id', 'activo']

    def validate(self, attrs):
        categoria = attrs.get('categoria', getattr(self.instance, 'categoria', None))
        if categoria is not None:
            _validar_categoria_para_tipo(categoria, Categoria.TIPO_MATERIA_PRIMA, 'materia prima')
        return attrs
