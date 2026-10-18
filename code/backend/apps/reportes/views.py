from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import ROL_ADMIN, EsAdmin

from .serializers import (
    ClienteTopOperadorSerializer,
    ClienteTopSerializer,
    MovimientoCajaReporteSerializer,
    ProductoTopSerializer,
    ResumenComprasSerializer,
    ResumenDashboardOperadorSerializer,
    ResumenDashboardSerializer,
    ResumenFacturacionSerializer,
    ResumenVentasSerializer,
)
from .services import (
    LIMITE_10,
    LIMITES_VALIDOS,
    ORDEN_MAS,
    ORDENES_VALIDOS,
    PERIODO_DIA,
    PERIODOS_VALIDOS,
    TOP_CLIENTES_POR_COMPRAS,
    TOP_CLIENTES_POR_MONTO,
    calcular_resumen,
    calcular_resumen_compras,
    calcular_resumen_facturacion,
    calcular_resumen_ventas,
    calcular_top_clientes,
    calcular_top_productos,
    obtener_movimientos_caja,
)


def _es_admin(request):
    return request.user.rol_usuario == ROL_ADMIN


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
    014 · Dashboard. Abierta a cualquier usuario autenticado (las secciones
    de Ventas y Compras usan sus totales), pero la ganancia y su serie solo
    se devuelven al admin (`016`, "Actualización: ganancias y movimientos
    de caja solo para admin").
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        resumen = calcular_resumen(periodo)
        serializer = ResumenDashboardSerializer if _es_admin(request) else ResumenDashboardOperadorSerializer
        return Response(serializer(resumen).data)


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
    """GET /api/reportes/clientes-top/?periodo=&orden=mas|menos. El admin
    recibe el monto comprado; el operador, el número de compras, sin
    importes (`016`, "Actualización: ganancias y movimientos de caja solo
    para admin").
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        orden = _validar_orden(request)
        if _es_admin(request):
            resultados = calcular_top_clientes(periodo, orden, por=TOP_CLIENTES_POR_MONTO)
            return Response(ClienteTopSerializer(resultados, many=True).data)
        resultados = calcular_top_clientes(periodo, orden, por=TOP_CLIENTES_POR_COMPRAS)
        return Response(ClienteTopOperadorSerializer(resultados, many=True).data)


class MovimientosCajaReporteView(APIView):
    """GET /api/reportes/movimientos-caja/?periodo=&limite=5|10|todos.

    Expone únicamente fecha/tipo/observación (nunca monto ni
    saldo_resultante), para la lista de "Movimientos financieros del
    periodo" del Dashboard. Solo admin desde `016`, "Actualización:
    ganancias y movimientos de caja solo para admin".
    """

    permission_classes = [EsAdmin]

    def get(self, request):
        periodo = _validar_periodo(request)
        limite = request.query_params.get('limite', LIMITE_10)
        if limite not in LIMITES_VALIDOS:
            raise ValidationError({'limite': f'Debe ser uno de: {", ".join(LIMITES_VALIDOS)}.'})

        movimientos = obtener_movimientos_caja(periodo, limite)
        return Response(MovimientoCajaReporteSerializer(movimientos, many=True).data)


class ResumenFacturacionView(APIView):
    """GET /api/reportes/facturacion/?periodo= — sección 'Resumen
    facturación' del Dashboard (`016`, "Actualización: Resumen facturación
    con datos"). Abierta a cualquier usuario autenticado, igual que
    Facturación, con el mismo contenido para ambos roles.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        return Response(ResumenFacturacionSerializer(calcular_resumen_facturacion(periodo)).data)
