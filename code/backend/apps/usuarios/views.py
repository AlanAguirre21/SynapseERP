from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import GenericAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from core.permissions import LecturaParaTodosEscrituraSoloAdmin

from .models import Usuario
from .serializers import (
    CambiarContrasenaSerializer,
    LoginSerializer,
    SolicitarRecuperacionSerializer,
    UsuarioActualSerializer,
    UsuarioSerializer,
    VerificarCodigoSerializer,
)
from .throttling import ThrottleRecuperarPassword, ThrottleVerificarCodigo


class MeView(RetrieveAPIView):
    serializer_class = UsuarioActualSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class LoginView(GenericAPIView):
    """POST /api/auth/login/ — credenciales -> par de tokens JWT.

    Limitado por throttling (scope 'login') para mitigar fuerza bruta.
    """

    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


MENSAJE_RECUPERACION_ENVIADA = 'Si el correo está registrado, te enviamos un código de verificación.'


class SolicitarRecuperacionView(GenericAPIView):
    """POST /api/auth/recuperar/ — genera y envía un código de 6 dígitos.

    Responde siempre el mismo mensaje, exista o no el correo. También sirve
    para "reenviar", ya que cada llamada invalida el código anterior.
    """

    serializer_class = SolicitarRecuperacionSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ThrottleRecuperarPassword]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.guardar()
        return Response({'detail': MENSAJE_RECUPERACION_ENVIADA})


class VerificarCodigoView(GenericAPIView):
    """POST /api/auth/verificar-codigo/ — valida el código de 6 dígitos."""

    serializer_class = VerificarCodigoSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ThrottleVerificarCodigo]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.guardar()
        return Response({'detail': 'Código verificado correctamente.'})


class CambiarContrasenaView(GenericAPIView):
    """POST /api/auth/cambiar-contrasena/ — cierra el flujo de recuperación.

    Exige un código ya verificado y vigente (feature 004); al guardar la
    nueva contraseña, invalida ese código de forma permanente e inicia
    sesión automáticamente (par de tokens de la sesión normal).
    """

    serializer_class = CambiarContrasenaSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.guardar())


class UsuarioViewSet(viewsets.ModelViewSet):
    """CRUD de usuarios (feature 008 · Personas). Lectura para cualquier
    usuario autenticado, escritura (crear/editar/desactivar/reactivar)
    solo para rol admin.
    """

    queryset = Usuario.objects.select_related('empleado').all().order_by('username')
    serializer_class = UsuarioSerializer
    permission_classes = [LecturaParaTodosEscrituraSoloAdmin]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        usuario = self.get_object()

        if usuario.is_active:
            return Response({'detail': 'El usuario ya está activo.'}, status=400)

        usuario.is_active = True
        usuario.save(update_fields=['is_active'])

        return Response(self.get_serializer(usuario).data)
