from rest_framework import serializers

from .models import Sucursal
from .validators import validar_nombre_disponible


class SucursalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sucursal
        fields = ['id', 'nombre_sucursal', 'ubicacion_sucursal', 'telefono_sucursal', 'activo']
        read_only_fields = ['id', 'activo']

    def validate(self, attrs):
        nombre = attrs.get('nombre_sucursal', getattr(self.instance, 'nombre_sucursal', None))
        ubicacion = attrs.get('ubicacion_sucursal', getattr(self.instance, 'ubicacion_sucursal', ''))
        excluir_pk = self.instance.pk if self.instance else None

        validar_nombre_disponible(nombre, ubicacion, excluir_pk=excluir_pk)

        return attrs
