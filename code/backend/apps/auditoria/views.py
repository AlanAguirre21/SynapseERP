import io

from django.db.models import Prefetch
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from xhtml2pdf import pisa

from core.pdf import resolver_ruta_estatica
from core.permissions import EsAdmin

from . import services
from .models import (
    ConteoFisico,
    CorteCaja,
    DetalleConteoFisico,
    DiscrepanciaAuditoria,
    EjecucionAuditoria,
)
from .serializers import (
    ConteoFisicoCrearSerializer,
    ConteoFisicoSerializer,
    CorteCajaSerializer,
    DiscrepanciaAuditoriaSerializer,
    EjecucionAuditoriaSerializer,
    EjecutarAuditoriaSerializer,
    ResolverDiscrepanciaSerializer,
    ResumenAuditoriaSerializer,
)


class CorteCajaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                       viewsets.GenericViewSet):
    """Cortes de caja — `022`. Admin-only (Caja ya lo es). Sin `Update`/
    `DestroyModelMixin`: un corte erróneo se corrige con uno que lo reemplaza."""

    serializer_class = CorteCajaSerializer
    permission_classes = [EsAdmin]
    queryset = CorteCaja.objects.select_related('usuario', 'reemplazado_por').all()

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class ConteoFisicoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                          viewsets.GenericViewSet):
    """Conteos físicos — `022`. Cualquier autenticado los captura y consulta
    (el operador sin ver el stock teórico); solo el admin los descarta."""

    permission_classes = [IsAuthenticated]
    queryset = ConteoFisico.objects.select_related('sucursal', 'usuario').prefetch_related(
        Prefetch('detalles', queryset=DetalleConteoFisico.objects.order_by('id')),
    )

    def get_serializer_class(self):
        return ConteoFisicoCrearSerializer if self.action == 'create' else ConteoFisicoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        sucursal = self.request.query_params.get('sucursal')
        if sucursal:
            queryset = queryset.filter(sucursal=sucursal)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conteo = serializer.save()
        return Response(ConteoFisicoSerializer(conteo, context=self.get_serializer_context()).data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[EsAdmin])
    def descartar(self, request, pk=None):
        conteo = self.get_object()
        if conteo.ejecucion_id:
            raise ValidationError({'detail': 'Este conteo ya se auditó; no se puede descartar.'})
        if conteo.descartado:
            raise ValidationError({'detail': 'Este conteo ya estaba descartado.'})
        conteo.descartado = True
        conteo.descartado_por = request.user
        conteo.fecha_descarte = timezone.now()
        conteo.save(update_fields=['descartado', 'descartado_por', 'fecha_descarte'])
        return Response(ConteoFisicoSerializer(conteo, context=self.get_serializer_context()).data)


class EjecucionAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """Historial de ejecuciones (admin) + "Ejecutar ahora" + reporte en PDF."""

    serializer_class = EjecucionAuditoriaSerializer
    permission_classes = [EsAdmin]
    queryset = EjecucionAuditoria.objects.select_related('iniciada_por').all()

    def get_queryset(self):
        queryset = super().get_queryset()
        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        return queryset

    @action(detail=False, methods=['post'])
    def ejecutar(self, request):
        entrada = EjecutarAuditoriaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        ejecucion = services.ejecutar_auditoria(
            entrada.validated_data['tipo'], EjecucionAuditoria.ORIGEN_MANUAL, usuario=request.user,
        )
        return Response(self.get_serializer(ejecucion).data, status=201)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        ejecucion = self.get_object()
        discrepancias = ejecucion.discrepancias.select_related('sucursal').order_by('id')
        html = render_to_string('auditoria/reporte_ejecucion.html', {
            'ejecucion': ejecucion,
            'discrepancias': [
                {'discrepancia': d, 'item_nombre': services.nombre_item(d.tipo_item, d.item_id) if d.item_id else ''}
                for d in discrepancias
            ],
            'generado': timezone.localtime(),
        })

        buffer = io.BytesIO()
        resultado = pisa.CreatePDF(html, dest=buffer, link_callback=resolver_ruta_estatica)
        if resultado.err:
            return Response({'detail': 'No se pudo generar el reporte en PDF.'}, status=500)

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="auditoria-{ejecucion.id}.pdf"'
        return response


class DiscrepanciaAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """Discrepancias (admin), filtrables, con ajustar/justificar."""

    serializer_class = DiscrepanciaAuditoriaSerializer
    permission_classes = [EsAdmin]
    queryset = DiscrepanciaAuditoria.objects.select_related('ejecucion', 'sucursal', 'resuelta_por').all()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        tipo = params.get('tipo')
        if tipo == EjecucionAuditoria.TIPO_CAJA:
            queryset = queryset.filter(categoria__in=DiscrepanciaAuditoria.CATEGORIAS_CAJA)
        elif tipo == EjecucionAuditoria.TIPO_INVENTARIO:
            queryset = queryset.filter(categoria__in=DiscrepanciaAuditoria.CATEGORIAS_INVENTARIO)

        for campo in ('categoria', 'estado', 'sucursal', 'ejecucion'):
            valor = params.get(campo)
            if valor:
                queryset = queryset.filter(**{campo: valor})

        fecha_desde = params.get('fecha_desde')
        if fecha_desde:
            queryset = queryset.filter(ejecucion__fecha_inicio__date__gte=fecha_desde)
        fecha_hasta = params.get('fecha_hasta')
        if fecha_hasta:
            queryset = queryset.filter(ejecucion__fecha_inicio__date__lte=fecha_hasta)

        return queryset

    def _resolver(self, request, funcion, **kwargs):
        discrepancia = self.get_object()
        entrada = ResolverDiscrepanciaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        resuelta = funcion(discrepancia.pk, request.user, entrada.validated_data['comentario'], **kwargs)
        return Response(self.get_serializer(resuelta).data)

    @action(detail=True, methods=['post'])
    def ajustar(self, request, pk=None):
        return self._resolver(request, services.ajustar_discrepancia)

    @action(detail=True, methods=['post'])
    def justificar(self, request, pk=None):
        return self._resolver(request, services.justificar_discrepancia)


class ResumenAuditoriaView(APIView):
    """Alimenta las vistas vinculadas de Caja, Inventario, Header y Dashboard."""

    permission_classes = [EsAdmin]

    def get(self, request):
        return Response(ResumenAuditoriaSerializer(services.resumen()).data)
