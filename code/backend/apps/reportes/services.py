"""Agregación de solo lectura sobre `Venta`/`Compra` para el resumen del
Dashboard (`014`) — no crea ni modifica ningún modelo, solo `Sum()` sobre
tablas ya existentes.
"""

from datetime import timedelta
from decimal import Decimal

from django.db.models import QuerySet, Sum
from django.utils import timezone

from apps.compras.models import Compra
from apps.ventas.models import Venta

PERIODO_DIA = 'dia'
PERIODO_SEMANA = 'semana'
PERIODO_MES = 'mes'
PERIODOS_VALIDOS = [PERIODO_DIA, PERIODO_SEMANA, PERIODO_MES]

GRANULARIDAD_HORA = 'hora'
GRANULARIDAD_DIA = 'dia'

# Solo cuentan los estados donde la venta/compra ya tuvo un efecto
# económico real sobre el negocio — no simplemente donde existe el
# registro:
# - Venta: `pendiente` y `entregada` cuentan por igual, porque el stock y
#   el ingreso de caja ya se descontaron/registraron al CREAR la venta
#   (011 · Ventas no tiene paso "recibir" separado) — solo `cancelada` se
#   excluye.
# - Compra: solo `recibida` cuenta. A diferencia de Ventas, una compra
#   `pendiente` todavía no afectó inventario ni representa un costo ya
#   incurrido (010 · Compras: el efecto ocurre en `recibir()`, no al
#   crear) — contarla inflaría "compras" con gasto que aún no sucede.
ESTADOS_VENTA_CUENTAN = [Venta.ESTADO_PENDIENTE, Venta.ESTADO_ENTREGADA]
ESTADOS_COMPRA_CUENTAN = [Compra.ESTADO_RECIBIDA]

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
    else:
        raise ValueError(f'Periodo inválido: {periodo!r} — debe ser uno de {PERIODOS_VALIDOS}.')

    return inicio, ahora, granularidad


def _clave_bucket(fecha_local, granularidad):
    if granularidad == GRANULARIDAD_HORA:
        return fecha_local.replace(minute=0, second=0, microsecond=0)
    return fecha_local.replace(hour=0, minute=0, second=0, microsecond=0)


def _generar_claves(inicio, ahora, granularidad):
    paso = timedelta(hours=1) if granularidad == GRANULARIDAD_HORA else timedelta(days=1)
    claves = []
    cursor = inicio
    while cursor <= ahora:
        claves.append(cursor)
        cursor += paso
    return claves


def _totales_por_bucket(queryset: QuerySet, granularidad):
    """Trae solo `(fecha, total)` del periodo ya filtrado — no todas las
    columnas ni filas fuera de rango — y agrupa en Python. Con el volumen
    esperado (negocio pequeño) es más simple y evita depender de cómo
    `TruncHour`/`TruncDate` de Django resuelven zona horaria a nivel SQL.
    """

    totales: dict = {}
    for fecha, monto in queryset.values_list('fecha', 'total'):
        clave = _clave_bucket(timezone.localtime(fecha), granularidad)
        totales[clave] = totales.get(clave, CERO) + monto
    return totales


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
