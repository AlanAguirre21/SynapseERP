"""Agregación de solo lectura sobre `Venta`/`Compra`/`MovimientoCaja` para
el panel de reportes del Dashboard (`014`) — no crea ni modifica ningún
modelo, solo `Sum()`/`Count()` sobre tablas ya existentes.
"""

from datetime import timedelta
from decimal import Decimal

from django.db.models import QuerySet, Sum
from django.utils import timezone

from apps.caja.models import MovimientoCaja
from apps.compras.models import Compra, DetalleCompraMateriaPrima, DetalleCompraProducto
from apps.ventas.models import DetalleVenta, Venta

PERIODO_DIA = 'dia'
PERIODO_SEMANA = 'semana'
PERIODO_MES = 'mes'
PERIODO_ANIO = 'año'
PERIODOS_VALIDOS = [PERIODO_DIA, PERIODO_SEMANA, PERIODO_MES, PERIODO_ANIO]

ORDEN_MAS = 'mas'
ORDEN_MENOS = 'menos'
ORDENES_VALIDOS = [ORDEN_MAS, ORDEN_MENOS]

LIMITE_5 = '5'
LIMITE_10 = '10'
LIMITE_TODOS = 'todos'
LIMITES_VALIDOS = [LIMITE_5, LIMITE_10, LIMITE_TODOS]

GRANULARIDAD_HORA = 'hora'
GRANULARIDAD_DIA = 'dia'
GRANULARIDAD_MES = 'mes'

# Solo cuentan los estados donde la venta/compra ya tuvo un efecto
# económico real sobre el negocio — no simplemente donde existe el
# registro:
# - Venta: `pendiente` y `entregada` cuentan por igual, porque el stock y
#   el ingreso de caja ya se descontaron/registraron al CREAR la venta
#   (011 · Ventas no tiene paso "recibir" separado) — solo `cancelada` se
#   excluye.
# - Compra: `pendiente` y `recibida` cuentan por igual (ajuste "compras en
#   caja" de `013 · Caja`) — el retiro de caja ya ocurre al CREAR la
#   compra, no en `recibir()` (que sigue gobernando solo el efecto sobre
#   inventario/asiento de Inventario-Proveedores) — solo `cancelada` se
#   excluye, mismo criterio que Ventas.
ESTADOS_VENTA_CUENTAN = [Venta.ESTADO_PENDIENTE, Venta.ESTADO_ENTREGADA]
ESTADOS_COMPRA_CUENTAN = [Compra.ESTADO_PENDIENTE, Compra.ESTADO_RECIBIDA]

CERO = Decimal('0.00')


def _rango_periodo(periodo: str):
    ahora = timezone.localtime()

    if periodo == PERIODO_DIA:
        inicio = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
        granularidad = GRANULARIDAD_HORA
    elif periodo == PERIODO_SEMANA:
        inicio = (ahora - timedelta(days=ahora.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        granularidad = GRANULARIDAD_DIA
    elif periodo == PERIODO_MES:
        inicio = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        granularidad = GRANULARIDAD_DIA
    elif periodo == PERIODO_ANIO:
        inicio = ahora.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        granularidad = GRANULARIDAD_MES
    else:
        raise ValueError(f'Periodo inválido: {periodo!r} — debe ser uno de {PERIODOS_VALIDOS}.')

    return inicio, ahora, granularidad


def _clave_bucket(fecha_local, granularidad):
    if granularidad == GRANULARIDAD_HORA:
        return fecha_local.replace(minute=0, second=0, microsecond=0)
    if granularidad == GRANULARIDAD_MES:
        return fecha_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return fecha_local.replace(hour=0, minute=0, second=0, microsecond=0)


def _siguiente_mes(fecha):
    if fecha.month == 12:
        return fecha.replace(year=fecha.year + 1, month=1)
    return fecha.replace(month=fecha.month + 1)


def _generar_claves(inicio, ahora, granularidad):
    claves = []
    cursor = inicio
    while cursor <= ahora:
        claves.append(cursor)
        if granularidad == GRANULARIDAD_HORA:
            cursor += timedelta(hours=1)
        elif granularidad == GRANULARIDAD_MES:
            cursor = _siguiente_mes(cursor)
        else:
            cursor += timedelta(days=1)
    return claves


def _agrupar_por_bucket(pares_fecha_monto, granularidad):
    """Agrupa pares `(fecha, monto)` ya traídos de la base de datos (no
    todas las columnas ni filas fuera de rango) en Python — con el
    volumen esperado (negocio pequeño) es más simple y evita depender de
    cómo `TruncHour`/`TruncDate` de Django resuelven zona horaria a nivel
    SQL.
    """

    totales: dict = {}
    for fecha, monto in pares_fecha_monto:
        clave = _clave_bucket(timezone.localtime(fecha), granularidad)
        totales[clave] = totales.get(clave, CERO) + (monto or CERO)
    return totales


def _totales_por_bucket(queryset: QuerySet, granularidad, campo='total'):
    return _agrupar_por_bucket(queryset.values_list('fecha', campo), granularidad)


def _serie_desde_totales(totales_por_bucket, claves):
    return [{'fecha': clave.isoformat(), 'monto': totales_por_bucket.get(clave, CERO)} for clave in claves]


def calcular_resumen(periodo: str) -> dict:
    inicio, ahora, granularidad = _rango_periodo(periodo)

    ventas_qs = Venta.objects.filter(fecha__gte=inicio, fecha__lte=ahora, estado__in=ESTADOS_VENTA_CUENTAN)
    compras_qs = Compra.objects.filter(fecha__gte=inicio, fecha__lte=ahora, estado__in=ESTADOS_COMPRA_CUENTAN)

    ventas_total = ventas_qs.aggregate(total=Sum('total'))['total'] or CERO
    compras_total = compras_qs.aggregate(total=Sum('total'))['total'] or CERO

    ventas_por_bucket = _totales_por_bucket(ventas_qs, granularidad)
    compras_por_bucket = _totales_por_bucket(compras_qs, granularidad)

    serie = [
        {
            'fecha': clave.isoformat(),
            'ganancia': ventas_por_bucket.get(clave, CERO) - compras_por_bucket.get(clave, CERO),
        }
        for clave in _generar_claves(inicio, ahora, granularidad)
    ]

    return {
        'periodo': periodo,
        'ventas_total': ventas_total,
        'compras_total': compras_total,
        'ganancia': ventas_total - compras_total,
        'serie': serie,
    }


def calcular_resumen_ventas(periodo: str) -> dict:
    """Desglose para la sección 'Resumen de ventas' del Dashboard: series
    con envío / sin envío / solo envío, más conteo por estado para la
    gráfica de barras Pendiente/Entregada.
    """

    inicio, ahora, granularidad = _rango_periodo(periodo)
    claves = _generar_claves(inicio, ahora, granularidad)

    ventas_qs = Venta.objects.filter(fecha__gte=inicio, fecha__lte=ahora, estado__in=ESTADOS_VENTA_CUENTAN)

    con_envio_por_bucket = _totales_por_bucket(ventas_qs, granularidad, campo='total')
    envio_por_bucket = _totales_por_bucket(ventas_qs, granularidad, campo='gasto_envio')
    sin_envio_por_bucket = {
        clave: con_envio_por_bucket.get(clave, CERO) - envio_por_bucket.get(clave, CERO) for clave in claves
    }

    conteo_estado = [
        {
            'tipo': 'Pendiente',
            'cantidad': Venta.objects.filter(
                fecha__gte=inicio, fecha__lte=ahora, estado=Venta.ESTADO_PENDIENTE,
            ).count(),
        },
        {
            'tipo': 'Entregada',
            'cantidad': Venta.objects.filter(
                fecha__gte=inicio, fecha__lte=ahora, estado=Venta.ESTADO_ENTREGADA,
            ).count(),
        },
    ]

    return {
        'periodo': periodo,
        'con_envio': _serie_desde_totales(con_envio_por_bucket, claves),
        'sin_envio': _serie_desde_totales(sin_envio_por_bucket, claves),
        'envio': _serie_desde_totales(envio_por_bucket, claves),
        'conteo_estado': conteo_estado,
    }


def calcular_resumen_compras(periodo: str) -> dict:
    """Desglose para la sección 'Resumen de compras': series todas /
    productos / insumos, más conteo por estado para la gráfica de barras
    Pendiente/Recibida. Una `Compra` puede incluir líneas de producto y
    de materia prima a la vez, así que el desglose se hace a nivel de
    detalle (`DetalleCompraProducto`/`DetalleCompraMateriaPrima`), no de
    `Compra.total`.
    """

    inicio, ahora, granularidad = _rango_periodo(periodo)
    claves = _generar_claves(inicio, ahora, granularidad)

    detalles_producto = DetalleCompraProducto.objects.filter(
        compra__fecha__gte=inicio, compra__fecha__lte=ahora, compra__estado__in=ESTADOS_COMPRA_CUENTAN,
    ).values_list('compra__fecha', 'subtotal')

    detalles_materia_prima = DetalleCompraMateriaPrima.objects.filter(
        compra__fecha__gte=inicio, compra__fecha__lte=ahora, compra__estado__in=ESTADOS_COMPRA_CUENTAN,
    ).values_list('compra__fecha', 'subtotal')

    productos_por_bucket = _agrupar_por_bucket(detalles_producto, granularidad)
    insumos_por_bucket = _agrupar_por_bucket(detalles_materia_prima, granularidad)
    todas_por_bucket = {
        clave: productos_por_bucket.get(clave, CERO) + insumos_por_bucket.get(clave, CERO) for clave in claves
    }

    conteo_estado = [
        {
            'tipo': 'Pendiente',
            'cantidad': Compra.objects.filter(
                fecha__gte=inicio, fecha__lte=ahora, estado=Compra.ESTADO_PENDIENTE,
            ).count(),
        },
        {
            'tipo': 'Recibida',
            'cantidad': Compra.objects.filter(
                fecha__gte=inicio, fecha__lte=ahora, estado=Compra.ESTADO_RECIBIDA,
            ).count(),
        },
    ]

    return {
        'periodo': periodo,
        'todas': _serie_desde_totales(todas_por_bucket, claves),
        'productos': _serie_desde_totales(productos_por_bucket, claves),
        'insumos': _serie_desde_totales(insumos_por_bucket, claves),
        'conteo_estado': conteo_estado,
    }


def calcular_top_productos(periodo: str, orden: str = ORDEN_MAS) -> list:
    """Top 5 productos por cantidad vendida. `orden='menos'` solo
    considera productos con al menos una unidad vendida en el periodo —
    nunca lista productos sin ventas, que no tendrían un ranking con
    significado.
    """

    inicio, ahora, _ = _rango_periodo(periodo)

    query = (
        DetalleVenta.objects.filter(
            venta__fecha__gte=inicio, venta__fecha__lte=ahora, venta__estado__in=ESTADOS_VENTA_CUENTAN,
        )
        .values('producto__nombre_producto')
        .annotate(cantidad=Sum('cantidad'))
        .filter(cantidad__gt=0)
    )
    query = query.order_by('cantidad' if orden == ORDEN_MENOS else '-cantidad')

    return [{'producto': fila['producto__nombre_producto'], 'cantidad': fila['cantidad']} for fila in query[:5]]


def calcular_top_clientes(periodo: str, orden: str = ORDEN_MAS) -> list:
    """Top 5 clientes por monto comprado. Excluye ventas sin cliente
    (venta de mostrador) y, con `orden='menos'`, clientes sin compras en
    el periodo.
    """

    inicio, ahora, _ = _rango_periodo(periodo)

    query = (
        Venta.objects.filter(
            fecha__gte=inicio, fecha__lte=ahora, estado__in=ESTADOS_VENTA_CUENTAN, cliente__isnull=False,
        )
        .values('cliente__nombre_cliente')
        .annotate(monto=Sum('total'))
        .filter(monto__gt=0)
    )
    query = query.order_by('monto' if orden == ORDEN_MENOS else '-monto')

    return [{'cliente': fila['cliente__nombre_cliente'], 'monto': fila['monto']} for fila in query[:5]]


def obtener_movimientos_caja(periodo: str, limite: str = LIMITE_10):
    """Movimientos de caja del periodo, más recientes primero. Se usa
    para la lista de 'Movimientos financieros del periodo' del Dashboard
    — a diferencia del endpoint admin-only de `013 · Caja`, el llamador
    decide qué campos exponer (solo fecha/tipo/observación).
    """

    inicio, ahora, _ = _rango_periodo(periodo)
    queryset = MovimientoCaja.objects.filter(fecha__gte=inicio, fecha__lte=ahora).order_by('-fecha')

    if limite == LIMITE_TODOS:
        return queryset

    return queryset[: int(limite)]
