from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .crypto import cifrar
from .models import ConfiguracionPAC, DatosFiscalesEmpresa, SerieFolio


class DatosFiscalesEmpresaSerializer(serializers.ModelSerializer):
    completa = serializers.SerializerMethodField()

    class Meta:
        model = DatosFiscalesEmpresa
        fields = ['rfc', 'razon_social', 'regimen_fiscal', 'codigo_postal_fiscal', 'completa']

    def get_completa(self, instance):
        return instance.esta_completa()


class ConfiguracionPACSerializer(serializers.ModelSerializer):
    """`api_key` es `write_only` y opcional: si no se envía en un `PATCH`,
    la credencial ya guardada se conserva sin cambios — mismo patrón que
    `password` en `UsuarioSerializer` de `008`. Nunca se expone en texto
    plano en lectura; `api_key_configurada` solo indica si ya existe una
    credencial guardada, sin revelar su valor.
    """

    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
    api_key_configurada = serializers.SerializerMethodField()
    completa = serializers.SerializerMethodField()

    class Meta:
        model = ConfiguracionPAC
        fields = [
            'proveedor', 'api_key', 'api_key_configurada', 'api_endpoint',
            'configuracion_extra', 'activo', 'completa',
        ]

    def get_api_key_configurada(self, instance):
        return bool(instance.api_key_cifrada)

    def get_completa(self, instance):
        return instance.esta_completa()

    def update(self, instance, validated_data):
        api_key = validated_data.pop('api_key', None)
        if api_key:
            instance.api_key_cifrada = cifrar(api_key)
        return super().update(instance, validated_data)


class SerieFolioSerializer(serializers.ModelSerializer):
    serie = serializers.CharField(
        max_length=10,
        validators=[UniqueValidator(
            queryset=SerieFolio.objects.all(), message='Ya existe una serie con ese nombre.',
        )],
    )

    class Meta:
        model = SerieFolio
        fields = ['id', 'serie', 'folio_actual', 'activo']
        read_only_fields = ['id', 'activo']
