from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

<<<<<<< HEAD
from .serializers import (
=======
from core.permissions import ROL_ADMIN, EsAdmin

from .serializers import (
    ClienteTopOperadorSerializer,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    ClienteTopSerializer,
    MovimientoCajaReporteSerializer,
    ProductoTopSerializer,
    ResumenComprasSerializer,
<<<<<<< HEAD
    ResumenDashboardSerializer,
=======
    ResumenDashboardOperadorSerializer,
    ResumenDashboardSerializer,
    ResumenFacturacionSerializer,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    ResumenVentasSerializer,
)
from .services import (
    LIMITE_10,
    LIMITES_VALIDOS,
    ORDEN_MAS,
    ORDENES_VALIDOS,
    PERIODO_DIA,
    PERIODOS_VALIDOS,
<<<<<<< HEAD
    calcular_resumen,
    calcular_resumen_compras,
=======
    TOP_CLIENTES_POR_COMPRAS,
    TOP_CLIENTES_POR_MONTO,
    calcular_resumen,
    calcular_resumen_compras,
    calcular_resumen_facturacion,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    calcular_resumen_ventas,
    calcular_top_clientes,
    calcular_top_productos,
    obtener_movimientos_caja,
)


<<<<<<< HEAD
=======
def _es_admin(request):
    return request.user.rol_usuario == ROL_ADMIN


def _alcance(request):
    """`None` (toda la empresa) para el admin; el propio usuario para el
    operador, que solo ve cifras de sus ventas, compras y facturas (`016`,
    "Actualización: cifras propias para el operador")."""
    return None if _es_admin(request) else request.user


>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
    014 · Dashboard. Abierta a cualquier usuario autenticado, sin
    restricción de rol (pantalla de entrada general del sistema).
=======
    014 · Dashboard. Abierta a cualquier usuario autenticado (las secciones
    de Ventas y Compras usan sus totales), pero la ganancia y su serie solo
    se devuelven al admin (`016`, "Actualización: ganancias y movimientos
    de caja solo para admin").
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
<<<<<<< HEAD
        resumen = calcular_resumen(periodo)
        return Response(ResumenDashboardSerializer(resumen).data)
=======
        resumen = calcular_resumen(periodo, usuario=_alcance(request))
        serializer = ResumenDashboardSerializer if _es_admin(request) else ResumenDashboardOperadorSerializer
        return Response(serializer(resumen).data)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b


class ResumenVentasView(APIView):
    """GET /api/reportes/ventas/?periodo= — desglose para la sección
    'Resumen de ventas' del Dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
<<<<<<< HEAD
        resumen = calcular_resumen_ventas(periodo)
=======
        resumen = calcular_resumen_ventas(periodo, usuario=_alcance(request))
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        return Response(ResumenVentasSerializer(resumen).data)


class ResumenComprasView(APIView):
    """GET /api/reportes/compras/?periodo= — desglose para la sección
    'Resumen de compras' del Dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
<<<<<<< HEAD
        resumen = calcular_resumen_compras(periodo)
=======
        resumen = calcular_resumen_compras(periodo, usuario=_alcance(request))
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        return Response(ResumenComprasSerializer(resumen).data)


class ProductosTopView(APIView):
    """GET /api/reportes/productos-top/?periodo=&orden=mas|menos."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        orden = _validar_orden(request)
<<<<<<< HEAD
        resultados = calcular_top_productos(periodo, orden)
=======
        resultados = calcular_top_productos(periodo, orden, usuario=_alcance(request))
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        return Response(ProductoTopSerializer(resultados, many=True).data)


class ClientesTopView(APIView):
<<<<<<< HEAD
    """GET /api/reportes/clientes-top/?periodo=&orden=mas|menos."""
=======
    """GET /api/reportes/clientes-top/?periodo=&orden=mas|menos. El admin
    recibe el monto comprado; el operador, el número de compras, sin
    importes (`016`, "Actualización: ganancias y movimientos de caja solo
    para admin").
    """
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        orden = _validar_orden(request)
<<<<<<< HEAD
        resultados = calcular_top_clientes(periodo, orden)
        return Response(ClienteTopSerializer(resultados, many=True).data)
=======
        if _es_admin(request):
            resultados = calcular_top_clientes(periodo, orden, por=TOP_CLIENTES_POR_MONTO)
            return Response(ClienteTopSerializer(resultados, many=True).data)
        resultados = calcular_top_clientes(periodo, orden, por=TOP_CLIENTES_POR_COMPRAS, usuario=request.user)
        return Response(ClienteTopOperadorSerializer(resultados, many=True).data)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b


class MovimientosCajaReporteView(APIView):
    """GET /api/reportes/movimientos-caja/?periodo=&limite=5|10|todos.

<<<<<<< HEAD
    Distinto del endpoint admin-only de `013 · Caja`: expone únicamente
    fecha/tipo/observación (nunca monto ni saldo_resultante), visible a
    cualquier usuario autenticado, para la lista de "Movimientos
    financieros del periodo" del Dashboard.
    """

    permission_classes = [IsAuthenticated]
=======
    Expone únicamente fecha/tipo/observación (nunca monto ni
    saldo_resultante), para la lista de "Movimientos financieros del
    periodo" del Dashboard. Solo admin desde `016`, "Actualización:
    ganancias y movimientos de caja solo para admin".
    """

    permission_classes = [EsAdmin]
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

    def get(self, request):
        periodo = _validar_periodo(request)
        limite = request.query_params.get('limite', LIMITE_10)
        if limite not in LIMITES_VALIDOS:
            raise ValidationError({'limite': f'Debe ser uno de: {", ".join(LIMITES_VALIDOS)}.'})

        movimientos = obtener_movimientos_caja(periodo, limite)
        return Response(MovimientoCajaReporteSerializer(movimientos, many=True).data)
<<<<<<< HEAD
=======


class ResumenFacturacionView(APIView):
    """GET /api/reportes/facturacion/?periodo= — sección 'Resumen
    facturación' del Dashboard (`016`, "Actualización: Resumen facturación
    con datos"). Abierta a cualquier usuario autenticado, igual que
    Facturación, con el mismo contenido para ambos roles.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = _validar_periodo(request)
        return Response(ResumenFacturacionSerializer(calcular_resumen_facturacion(periodo, usuario=_alcance(request))).data)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
