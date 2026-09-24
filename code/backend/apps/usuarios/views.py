from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import GenericAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from core.permissions import ROL_ADMIN, EsAdmin

from .models import Usuario
from .serializers import (
    CambiarContrasenaSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegistroAccesoSerializer,
    SolicitarRecuperacionSerializer,
    UsuarioActualSerializer,
    UsuarioPropioSerializer,
    UsuarioSerializer,
    VerificarCodigoSerializer,
)
from .throttling import ThrottleRecuperarPassword, ThrottleVerificarCodigo


class MeView(RetrieveAPIView):
    """GET/PATCH /api/usuarios/me/ — datos del usuario autenticado.

    GET ya se usaba desde la feature 001 (Header). PATCH es de la feature
    015 · Información de Usuario: usa `UsuarioPropioSerializer`, que solo
    permite tocar `username`/`email`. El objeto editado es siempre
    `request.user` — nunca se lee un `id` del cuerpo de la petición — por
    lo que un usuario no puede editar la información de otro usuario desde
    este endpoint.
    """

    serializer_class = UsuarioActualSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def patch(self, request, *args, **kwargs):
        usuario = self.get_object()
        serializer = UsuarioPropioSerializer(
            usuario, data=request.data, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UsuarioActualSerializer(usuario).data)


class LoginView(GenericAPIView):
    """POST /api/auth/login/ — credenciales -> par de tokens JWT.

    Limitado por throttling (scope 'login') para mitigar fuerza bruta.
    """

    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class LogoutView(GenericAPIView):
    """POST /api/auth/logout/ — invalida (blacklist) el refresh token
    vigente de la sesión y registra el cierre de sesión en el historial de
    accesos del usuario autenticado.
    """

    serializer_class = LogoutSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.cerrar_sesion(request.user, request.META.get('REMOTE_ADDR'))
        return Response(status=204)


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
    """CRUD de usuarios (feature 010 · Usuarios). Exclusivo de rol admin —
    a diferencia de otros ViewSets de catálogo, ni siquiera la lectura se
    abre a operador (spec: "no tiene acceso ni de lectura ni de escritura
    vía API").
    """

    queryset = Usuario.objects.select_related('empleado').all().order_by('username')
    serializer_class = UsuarioSerializer
    permission_classes = [EsAdmin]

    def _error_no_desactivable(self, instance):
        """Devuelve un mensaje de error si `instance` no puede desactivarse,
        o `None` si la desactivación es válida. Separado de `destroy()` para
        responder siempre `{"detail": "..."}", igual que el resto de la API
        (una `ValidationError` con un string plano se serializa como una
        lista, no como ese formato — ver constitución, "API errors").
        """
        if instance == self.request.user:
            return 'No puedes desactivar tu propia cuenta.'

        if instance.rol_usuario == ROL_ADMIN:
            hay_otro_admin = (
                Usuario.objects.filter(rol_usuario=ROL_ADMIN, is_active=True)
                .exclude(pk=instance.pk)
                .exists()
            )
            if not hay_otro_admin:
                return 'No puedes desactivar al único administrador activo del sistema.'

        return None

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        error = self._error_no_desactivable(instance)
        if error:
            return Response({'detail': error}, status=400)

        self.perform_destroy(instance)
        return Response(status=204)

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

    @action(detail=True, methods=['get'])
    def accesos(self, request, pk=None):
        """GET /api/usuarios/<id>/accesos/?limite=5|10|todos — historial de
        accesos del usuario, más reciente primero (orden ya definido en
        `RegistroAcceso.Meta.ordering`). `limite=5`/`10` recorta el
        queryset directamente; `limite=todos` pagina (única acción de esta
        API que lo hace — el proyecto no define paginación global, ver
        `plan.md`), porque es una tabla insert-only que crece sin límite.
        """
        usuario = self.get_object()
        queryset = usuario.registros_acceso.all()
        limite = request.query_params.get('limite', '5')

        if limite == 'todos':
            paginador = PageNumberPagination()
            paginador.page_size = 20
            pagina = paginador.paginate_queryset(queryset, request, view=self)
            return paginador.get_paginated_response(RegistroAccesoSerializer(pagina, many=True).data)

        cantidad = 10 if limite == '10' else 5
        return Response(RegistroAccesoSerializer(queryset[:cantidad], many=True).data)
