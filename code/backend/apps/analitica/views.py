from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import EsAdmin

from . import services
from .models import GeneracionPronostico, Pronostico, PuntoPronostico
from .serializers import (
    DemandaEntradaSerializer,
    DemandaSerializer,
    GeneracionPronosticoSerializer,
    GenerarPronosticoSerializer,
    PronosticoSerializer,
    ProyeccionDashboardSerializer,
    ProyeccionEntradaSerializer,
    VistaEntradaSerializer,
    VistaPronosticoSerializer,
)

# Todo `023` es exclusivo del admin, incluso las vistas vinculadas dentro de
# módulos que el operador sí ve (Ventas, Compras, Producción, Terceros).


class GeneracionPronosticoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GeneracionPronosticoSerializer
    permission_classes = [EsAdmin]
    queryset = GeneracionPronostico.objects.select_related('iniciada_por').all()

    def get_queryset(self):
        queryset = super().get_queryset()
        horizonte = self.request.query_params.get('horizonte')
        if horizonte:
            queryset = queryset.filter(horizonte=horizonte)
        return queryset

    @action(detail=False, methods=['post'])
    def generar(self, request):
        """Sin `horizonte`: los tres estándar. Síncrono — el volumen de una
        empresa pequeña lo permite sin cola de tareas."""

        entrada = GenerarPronosticoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        try:
            if 'horizonte' not in datos:
                generaciones = services.generar_estandar(GeneracionPronostico.ORIGEN_MANUAL, usuario=request.user)
            else:
                generaciones = [services.generar(
                    datos['horizonte'], GeneracionPronostico.ORIGEN_MANUAL, usuario=request.user,
                    desde=datos.get('desde'), hasta=datos.get('hasta'), granularidad=datos.get('granularidad'),
                )]
        except services.RangoInvalido as exc:
            raise ValidationError({'detail': str(exc)}) from exc
        return Response(self.get_serializer(generaciones, many=True).data, status=201)


class PronosticoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PronosticoSerializer
    permission_classes = [EsAdmin]
    queryset = Pronostico.objects.select_related('producto', 'categoria', 'generacion').prefetch_related(
        Prefetch('puntos', queryset=PuntoPronostico.objects.order_by('periodo_inicio')),
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        generacion = params.get('generacion')
        if not generacion and params.get('vigente') == 'true':
            vigente = services.generacion_vigente(params.get('horizonte', GeneracionPronostico.HORIZONTE_SEMANAS_4))
            generacion = vigente.pk if vigente else 0
        if generacion is not None and generacion != '':
            queryset = queryset.filter(generacion=generacion)
        elif params.get('horizonte'):
            queryset = queryset.filter(generacion__horizonte=params['horizonte'])

        for campo in ('metrica', 'producto', 'categoria', 'estado'):
            valor = params.get(campo)
            if valor:
                queryset = queryset.filter(**{campo: valor})
        return queryset


class VistaPronosticoView(APIView):
    """Historial reciente + pronóstico vigente (o el de `generacion`) +
    precisión real de la última generación ya evaluable, en una respuesta."""

    permission_classes = [EsAdmin]

    def get(self, request):
        entrada = VistaEntradaSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        metrica, horizonte = datos['metrica'], datos['horizonte']
        producto, categoria = datos.get('producto'), datos.get('categoria')

        if datos.get('generacion'):
            generacion = GeneracionPronostico.objects.filter(pk=datos['generacion']).first()
        else:
            generacion = services.generacion_vigente(horizonte)

        pronostico = None
        if generacion is not None:
            pronostico = services.pronostico_vigente(
                metrica, horizonte, producto=producto, categoria=categoria, generacion=generacion,
            )

        granularidad = generacion.granularidad if generacion else services.HORIZONTES_ESTANDAR.get(
            horizonte, (GeneracionPronostico.GRANULARIDAD_SEMANA, 4),
        )[0]
        periodos = pronostico.puntos.count() if pronostico and pronostico.estado == Pronostico.ESTADO_GENERADO else 4
        respuesta = {
            'generacion': generacion,
            'pronostico': pronostico,
            'historial': services.historial_reciente(metrica, granularidad, periodos * 3, producto, categoria),
            'precision_real': services.ultima_precision(metrica, generacion.horizonte if generacion else horizonte,
                                                        producto, categoria),
        }
        return Response(VistaPronosticoSerializer(respuesta).data)


class ProyeccionDashboardView(APIView):
    permission_classes = [EsAdmin]

    def get(self, request):
        entrada = ProyeccionEntradaSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        datos = services.proyeccion_dashboard(entrada.validated_data['periodo'])
        return Response(ProyeccionDashboardSerializer(datos).data)


class DemandaView(APIView):
    permission_classes = [EsAdmin]

    def get(self, request):
        entrada = DemandaEntradaSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        datos = services.demanda_pronosticada(
            entrada.validated_data['horizonte'], entrada.validated_data.get('limite'),
            entrada.validated_data.get('generacion'),
        )
        return Response(DemandaSerializer(datos).data)
