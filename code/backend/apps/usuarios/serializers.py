import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from core.modules import modulos_para_rol

from .models import CodigoRecuperacion

Usuario = get_user_model()

VIGENCIA_CODIGO_MINUTOS = 10


class UsuarioSerializer(serializers.ModelSerializer):
    """CRUD administrativo de usuarios (feature 008 · Personas).

    `password` es `write_only` y solo se usa en creación — nunca se expone
    en una respuesta de lectura, y `update()` la descarta explícitamente
    aunque llegue en el payload (editar contraseña vive en el flujo de
    recuperación de `004`/`005`, no aquí). `activo` expone `is_active`
    (ver nota en `Usuario`) como campo de solo lectura, para que el
    frontend use el mismo patrón `activo`/`reactivar` que el resto de las
    entidades — el cambio real ocurre en `UsuarioViewSet.perform_destroy`/
    `reactivar`, no a través de este serializer.
    """

    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    activo = serializers.BooleanField(source='is_active', read_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email', 'rol_usuario',
            'empleado', 'activo', 'password',
        ]
        read_only_fields = ['id']
        extra_kwargs = {'username': {'required': False}}

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': ['La contraseña es obligatoria al crear un usuario.']})

        validated_data.setdefault('username', validated_data['email'])
        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        return usuario

    def update(self, instance, validated_data):
        validated_data.pop('password', None)
        return super().update(instance, validated_data)


class UsuarioActualSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.SerializerMethodField()
    rol = serializers.CharField(source='rol_usuario')
    modulos = serializers.SerializerMethodField()

    def get_nombre(self, usuario):
        return usuario.nombre_mostrado()

    def get_modulos(self, usuario):
        return modulos_para_rol(usuario.rol_usuario)


class LoginSerializer(serializers.Serializer):
    """Valida credenciales y emite el par de tokens JWT.

    No reutiliza `authenticate()`/`TokenObtainPairSerializer` porque ambos
    fallan de forma indistinguible ante contraseña incorrecta o cuenta
    inactiva; el criterio de aceptación exige mensajes distintos para cada
    caso (genérico para credenciales, específico para cuenta inactiva).
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        usuario = Usuario.objects.filter(email=attrs['email']).first()

        if usuario is None or not usuario.check_password(attrs['password']):
            raise AuthenticationFailed('Correo o contraseña incorrectos.')

        if not usuario.is_active:
            raise AuthenticationFailed('Tu cuenta está inactiva. Contacta a un administrador.')

        refresh = RefreshToken.for_user(usuario)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class SolicitarRecuperacionSerializer(serializers.Serializer):
    """Genera y envía un código nuevo; la vista siempre responde el mismo
    mensaje de éxito, exista o no el correo, para no permitir enumeración
    de usuarios registrados.
    """

    email = serializers.EmailField()

    def guardar(self):
        email = self.validated_data['email']
        usuario = Usuario.objects.filter(email=email, is_active=True).first()

        if usuario is None:
            return

        CodigoRecuperacion.objects.filter(usuario=usuario, usado=False).update(usado=True)

        codigo = f'{secrets.randbelow(1_000_000):06d}'
        CodigoRecuperacion.objects.create(
            usuario=usuario,
            codigo=codigo,
            expira_en=timezone.now() + timedelta(minutes=VIGENCIA_CODIGO_MINUTOS),
        )

        send_mail(
            subject='Código de recuperación de contraseña — FleboSil',
            message=(
                f'Tu código de recuperación es: {codigo}\n'
                f'Vence en {VIGENCIA_CODIGO_MINUTOS} minutos. '
                'Si no solicitaste este código, ignora este correo.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )


class VerificarCodigoSerializer(serializers.Serializer):
    email = serializers.EmailField()
    codigo = serializers.CharField(min_length=6, max_length=6)

    def validate(self, attrs):
        registro = (
            CodigoRecuperacion.objects.filter(
                usuario__email=attrs['email'], codigo=attrs['codigo'], usado=False,
            )
            .order_by('-creado_en')
            .first()
        )

        if registro is None or not registro.vigente():
            raise AuthenticationFailed('Código inválido o expirado.')

        attrs['registro'] = registro
        return attrs

    def guardar(self):
        registro = self.validated_data['registro']
        registro.verificado = True
        registro.save(update_fields=['verificado'])


class CambiarContrasenaSerializer(serializers.Serializer):
    """Último paso del flujo de recuperación: exige que exista, para ese
    correo, un `CodigoRecuperacion` ya verificado (feature 004), no usado y
    vigente — nunca confía en que el frontend controló la navegación, el
    backend vuelve a comprobar la prueba de identidad.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirmacion = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirmacion']:
            raise serializers.ValidationError(
                {'password_confirmacion': 'Las contraseñas no coinciden.'},
            )

        registro = (
            CodigoRecuperacion.objects.filter(
                usuario__email=attrs['email'], verificado=True, usado=False,
            )
            .order_by('-creado_en')
            .first()
        )

        if registro is None or not registro.vigente():
            raise AuthenticationFailed(
                'Tu sesión de recuperación expiró o no es válida. Solicita un nuevo código.',
            )

        usuario = registro.usuario

        if usuario.check_password(attrs['password']):
            raise serializers.ValidationError(
                {'password': ['La nueva contraseña no puede ser igual a la anterior.']},
            )

        try:
            validate_password(attrs['password'], user=usuario)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)}) from exc

        attrs['usuario'] = usuario
        attrs['registro'] = registro
        return attrs

    def guardar(self):
        usuario = self.validated_data['usuario']
        registro = self.validated_data['registro']

        with transaction.atomic():
            usuario.set_password(self.validated_data['password'])
            usuario.save(update_fields=['password'])
            registro.usado = True
            registro.save(update_fields=['usado'])

        refresh = RefreshToken.for_user(usuario)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }
