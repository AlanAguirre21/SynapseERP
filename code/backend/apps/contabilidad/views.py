import csv
from decimal import Decimal

from django.db.models import Q, Sum
from django.http import HttpResponse
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import EsAdmin

from .constants import CODIGOS_CUENTAS_SISTEMA
from .models import AsientoContable, CuentaContable, MovimientoContable
from .serializers import AsientoContableSerializer, CuentaContableSerializer


class CuentaContableViewSet(viewsets.ModelViewSet):
    """CRUD del catálogo de cuentas contables — feature `018 ·
    Contabilidad`. Restringido en su totalidad a rol admin, igual que
    `016 · Configuración Fiscal`, por ser configuración sensible del
    negocio. `perform_destroy` nunca borra físicamente — mismo patrón
    reutilizable de `activo` que el resto del proyecto — y además
    bloquea desactivar una de las cuentas que `generador_asientos.py`
    referencia en tiempo de ejecución.
    """

    queryset = CuentaContable.objects.select_related('cuenta_padre').all()
    serializer_class = CuentaContableSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        return queryset

    def perform_destroy(self, instance):
        if instance.codigo in CODIGOS_CUENTAS_SISTEMA:
            raise ValidationError({
                'detail': (
                    'Esta cuenta es usada por la generación automática de asientos contables '
                    '(ventas, compras o caja) y no se puede desactivar.'
                ),
            })
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        cuenta = self.get_object()

        if cuenta.activo:
            return Response({'detail': 'La cuenta ya está activa.'}, status=400)

        cuenta.activo = True
        cuenta.save(update_fields=['activo'])

        return Response(self.get_serializer(cuenta).data)


def _queryset_asientos(params):
    queryset = (
        AsientoContable.objects.select_related('usuario')
        .prefetch_related('movimientos__cuenta_contable')
        .all()
    )

    tipo_origen = params.get('tipo_origen')
    if tipo_origen:
        queryset = queryset.filter(tipo_origen=tipo_origen)

    cuenta_id = params.get('cuenta')
    if cuenta_id:
        queryset = queryset.filter(movimientos__cuenta_contable_id=cuenta_id).distinct()

    fecha_desde = params.get('fecha_desde')
    if fecha_desde:
        queryset = queryset.filter(fecha__date__gte=fecha_desde)

    fecha_hasta = params.get('fecha_hasta')
    if fecha_hasta:
        queryset = queryset.filter(fecha__date__lte=fecha_hasta)

    return queryset


class AsientoContableViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Libro diario — solo lectura, exclusivo de admin. Ningún asiento se
    crea/edita/borra desde aquí, solo desde `generador_asientos.py`.
    """

    serializer_class = AsientoContableSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        return _queryset_asientos(self.request.query_params)


def _calcular_balance(params):
    """Balance de comprobación: para cada cuenta activa, suma de cargos,
    suma de abonos, y saldo (cargos − abonos; positivo = saldo deudor,
    negativo = saldo acreedor) — filtrable por rango de fecha del asiento.
    """

    movimientos = MovimientoContable.objects.all()

    fecha_desde = params.get('fecha_desde')
    if fecha_desde:
        movimientos = movimientos.filter(asiento__fecha__date__gte=fecha_desde)

    fecha_hasta = params.get('fecha_hasta')
    if fecha_hasta:
        movimientos = movimientos.filter(asiento__fecha__date__lte=fecha_hasta)

    filas = []
    for cuenta in CuentaContable.objects.filter(activo=True).order_by('codigo'):
        agregados = movimientos.filter(cuenta_contable=cuenta).aggregate(
            total_cargos=Sum('monto', filter=Q(tipo_movimiento=MovimientoContable.CARGO)),
            total_abonos=Sum('monto', filter=Q(tipo_movimiento=MovimientoContable.ABONO)),
        )
        total_cargos = agregados['total_cargos'] or Decimal('0.00')
        total_abonos = agregados['total_abonos'] or Decimal('0.00')
        filas.append({
            'cuenta': cuenta.id, 'codigo': cuenta.codigo, 'nombre': cuenta.nombre, 'tipo': cuenta.tipo,
            'total_cargos': total_cargos, 'total_abonos': total_abonos, 'saldo': total_cargos - total_abonos,
        })

    return filas


class BalanceComprobacionView(APIView):
    permission_classes = [EsAdmin]

    def get(self, request):
        return Response(_calcular_balance(request.query_params))


class ExportarContabilidadView(APIView):
    """`GET /api/contabilidad/exportar/?tipo=libro_diario|balance&formato=csv`
    — genera el libro diario o el balance de comprobación como CSV
    descargable, respetando los mismos filtros de fecha/cuenta/origen que
    sus vistas de solo lectura equivalentes.
    """

    permission_classes = [EsAdmin]

    def get(self, request):
        formato = request.query_params.get('formato', 'csv')
        if formato != 'csv':
            return Response({'detail': 'Formato de exportación no soportado — solo "csv".'}, status=400)

        tipo = request.query_params.get('tipo', 'libro_diario')
        if tipo == 'balance':
            return self._exportar_balance(request)
        if tipo == 'libro_diario':
            return self._exportar_libro_diario(request)
        return Response({'detail': 'Tipo de exportación no soportado — usa "libro_diario" o "balance".'}, status=400)

    def _exportar_libro_diario(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="libro-diario.csv"'

        writer = csv.writer(response)
        writer.writerow(['Asiento', 'Fecha', 'Concepto', 'Origen', 'Cuenta', 'Tipo de movimiento', 'Monto'])
        for asiento in _queryset_asientos(request.query_params):
            for movimiento in asiento.movimientos.all():
                writer.writerow([
                    asiento.id, asiento.fecha.isoformat(), asiento.concepto, asiento.tipo_origen,
                    f'{movimiento.cuenta_contable.codigo} — {movimiento.cuenta_contable.nombre}',
                    movimiento.tipo_movimiento, movimiento.monto,
                ])

        return response

    def _exportar_balance(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="balance-comprobacion.csv"'

        writer = csv.writer(response)
        writer.writerow(['Código', 'Cuenta', 'Tipo', 'Total cargos', 'Total abonos', 'Saldo'])
        for fila in _calcular_balance(request.query_params):
            writer.writerow([
                fila['codigo'], fila['nombre'], fila['tipo'], fila['total_cargos'], fila['total_abonos'], fila['saldo'],
            ])

        return response
