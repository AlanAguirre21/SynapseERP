import base64
import os

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.configuracion_fiscal.models import SerieFolio
from apps.ventas.models import Venta

from .models import ComplementoPago, Factura
from .serializers import ComplementoPagoSerializer, FacturaSerializer
from .services import expirar_cancelaciones_pendientes
from .services.cfdi import armar_datos_cfdi
from .services.pac_client import PACClient


def _cliente_tiene_datos_fiscales_completos(cliente):
    if cliente is None:
        return False
    datos = getattr(cliente, 'datos_fiscales', None)
    if datos is None:
        return False
    return bool(datos.rfc and datos.razon_social and datos.codigo_postal_fiscal and datos.regimen_fiscal)


def _guardar_archivo_factura(nombre, contenido_bytes):
    carpeta = os.path.join(settings.MEDIA_ROOT, 'facturas')
    os.makedirs(carpeta, exist_ok=True)
    with open(os.path.join(carpeta, nombre), 'wb') as archivo:
        archivo.write(contenido_bytes)
    return os.path.join('facturas', nombre)


class FacturaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """CRUD de facturas — `017 · Facturación`. Sin restricción de rol
    (criterio de aceptación explícito). Solo `list`/`retrieve`/`create`
    como acciones genéricas — "ninguna factura se puede editar una vez
    timbrada", así que no hay `update`/`destroy`; cancelar y descargar
    viven en acciones dedicadas.
    """

    serializer_class = FacturaSerializer
    permission_classes = [IsAuthenticated]
    queryset = Factura.objects.select_related('venta', 'venta__cliente', 'usuario').all()

    def get_queryset(self):
        expirar_cancelaciones_pendientes()
        queryset = super().get_queryset()
        params = self.request.query_params

        estado = params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        cliente_id = params.get('cliente')
        if cliente_id:
            queryset = queryset.filter(venta__cliente_id=cliente_id)

        fecha_desde = params.get('fecha_desde')
        if fecha_desde:
            queryset = queryset.filter(fecha_creacion__date__gte=fecha_desde)

        fecha_hasta = params.get('fecha_hasta')
        if fecha_hasta:
            queryset = queryset.filter(fecha_creacion__date__lte=fecha_hasta)

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venta = serializer.validated_data['venta']

        if venta.estado == Venta.ESTADO_CANCELADA:
            raise ValidationError({'detail': 'No se puede facturar una venta cancelada.'})

        if not _cliente_tiene_datos_fiscales_completos(venta.cliente):
            raise ValidationError({'detail': 'El cliente de esta venta no tiene datos fiscales completos.'})

        # Como máximo una factura vigente (no cancelada) por venta — ver
        # docstring de `Factura` sobre por qué esto no es un `OneToOneField`.
        # Una factura previa en estado `error` sí se reutiliza (reintento),
        # en vez de acumular filas fallidas por cada intento.
        factura_vigente = (
            Factura.objects.filter(venta=venta).exclude(estado=Factura.ESTADO_CANCELADA).order_by('-id').first()
        )
        if factura_vigente and factura_vigente.estado != Factura.ESTADO_ERROR:
            raise ValidationError({'detail': 'Esta venta ya tiene una factura vigente.'})

        serie_folio = SerieFolio.objects.filter(activo=True).order_by('serie').first()
        if serie_folio is None:
            raise ValidationError({'detail': 'No hay ninguna serie de facturación activa configurada.'})

        es_reintento = factura_vigente is not None
        factura = factura_vigente or Factura(venta=venta, usuario=request.user)
        factura.uso_cfdi = serializer.validated_data['uso_cfdi']
        factura.forma_pago = serializer.validated_data['forma_pago']
        factura.metodo_pago = serializer.validated_data['metodo_pago']

        datos_cfdi = armar_datos_cfdi(venta, factura, serie_folio)
        respuesta_pac = PACClient().timbrar(datos_cfdi)
        status_code = 200 if es_reintento else 201

        if not respuesta_pac.get('exito'):
            factura.estado = Factura.ESTADO_ERROR
            factura.mensaje_error = respuesta_pac.get('error') or 'El PAC rechazó el timbrado.'
            factura.save()
            return Response(self.get_serializer(factura).data, status=status_code)

        with transaction.atomic():
            serie_folio = SerieFolio.objects.select_for_update().get(pk=serie_folio.pk)
            serie_folio.folio_actual += 1
            serie_folio.save(update_fields=['folio_actual'])

            factura.folio_fiscal = respuesta_pac.get('folio_fiscal', '')
            factura.serie = serie_folio.serie
            factura.folio_interno = serie_folio.folio_actual
            factura.estado = Factura.ESTADO_TIMBRADA
            factura.mensaje_error = ''
            factura.fecha_timbrado = timezone.now()
            factura.save()

            xml_contenido = respuesta_pac.get('xml', '')
            if xml_contenido:
                factura.xml_path = _guardar_archivo_factura(f'{factura.id}.xml', xml_contenido.encode('utf-8'))

            pdf_base64 = respuesta_pac.get('pdf_base64', '')
            if pdf_base64:
                factura.pdf_path = _guardar_archivo_factura(f'{factura.id}.pdf', base64.b64decode(pdf_base64))

            factura.save(update_fields=['xml_path', 'pdf_path'])

        return Response(self.get_serializer(factura).data, status=status_code)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        factura = self.get_object()

        if factura.estado != Factura.ESTADO_TIMBRADA:
            return Response({'detail': 'Solo se puede cancelar una factura timbrada.'}, status=400)

        motivo = request.data.get('motivo_cancelacion')
        if motivo not in dict(Factura.MOTIVO_CANCELACION_CHOICES):
            return Response({'detail': 'Selecciona un motivo de cancelación válido (01 a 04).'}, status=400)

        respuesta_pac = PACClient().cancelar(factura.folio_fiscal, motivo)
        if not respuesta_pac.get('exito'):
            return Response({'detail': respuesta_pac.get('error') or 'El PAC rechazó la cancelación.'}, status=400)

        # El SAT exige respetar la ventana de 72 horas para que el receptor
        # acepte/rechace la cancelación — `pendiente_cancelacion` se
        # resuelve a `cancelada` vía `expirar_cancelaciones_pendientes()`,
        # nunca de inmediato.
        factura.estado = Factura.ESTADO_PENDIENTE_CANCELACION
        factura.motivo_cancelacion = motivo
        factura.fecha_solicitud_cancelacion = timezone.now()
        factura.save(update_fields=['estado', 'motivo_cancelacion', 'fecha_solicitud_cancelacion'])

        return Response(self.get_serializer(factura).data)

    @action(detail=True, methods=['get'], url_path='descargar-xml')
    def descargar_xml(self, request, pk=None):
        factura = self.get_object()
        return self._descargar_archivo(factura.xml_path, f'factura-{factura.id}.xml', 'application/xml')

    @action(detail=True, methods=['get'], url_path='descargar-pdf')
    def descargar_pdf(self, request, pk=None):
        factura = self.get_object()
        return self._descargar_archivo(factura.pdf_path, f'factura-{factura.id}.pdf', 'application/pdf')

    def _descargar_archivo(self, ruta_relativa, nombre_descarga, content_type):
        if not ruta_relativa:
            raise Http404('La factura todavía no tiene un archivo disponible para descargar.')

        ruta_absoluta = os.path.join(settings.MEDIA_ROOT, ruta_relativa)
        if not os.path.exists(ruta_absoluta):
            raise Http404('El archivo ya no está disponible en el servidor.')

        # `FileResponse` cierra el archivo por su cuenta al terminar de
        # transmitirlo — un `with` aquí lo cerraría antes de tiempo.
        respuesta = FileResponse(open(ruta_absoluta, 'rb'), content_type=content_type)  # noqa: SIM115
        respuesta['Content-Disposition'] = f'attachment; filename="{nombre_descarga}"'
        return respuesta


class ComplementoPagoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Complementos de Pago — solo para facturas `metodo_pago = PPD` ya
    timbradas. Sin `update`/`destroy`, mismo criterio que `Factura`.
    """

    serializer_class = ComplementoPagoSerializer
    permission_classes = [IsAuthenticated]
    queryset = ComplementoPago.objects.select_related('factura').all()

    def get_queryset(self):
        queryset = super().get_queryset()
        factura_id = self.request.query_params.get('factura')
        if factura_id:
            queryset = queryset.filter(factura_id=factura_id)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        factura = serializer.validated_data['factura']

        if factura.metodo_pago != Factura.METODO_PPD:
            raise ValidationError({'detail': 'Solo las facturas con método de pago PPD admiten complemento de pago.'})
        if factura.estado != Factura.ESTADO_TIMBRADA:
            raise ValidationError({'detail': 'Solo se puede registrar un complemento sobre una factura timbrada.'})

        datos_rep = {
            'folio_fiscal_factura': factura.folio_fiscal,
            'monto_pagado': str(serializer.validated_data['monto_pagado']),
            'fecha_pago': serializer.validated_data['fecha_pago'].isoformat(),
        }
        respuesta_pac = PACClient().timbrar_complemento_pago(datos_rep)

        if respuesta_pac.get('exito'):
            complemento = serializer.save(
                usuario=request.user, estado=ComplementoPago.ESTADO_TIMBRADO,
                folio_fiscal_rep=respuesta_pac.get('folio_fiscal', ''),
            )
        else:
            complemento = serializer.save(
                usuario=request.user, estado=ComplementoPago.ESTADO_ERROR,
                mensaje_error=respuesta_pac.get('error') or 'El PAC rechazó el timbrado del complemento.',
            )

        return Response(self.get_serializer(complemento).data, status=201)
