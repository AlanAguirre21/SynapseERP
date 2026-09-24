import secrets
from datetime import timedelta
from email.message import MIMEPart
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.modules import modulos_para_rol
from core.permissions import ROL_ADMIN, ROL_OPERADOR

from .models import CodigoRecuperacion, RegistroAcceso

Usuario = get_user_model()

VIGENCIA_CODIGO_MINUTOS = 10

RUTA_LOGO_CORREO = Path(__file__).resolve().parent / 'static' / 'usuarios' / 'logo_flebosil.png'


def _mensaje_recuperacion(email: str, codigo: str) -> EmailMultiAlternatives:
    """Arma el correo de recuperación con parte texto plano + HTML con marca.

    El logo va embebido como adjunto con Content-ID (`cid:logo_flebosil`) en
    vez de referenciarse por URL pública — el backend todavía no está
    desplegado en un dominio accesible, y varios clientes de correo bloquean
    por defecto imágenes cargadas desde URLs externas.
    """
    texto_plano = (
        f'Tu código de recuperación es: {codigo}\n'
        f'Vence en {VIGENCIA_CODIGO_MINUTOS} minutos. '
        'Si no solicitaste este código, ignora este correo.'
    )
    html = render_to_string('usuarios/email_recuperacion.html', {
        'codigo': codigo,
        'vigencia_minutos': VIGENCIA_CODIGO_MINUTOS,
    })

    mensaje = EmailMultiAlternatives(
        subject='Código de recuperación de contraseña — FleboSil',
        body=texto_plano,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    mensaje.attach_alternative(html, 'text/html')

    with open(RUTA_LOGO_CORREO, 'rb') as archivo_logo:
        datos_logo = archivo_logo.read()
    logo = MIMEPart()
    logo.set_content(
        datos_logo, maintype='image', subtype='png',
        disposition='inline', filename='logo_flebosil.png', cid='<logo_flebosil>',
    )
    mensaje.attach(logo)

    return mensaje


class UsuarioSerializer(serializers.ModelSerializer):
    """CRUD administrativo de usuarios (feature 010 · Usuarios).

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
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    nombre = serializers.SerializerMethodField()
    rol = serializers.CharField(source='rol_usuario')
    modulos = serializers.SerializerMethodField()

    def get_nombre(self, usuario):
        return usuario.nombre_mostrado()

    def get_modulos(self, usuario):
        return modulos_para_rol(usuario.rol_usuario)


class UsuarioPropioSerializer(serializers.ModelSerializer):
    """Edición de la propia cuenta (feature 015 · Información de Usuario).

    Distinto de `UsuarioSerializer` (CRUD administrativo de `008`): expone
    `username`/`email`/`first_name`/`last_name` como campos editables.
    `activo` (is_active) ni siquiera es parte de este serializer, así que
    no hay forma de que se filtre por error futuro de mantenimiento, aunque
    llegue en el payload de la petición. `rol_usuario` solo se agrega como
    campo editable en `__init__` cuando quien edita ya es `admin` — ver
    "Actualización: nombre completo y cambio de rol propio" en `spec.md`;
    un `operador` que lo envíe manipulando la petición no tiene ese campo
    en el serializer, así que se ignora igual que antes. La vista (`MeView`)
    siempre pasa `request.user` como instancia — nunca un usuario elegido
    por un `id` del cuerpo de la petición — por lo que la validación de
    unicidad de `username`/`email` que agrega `ModelSerializer`
    automáticamente ya excluye al propio usuario de la comparación.
    """

    username = serializers.CharField(
        validators=[UniqueValidator(
            queryset=Usuario.objects.all(), message='Ya existe un usuario con ese nombre de usuario.',
        )],
    )
    email = serializers.EmailField(
        validators=[UniqueValidator(
            queryset=Usuario.objects.all(), message='Ya existe un usuario con ese correo electrónico.',
        )],
    )
    first_name = serializers.CharField(required=True, allow_blank=False)
    last_name = serializers.CharField(required=True, allow_blank=False)
    rol_usuario = serializers.ChoiceField(choices=[(ROL_ADMIN, 'Administrador'), (ROL_OPERADOR, 'Operador')])

    class Meta:
        model = Usuario
        fields = ['username', 'email', 'first_name', 'last_name', 'rol_usuario']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if not (request and request.user.rol_usuario == ROL_ADMIN):
            self.fields.pop('rol_usuario', None)

    def validate_rol_usuario(self, value):
        # Solo importa el caso admin -> operador: es el único que puede
        # dejar al sistema sin ningún admin activo.
        if self.instance.rol_usuario == ROL_ADMIN and value == ROL_OPERADOR:
            hay_otro_admin = (
                Usuario.objects.filter(rol_usuario=ROL_ADMIN, is_active=True)
                .exclude(pk=self.instance.pk)
                .exists()
            )
            if not hay_otro_admin:
                raise serializers.ValidationError(
                    'No puedes cambiar tu rol a operador: eres el único administrador activo del sistema.',
                )
        return value


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
        request = self.context.get('request')
        ip = request.META.get('REMOTE_ADDR') if request else None
        usuario = Usuario.objects.filter(email=attrs['email']).first()

        if usuario is None:
            # Correo inexistente: se registra por trazabilidad (posible
            # escaneo de correos), pero sin vínculo a ningún `Usuario` — por
            # eso no aparece en el historial de accesos de nadie (ver nota
            # en `RegistroAcceso` y "Fuera de alcance" del spec).
            RegistroAcceso.objects.create(tipo='fallido', email_intentado=attrs['email'], ip=ip)
            raise AuthenticationFailed('Correo o contraseña incorrectos.')

        if not usuario.check_password(attrs['password']):
            # Contraseña incorrecta contra un correo que sí existe: se
            # vincula a ese `Usuario` (a diferencia del caso anterior) para
            # que aparezca en su propio historial de accesos — es la señal
            # que permite detectar fuerza bruta contra una cuenta real.
            RegistroAcceso.objects.create(usuario=usuario, tipo='fallido', ip=ip)
            raise AuthenticationFailed('Correo o contraseña incorrectos.')

        if not usuario.is_active:
            RegistroAcceso.objects.create(usuario=usuario, tipo='fallido', ip=ip)
            raise AuthenticationFailed('Tu cuenta está inactiva. Contacta a un administrador.')

        RegistroAcceso.objects.create(usuario=usuario, tipo='exitoso', ip=ip)

        refresh = RefreshToken.for_user(usuario)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class LogoutSerializer(serializers.Serializer):
    """`refresh` es opcional: si no llega (ej. ya se perdió del storage del
    cliente), igual se registra el cierre de sesión — el logout nunca debe
    fallar por un token ausente o ya inválido/expirado.
    """

    refresh = serializers.CharField(required=False, allow_blank=True)

    def cerrar_sesion(self, usuario, ip):
        refresh_token = self.validated_data.get('refresh')
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        RegistroAcceso.objects.create(usuario=usuario, tipo='cierre_sesion', ip=ip)


class RegistroAccesoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroAcceso
        fields = ['id', 'tipo', 'ip', 'creado_en']


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

        _mensaje_recuperacion(email, codigo).send()


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
