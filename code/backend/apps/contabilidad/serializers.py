from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import AsientoContable, CuentaContable, MovimientoContable


class CuentaContableSerializer(serializers.ModelSerializer):
    codigo = serializers.CharField(
        max_length=10,
        validators=[UniqueValidator(
            queryset=CuentaContable.objects.all(), message='Ya existe una cuenta con ese código.',
        )],
    )
    cuenta_padre = serializers.PrimaryKeyRelatedField(
        queryset=CuentaContable.objects.filter(activo=True), required=False, allow_null=True,
    )
    cuenta_padre_codigo = serializers.SerializerMethodField()

    class Meta:
        model = CuentaContable
        fields = ['id', 'codigo', 'nombre', 'tipo', 'cuenta_padre', 'cuenta_padre_codigo', 'activo']
        read_only_fields = ['id', 'activo']

    def get_cuenta_padre_codigo(self, cuenta):
        return cuenta.cuenta_padre.codigo if cuenta.cuenta_padre else None

    def validate_cuenta_padre(self, value):
        if value and self.instance and value.id == self.instance.id:
            raise serializers.ValidationError('Una cuenta no puede ser su propia cuenta padre.')
        return value


class MovimientoContableSerializer(serializers.ModelSerializer):
    cuenta_codigo = serializers.CharField(source='cuenta_contable.codigo', read_only=True)
    cuenta_nombre = serializers.CharField(source='cuenta_contable.nombre', read_only=True)

    class Meta:
        model = MovimientoContable
        fields = ['id', 'cuenta_contable', 'cuenta_codigo', 'cuenta_nombre', 'tipo_movimiento', 'monto']


class AsientoContableSerializer(serializers.ModelSerializer):
    """De solo lectura en su totalidad — `AsientoContableViewSet` no
    expone `create`/`update`/`destroy` (ver docstring de `AsientoContable`).
    """

    usuario_nombre = serializers.SerializerMethodField()
    movimientos = MovimientoContableSerializer(many=True, read_only=True)

    class Meta:
        model = AsientoContable
        fields = [
            'id', 'fecha', 'concepto', 'tipo_origen', 'referencia_id', 'usuario', 'usuario_nombre', 'movimientos',
        ]

    def get_usuario_nombre(self, asiento):
        return asiento.usuario.nombre_mostrado()
