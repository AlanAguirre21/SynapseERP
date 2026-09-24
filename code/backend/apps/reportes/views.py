from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    ClienteTopSerializer,
    MovimientoCajaReporteSerializer,
    ProductoTopSerializer,
    ResumenComprasSerializer,
    ResumenDashboardSerializer,
    ResumenVentasSerializer,
)
from .services import (
    LIMITE_10,
    LIMITES_VALIDOS,
    ORDEN_MAS,
    ORDENES_VALIDOS,
    PERIODO_DIA,
    PERIODOS_VALIDOS,
    calcular_resumen,
    calcular_resumen_compras,
    calcular_resumen_ventas,
    calcular_top_clientes,
    calcular_top_productos,
    obtener_movimientos_caja,
)


def _validar_periodo(request):
    periodo = request.query_params.get('periodo', PERIODO_DIA)
    if periodo not in PERIODOS_VALIDOS:
        raise ValidationError({'periodo': f'Debe ser uno de: {", ".join(PERIODOS_VALIDOS)}.'})
    return periodo


def _validar_orden(request):
    orden = request.query_params.get('orden', ORDEN_MAS)
    if orden not in ORDENES_VALIDOS:
        raise ValidationError({'orden': f'Debe ser uno de: {", ".join(ORDENES_VALIDOS)}.'})
    return orden


class ResumenDashboardView(APIView):
    """GET /api/reportes/resumen/?periodo=dia|semana|mes|año — feature
    014 · Dashboard. Abierta a cualquier usuario autenticado, sin
    restricción de rol (pantalla de entrada general del sistema).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        resumen = calcular_resumen(periodo)
        return Response(ResumenDashboardSerializer(resumen).data)


class ResumenVentasView(APIView):
    """GET /api/reportes/ventas/?periodo= — desglose para la sección
    'Resumen de ventas' del Dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        resumen = calcular_resumen_ventas(periodo)
        return Response(ResumenVentasSerializer(resumen).data)


class ResumenComprasView(APIView):
    """GET /api/reportes/compras/?periodo= — desglose para la sección
    'Resumen de compras' del Dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        resumen = calcular_resumen_compras(periodo)
        return Response(ResumenComprasSerializer(resumen).data)


class ProductosTopView(APIView):
    """GET /api/reportes/productos-top/?periodo=&orden=mas|menos."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        orden = _validar_orden(request)
        resultados = calcular_top_productos(periodo, orden)
        return Response(ProductoTopSerializer(resultados, many=True).data)


class ClientesTopView(APIView):
    """GET /api/reportes/clientes-top/?periodo=&orden=mas|menos."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        orden = _validar_orden(request)
        resultados = calcular_top_clientes(periodo, orden)
        return Response(ClienteTopSerializer(resultados, many=True).data)


class MovimientosCajaReporteView(APIView):
    """GET /api/reportes/movimientos-caja/?periodo=&limite=5|10|todos.

    Distinto del endpoint admin-only de `013 · Caja`: expone únicamente
    fecha/tipo/observación (nunca monto ni saldo_resultante), visible a
    cualquier usuario autenticado, para la lista de "Movimientos
    financieros del periodo" del Dashboard.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        limite = request.query_params.get('limite', LIMITE_10)
        if limite not in LIMITES_VALIDOS:
            raise ValidationError({'limite': f'Debe ser uno de: {", ".join(LIMITES_VALIDOS)}.'})

        movimientos = obtener_movimientos_caja(periodo, limite)
        return Response(MovimientoCajaReporteSerializer(movimientos, many=True).data)
