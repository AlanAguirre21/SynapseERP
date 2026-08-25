from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from .models import Cliente, DatosFiscalesCliente, Empleado, Proveedor

CAMPOS_FISCALES_OBLIGATORIOS = ['rfc', 'razon_social', 'codigo_postal_fiscal', 'regimen_fiscal']


class DatosFiscalesClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatosFiscalesCliente
        fields = [
            'rfc', 'razon_social', 'codigo_postal_fiscal', 'regimen_fiscal',
            'uso_cfdi_default', 'requiere_factura',
        ]


class ClienteSerializer(serializers.ModelSerializer):
    """`datos_fiscales` es opcional: la mayoría de los clientes no factura.
    Django hace que el descriptor inverso de un `OneToOneField` sin fila
    relacionada lance `RelatedObjectDoesNotExist` — subclase de
    `AttributeError` a propósito, por lo que `getattr(instance,
    'datos_fiscales', None)` (usado tanto aquí como por DRF al serializar)
    resuelve a `None` en vez de reventar.
    """

    datos_fiscales = DatosFiscalesClienteSerializer(required=False, allow_null=True)

    class Meta:
        model = Cliente
        fields = ['id', 'nombre_cliente', 'telefono', 'email', 'direccion', 'activo', 'datos_fiscales']
        read_only_fields = ['id', 'activo']

    def validate(self, attrs):
        datos_fiscales = attrs.get('datos_fiscales')
        if datos_fiscales is None:
            return attrs

        existente = getattr(self.instance, 'datos_fiscales', None)
        requiere_factura = datos_fiscales.get(
            'requiere_factura', existente.requiere_factura if existente else False,
        )

        if requiere_factura:
            faltantes = [
                campo for campo in CAMPOS_FISCALES_OBLIGATORIOS
                if not datos_fiscales.get(campo, getattr(existente, campo, '') if existente else '')
            ]
            if faltantes:
                raise serializers.ValidationError({
                    'datos_fiscales': (
                        'Completa estos datos fiscales antes de marcar que el cliente requiere '
                        f'factura: {", ".join(faltantes)}.'
                    ),
                })

        return attrs

    def create(self, validated_data):
        datos_fiscales_data = validated_data.pop('datos_fiscales', None)
        cliente = Cliente.objects.create(**validated_data)
        if datos_fiscales_data:
            DatosFiscalesCliente.objects.create(cliente=cliente, **datos_fiscales_data)
        return cliente

    def update(self, instance, validated_data):
        datos_fiscales_data = validated_data.pop('datos_fiscales', None)
        for campo, valor in validated_data.items():
            setattr(instance, campo, valor)
        instance.save()

        if datos_fiscales_data is not None:
            DatosFiscalesCliente.objects.update_or_create(cliente=instance, defaults=datos_fiscales_data)

        return instance


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = ['id', 'nombre_proveedor', 'rfc', 'contacto_nombre', 'telefono', 'email', 'direccion', 'activo']
        read_only_fields = ['id', 'activo']


class EmpleadoSerializer(serializers.ModelSerializer):
    salario = serializers.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal(0))],
    )

    class Meta:
        model = Empleado
        fields = ['id', 'nombre_completo', 'puesto', 'telefono', 'email', 'fecha_contratacion', 'salario', 'activo']
        read_only_fields = ['id', 'activo']
