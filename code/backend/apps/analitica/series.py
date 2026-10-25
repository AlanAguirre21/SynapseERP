"""Series históricas para los pronósticos — `023 · Analítica predictiva`.
Solo lectura sobre `Venta`/`DetalleVenta`. Cuentan únicamente las ventas
`pendiente`/`entregada` (mismo `ESTADOS_VENTA_CUENTAN` del Dashboard) y se
agrupan con los mismos buckets en hora local (`apps.reportes.services`).

Cada serie es un dict `{clave: Decimal}` donde `clave` es el inicio local
del periodo (datetime). `claves_historial()` da el eje completo, de la
primera venta al último periodo completo, para rellenar con ceros.
"""

from decimal import Decimal

from django.utils import timezone

from apps.reportes.services import ESTADOS_VENTA_CUENTAN, clave_bucket, siguiente_clave
from apps.ventas.models import DetalleVenta, Venta

CERO = Decimal('0.00')


def _ventas_hasta(hasta):
    return Venta.objects.filter(estado__in=ESTADOS_VENTA_CUENTAN, fecha__lt=hasta)


def claves_historial(granularidad, hasta):
    """Inicios de periodo desde el de la primera venta que cuenta hasta el
    último periodo que termina antes de `hasta` (inicio del periodo en
    curso). Vacío si no hay ventas."""

    primera = _ventas_hasta(hasta).order_by('fecha').values_list('fecha', flat=True).first()
    if primera is None:
        return []
    claves = []
    cursor = clave_bucket(timezone.localtime(primera), granularidad)
    while cursor < hasta:
        claves.append(cursor)
        cursor = siguiente_clave(cursor, granularidad)
    return claves


def _acumular(pares, granularidad, totales=None):
    totales = {} if totales is None else totales
    for fecha, valor in pares:
        clave = clave_bucket(timezone.localtime(fecha), granularidad)
        totales[clave] = totales.get(clave, CERO) + (valor or CERO)
    return totales


def serie_ventas(granularidad, hasta):
    """`(monto, numero)` por periodo."""

    ventas = _ventas_hasta(hasta).values_list('fecha', 'total')
    monto = _acumular(ventas, granularidad)
    numero = _acumular(((fecha, Decimal(1)) for fecha, _ in ventas), granularidad)
    return monto, numero


def serie_por_categoria(granularidad, hasta):
    """`{categoria_id: {clave: monto}}`, según la categoría actual del producto
    (ver Decisiones de `plan.md`)."""

    detalles = DetalleVenta.objects.filter(
        venta__estado__in=ESTADOS_VENTA_CUENTAN, venta__fecha__lt=hasta,
    ).values_list('venta__fecha', 'producto__categoria', 'subtotal')
    por_categoria = {}
    for fecha, categoria, subtotal in detalles:
        _acumular([(fecha, subtotal)], granularidad, por_categoria.setdefault(categoria, {}))
    return por_categoria


def serie_por_producto(granularidad, hasta):
    """`{producto_id: {clave: unidades}}`, solo productos activos."""

    detalles = DetalleVenta.objects.filter(
        venta__estado__in=ESTADOS_VENTA_CUENTAN, venta__fecha__lt=hasta, producto__activo=True,
    ).values_list('venta__fecha', 'producto', 'cantidad')
    por_producto = {}
    for fecha, producto, cantidad in detalles:
        _acumular([(fecha, cantidad)], granularidad, por_producto.setdefault(producto, {}))
    return por_producto


def serie_clientes(granularidad, hasta):
    """`(nuevos, activos)` por periodo. Un cliente es nuevo en
    el periodo de su primera venta que cuenta (una venta cancelada no lo
    adquiere); activo en cada periodo con al menos una venta. Las ventas sin
    cliente (mostrador) no cuentan."""

    ventas = _ventas_hasta(hasta).exclude(cliente__isnull=True).values_list('cliente', 'fecha')
    primera_por_cliente = {}
    activos_por_clave = {}
    for cliente, fecha in ventas:
        if cliente not in primera_por_cliente or fecha < primera_por_cliente[cliente]:
            primera_por_cliente[cliente] = fecha
        clave = clave_bucket(timezone.localtime(fecha), granularidad)
        activos_por_clave.setdefault(clave, set()).add(cliente)

    nuevos = _acumular(((fecha, Decimal(1)) for fecha in primera_por_cliente.values()), granularidad)
    activos = {clave: Decimal(len(clientes)) for clave, clientes in activos_por_clave.items()}
    return nuevos, activos


def a_lista(totales, claves):
    return [totales.get(clave, CERO) for clave in claves]
