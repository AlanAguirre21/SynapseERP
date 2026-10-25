from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.permissions import EsAdmin

from . import arbol, servicio
from .models import ConversacionAsistente, MensajeAsistente

LIMITE_REGISTRO = 200


class EntradaMensajeSerializer(serializers.Serializer):
    """Exactamente uno: `texto` (escrito) o `nodo` (botón)."""

    texto = serializers.CharField(required=False, allow_blank=False, max_length=300, trim_whitespace=True)
    nodo = serializers.CharField(required=False, max_length=100)

    def validate(self, datos):
        if bool(datos.get('texto')) == bool(datos.get('nodo')):
            raise serializers.ValidationError({'detail': 'Envía una pregunta escrita o una opción, no ambas.'})
        return datos


class MensajeRegistroSerializer(serializers.ModelSerializer):
    usuario = serializers.IntegerField(source='conversacion.usuario_id', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MensajeAsistente
        fields = [
            'id', 'conversacion', 'usuario', 'usuario_nombre', 'fecha', 'entrada_tipo', 'entrada_texto',
            'nodo_solicitado', 'intencion', 'confianza', 'puntuacion', 'alternativas', 'periodo', 'periodo_desde',
            'periodo_hasta', 'nodo_respuesta', 'version_catalogo', 'respuesta_texto', 'respuesta_datos', 'modo',
        ]

    def get_usuario_nombre(self, mensaje):
        return mensaje.conversacion.usuario.nombre_mostrado()


def _cuerpo(mensaje, respuesta):
    return {
        'mensaje': mensaje.id,
        'texto': respuesta['texto'],
        'botones': respuesta['botones'],
        'enlace': respuesta['enlace'],
        'intencion': mensaje.intencion,
        'confianza': mensaje.confianza,
        'modo': respuesta['modo'],
    }


class _ConThrottle(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'asistente'


class ConversacionesView(_ConThrottle):
    """`POST /api/asistente/conversaciones/` — abre una conversación del
    usuario actual y devuelve la bienvenida con el menú de su rol."""

    def post(self, request):
        conversacion = ConversacionAsistente.objects.create(usuario=request.user)
        rol = request.user.rol_usuario
        return Response({
            'conversacion': conversacion.id,
            'texto': 'Hola, soy el asistente de SynapseERP. Pregúntame con tus palabras o elige un tema.',
            'botones': arbol.botones_menu(rol),
        }, status=201)


class MensajesView(_ConThrottle):
    """`POST /api/asistente/conversaciones/{id}/mensajes/` con `{texto}` o
    `{nodo}`. Solo el dueño de la conversación (404 para cualquier otro)."""

    def post(self, request, conversacion_id):
        conversacion = get_object_or_404(ConversacionAsistente, pk=conversacion_id, usuario=request.user)
        entrada = EntradaMensajeSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        mensaje, respuesta = servicio.procesar(
            request.user, conversacion, texto=entrada.validated_data.get('texto'),
            nodo=entrada.validated_data.get('nodo'),
        )
        return Response(_cuerpo(mensaje, respuesta), status=201)


class MenuView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'botones': arbol.botones_menu(request.user.rol_usuario)})


class RegistroView(APIView):
    """`GET /api/asistente/registro/` — registro de auditoría (solo admin),
    filtrable; `solo_dudosas=true` = confianza media o baja."""

    permission_classes = [EsAdmin]

    def get(self, request):
        params = request.query_params
        mensajes = MensajeAsistente.objects.select_related('conversacion__usuario').order_by('-fecha', '-id')
        if params.get('usuario'):
            mensajes = mensajes.filter(conversacion__usuario=params['usuario'])
        if params.get('intencion'):
            mensajes = mensajes.filter(intencion=params['intencion'])
        if params.get('confianza'):
            mensajes = mensajes.filter(confianza=params['confianza'])
        if params.get('solo_dudosas') == 'true':
            mensajes = mensajes.filter(
                entrada_tipo=MensajeAsistente.ENTRADA_TEXTO,
                confianza__in=[MensajeAsistente.CONFIANZA_MEDIA, MensajeAsistente.CONFIANZA_BAJA],
            )
        if params.get('fecha_desde'):
            mensajes = mensajes.filter(fecha__date__gte=params['fecha_desde'])
        if params.get('fecha_hasta'):
            mensajes = mensajes.filter(fecha__date__lte=params['fecha_hasta'])
        return Response(MensajeRegistroSerializer(mensajes[:LIMITE_REGISTRO], many=True).data)
