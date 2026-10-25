"""Generación y consulta de pronósticos — `023 · Analítica predictiva`.

`generar()` crea una `GeneracionPronostico` con un `Pronostico` por métrica y
dimensión. Las funciones de consulta (`generacion_vigente`,
`pronostico_vigente`, `precision_real`, …) las reutiliza también
`024 · Asistente conversacional`, sin pasar por HTTP.
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.catalogo.models import Categoria, Producto
from apps.inventario.models import InventarioSucursalProducto
from apps.reportes.services import (
    ESTADOS_VENTA_CUENTAN,
    PERIODO_ANIO,
    PERIODO_MES,
    PERIODO_SEMANA,
    clave_bucket,
    siguiente_clave,
)
from apps.ventas.models import Venta

from . import modelo, series
from .models import GeneracionPronostico, Pronostico, PuntoPronostico

logger = logging.getLogger(__name__)

CERO = Decimal('0.00')

DIA = GeneracionPronostico.GRANULARIDAD_DIA
SEMANA = GeneracionPronostico.GRANULARIDAD_SEMANA
MES = GeneracionPronostico.GRANULARIDAD_MES

# Historial mínimo y máximo de periodos de un rango personalizado (spec.md).
PERIODOS_MINIMOS = {DIA: 28, SEMANA: 8, MES: 6}
PERIODOS_MAXIMOS = {DIA: 90, SEMANA: 26, MES: 12}
# La estacionalidad mensual solo se usa con al menos 24 meses de historial.
MESES_PARA_ESTACIONALIDAD = 24

HORIZONTES_ESTANDAR = {
    GeneracionPronostico.HORIZONTE_DIAS_7: (DIA, 7),
    GeneracionPronostico.HORIZONTE_SEMANAS_4: (SEMANA, 4),
    GeneracionPronostico.HORIZONTE_MESES_3: (MES, 3),
}


class RangoInvalido(ValueError):
    """Rango personalizado que no cumple las reglas de `spec.md`."""


# --- Periodos ------------------------------------------------------------------


def _ahora():
    return timezone.localtime()


def resolver_rango(horizonte, ahora, desde=None, hasta=None, granularidad=None):
    """`(granularidad, claves, desplazamientos)` de los periodos a
    pronosticar. Siempre empiezan en el siguiente periodo completo (el
    periodo en curso no se pronostica); `desplazamientos[i]` es cuántos
    periodos después del actual cae `claves[i]` (1 = el siguiente)."""

    if horizonte in HORIZONTES_ESTANDAR:
        granularidad, cantidad = HORIZONTES_ESTANDAR[horizonte]
        cursor = clave_bucket(ahora, granularidad)
        claves = []
        for _ in range(cantidad):
            cursor = siguiente_clave(cursor, granularidad)
            claves.append(cursor)
        return granularidad, claves, list(range(1, cantidad + 1))

    if granularidad not in PERIODOS_MAXIMOS:
        raise RangoInvalido('Elige una granularidad: día, semana o mes.')
    if desde is None or hasta is None or hasta <= desde:
        raise RangoInvalido('La fecha final debe ser posterior a la inicial.')
    if desde <= ahora.date():
        raise RangoInvalido('El rango debe empezar en una fecha futura.')

    inicio = clave_bucket(_a_local(desde), granularidad)
    fin = clave_bucket(_a_local(hasta), granularidad)
    cursor = clave_bucket(ahora, granularidad)
    claves, desplazamientos = [], []
    paso = 0
    while cursor < fin:
        cursor = siguiente_clave(cursor, granularidad)
        paso += 1
        if cursor >= inicio:
            claves.append(cursor)
            desplazamientos.append(paso)
    if not claves:
        raise RangoInvalido('El rango no contiene ningún periodo completo futuro.')
    if len(claves) > PERIODOS_MAXIMOS[granularidad]:
        raise RangoInvalido(
            f'El rango tiene {len(claves)} periodos; el máximo para esta granularidad es '
            f'{PERIODOS_MAXIMOS[granularidad]}.',
        )
    return granularidad, claves, desplazamientos


def _a_local(fecha):
    return datetime(fecha.year, fecha.month, fecha.day, tzinfo=timezone.get_current_timezone())


def fin_de_periodo(clave, granularidad):
    """Último día (fecha) del periodo que empieza en `clave`."""
    return (siguiente_clave(clave, granularidad) - timedelta(days=1)).date()


def _posiciones(claves, granularidad):
    if granularidad == DIA:
        return [clave.weekday() for clave in claves]
    if granularidad == MES:
        return [clave.month for clave in claves]
    return None


# --- Generación -------------------------------------------------------------------


def _crear_pronostico(generacion, metrica, totales, claves_historial, claves, desplazamientos, *,
                      producto=None, categoria=None, recortar_inicio=False):
    """Ajusta y guarda una serie. Con `recortar_inicio` la serie empieza en su
    primer valor distinto de cero (productos y categorías nuevos no arrastran
    ceros de antes de existir)."""

    granularidad = generacion.granularidad
    if recortar_inicio:
        primero = next((i for i, clave in enumerate(claves_historial) if totales.get(clave, CERO) != 0), None)
        claves_historial = [] if primero is None else claves_historial[primero:]

    valores = series.a_lista(totales, claves_historial)
    minimo = PERIODOS_MINIMOS[granularidad]
    comunes = {
        'generacion': generacion, 'metrica': metrica, 'producto': producto, 'categoria': categoria,
        'periodos_historial': len(valores), 'periodos_minimos': minimo,
    }
    if len(valores) < minimo:
        return Pronostico.objects.create(estado=Pronostico.ESTADO_HISTORIAL_INSUFICIENTE, **comunes)

    usa_estacionalidad = granularidad == DIA or (granularidad == MES and len(valores) >= MESES_PARA_ESTACIONALIDAD)
    posiciones_historial = _posiciones(claves_historial, granularidad) if usa_estacionalidad else None
    posiciones_futuras = _posiciones(claves, granularidad) if usa_estacionalidad else None

    ajuste = modelo.ajustar(valores, posiciones_historial)
    n = len(valores)
    puntos = modelo.pronosticar(ajuste, [n + paso for paso in desplazamientos], posiciones_futuras)
    total = sum((p['valor'] for p in puntos), CERO)
    margen = modelo.margen_total(ajuste, len(puntos))

    pronostico = Pronostico.objects.create(
        estado=Pronostico.ESTADO_GENERADO,
        metodo=Pronostico.METODO_TENDENCIA_ESTACIONAL if ajuste['estacional'] else Pronostico.METODO_TENDENCIA,
        wape=modelo.validar(valores, posiciones_historial, len(claves), minimo),
        total_pronosticado=total, total_inferior=max(total - margen, CERO), total_superior=total + margen,
        **comunes,
    )
    PuntoPronostico.objects.bulk_create([
        PuntoPronostico(
            pronostico=pronostico, periodo_inicio=clave.date(), periodo_fin=fin_de_periodo(clave, granularidad),
            valor=p['valor'], limite_inferior=p['inferior'], limite_superior=p['superior'],
        )
        for clave, p in zip(claves, puntos, strict=True)
    ])
    return pronostico


def _base_actual_clientes(hasta):
    return (
        Venta.objects.filter(estado__in=ESTADOS_VENTA_CUENTAN, fecha__lt=hasta, cliente__isnull=False)
        .values('cliente').distinct().count()
    )


def _crear_base_clientes(generacion, pronostico_nuevos, ahora):
    """Base acumulada = clientes adquiridos hasta hoy + nuevos pronosticados,
    periodo a periodo. Su "total" es el valor al final del horizonte."""

    comunes = {
        'generacion': generacion, 'metrica': Pronostico.METRICA_BASE_CLIENTES,
        'periodos_historial': pronostico_nuevos.periodos_historial,
        'periodos_minimos': pronostico_nuevos.periodos_minimos,
    }
    if pronostico_nuevos.estado != Pronostico.ESTADO_GENERADO:
        return Pronostico.objects.create(estado=Pronostico.ESTADO_HISTORIAL_INSUFICIENTE, **comunes)

    base = Decimal(_base_actual_clientes(ahora))
    valor, inferior, superior = base, base, base
    puntos = []
    for punto in pronostico_nuevos.puntos.order_by('periodo_inicio'):
        valor += punto.valor
        inferior += punto.limite_inferior
        superior += punto.limite_superior
        puntos.append((punto, valor, inferior, superior))

    pronostico = Pronostico.objects.create(
        estado=Pronostico.ESTADO_GENERADO, metodo=pronostico_nuevos.metodo, wape=pronostico_nuevos.wape,
        total_pronosticado=valor, total_inferior=inferior, total_superior=superior, **comunes,
    )
    PuntoPronostico.objects.bulk_create([
        PuntoPronostico(
            pronostico=pronostico, periodo_inicio=punto.periodo_inicio, periodo_fin=punto.periodo_fin,
            valor=acumulado, limite_inferior=acumulado_inferior, limite_superior=acumulado_superior,
        )
        for punto, acumulado, acumulado_inferior, acumulado_superior in puntos
    ])
    return pronostico


def _generar_series(generacion, claves, desplazamientos, ahora):
    granularidad = generacion.granularidad
    actual = clave_bucket(ahora, granularidad)
    claves_historial = series.claves_historial(granularidad, actual)
    if claves_historial:
        generacion.historial_desde = claves_historial[0].date()
        generacion.historial_hasta = fin_de_periodo(claves_historial[-1], granularidad)

    def crear(metrica, totales, **extra):
        return _crear_pronostico(generacion, metrica, totales, claves_historial, claves, desplazamientos, **extra)

    monto, numero = series.serie_ventas(granularidad, actual)
    crear(Pronostico.METRICA_MONTO_VENTAS, monto)
    crear(Pronostico.METRICA_NUMERO_VENTAS, numero)

    por_categoria = series.serie_por_categoria(granularidad, actual)
    for categoria in Categoria.objects.filter(pk__in=por_categoria.keys()).order_by('nombre_categoria'):
        crear(Pronostico.METRICA_MONTO_CATEGORIA, por_categoria[categoria.pk], categoria=categoria,
              recortar_inicio=True)

    por_producto = series.serie_por_producto(granularidad, actual)
    for producto in Producto.objects.filter(pk__in=por_producto.keys()).order_by('nombre_producto'):
        crear(Pronostico.METRICA_UNIDADES_PRODUCTO, por_producto[producto.pk], producto=producto,
              recortar_inicio=True)

    nuevos, activos = series.serie_clientes(granularidad, actual)
    pronostico_nuevos = crear(Pronostico.METRICA_CLIENTES_NUEVOS, nuevos)
    crear(Pronostico.METRICA_CLIENTES_ACTIVOS, activos)
    _crear_base_clientes(generacion, pronostico_nuevos, ahora)


def generar(horizonte, origen, usuario=None, desde=None, hasta=None, granularidad=None, ahora=None):
    """Crea una generación completa. Lanza `RangoInvalido` antes de guardar
    nada si el rango personalizado no es válido. Si el cálculo falla, la
    generación queda `fallida` con su error y sin pronósticos parciales."""

    ahora = ahora or _ahora()
    granularidad, claves, desplazamientos = resolver_rango(horizonte, ahora, desde, hasta, granularidad)
    generacion = GeneracionPronostico.objects.create(
        origen=origen, iniciada_por=usuario, horizonte=horizonte, granularidad=granularidad,
        periodo_desde=claves[0].date(), periodo_hasta=claves[-1].date(),
    )

    try:
        with transaction.atomic():
            _generar_series(generacion, claves, desplazamientos, ahora)
            generacion.estado = GeneracionPronostico.ESTADO_EXITOSA
            generacion.fecha_fin = timezone.now()
            generacion.save()
    except Exception as exc:
        logger.exception('Falló la generación de pronósticos #%s', generacion.pk)
        generacion.refresh_from_db()
        generacion.estado = GeneracionPronostico.ESTADO_FALLIDA
        generacion.mensaje_error = str(exc) or exc.__class__.__name__
        generacion.fecha_fin = timezone.now()
        generacion.save(update_fields=['estado', 'mensaje_error', 'fecha_fin'])

    return generacion


def generar_estandar(origen, usuario=None):
    """Las tres generaciones estándar; si una falla, las demás siguen."""
    return [generar(horizonte, origen, usuario=usuario) for horizonte in HORIZONTES_ESTANDAR]


# --- Consulta ------------------------------------------------------------------------


def generacion_vigente(horizonte):
    return (
        GeneracionPronostico.objects.filter(horizonte=horizonte, estado=GeneracionPronostico.ESTADO_EXITOSA)
        .order_by('-fecha_inicio', '-id').first()
    )


def pronostico_vigente(metrica, horizonte, producto=None, categoria=None, generacion=None):
    generacion = generacion or generacion_vigente(horizonte)
    if generacion is None:
        return None
    return generacion.pronosticos.filter(metrica=metrica, producto=producto, categoria=categoria).first()


def _clave_desde_fecha(fecha):
    return _a_local(fecha)


def valores_reales(metrica, granularidad, hasta, producto=None, categoria=None):
    """Serie real de una métrica `{clave: valor}` hasta `hasta` (exclusivo)."""

    if metrica in (Pronostico.METRICA_MONTO_VENTAS, Pronostico.METRICA_NUMERO_VENTAS):
        monto, numero = series.serie_ventas(granularidad, hasta)
        return monto if metrica == Pronostico.METRICA_MONTO_VENTAS else numero
    if metrica == Pronostico.METRICA_MONTO_CATEGORIA:
        return series.serie_por_categoria(granularidad, hasta).get(getattr(categoria, 'pk', categoria), {})
    if metrica == Pronostico.METRICA_UNIDADES_PRODUCTO:
        return series.serie_por_producto(granularidad, hasta).get(getattr(producto, 'pk', producto), {})

    nuevos, activos = series.serie_clientes(granularidad, hasta)
    if metrica == Pronostico.METRICA_CLIENTES_NUEVOS:
        return nuevos
    if metrica == Pronostico.METRICA_CLIENTES_ACTIVOS:
        return activos
    # Base acumulada: suma corrida de los nuevos.
    acumulado, base = CERO, {}
    for clave in series.claves_historial(granularidad, hasta):
        acumulado += nuevos.get(clave, CERO)
        base[clave] = acumulado
    return base


def historial_reciente(metrica, granularidad, cantidad, producto=None, categoria=None, ahora=None):
    """Últimos `cantidad` periodos completos de la serie real."""

    actual = clave_bucket(ahora or _ahora(), granularidad)
    claves = series.claves_historial(granularidad, actual)[-cantidad:]
    reales = valores_reales(metrica, granularidad, actual, producto, categoria)
    return [{'periodo_inicio': clave.date(), 'valor': reales.get(clave, CERO)} for clave in claves]


def precision_real(pronostico, ahora=None):
    """Compara los puntos ya transcurridos de un pronóstico contra lo real.
    `None` si todavía no transcurrió ninguno."""

    granularidad = pronostico.generacion.granularidad
    actual = clave_bucket(ahora or _ahora(), granularidad)
    transcurridos = [
        punto for punto in pronostico.puntos.order_by('periodo_inicio')
        if siguiente_clave(_clave_desde_fecha(punto.periodo_inicio), granularidad) <= actual
    ]
    if not transcurridos:
        return None
    reales = valores_reales(pronostico.metrica, granularidad, actual, pronostico.producto, pronostico.categoria)
    filas = [
        {
            'periodo_inicio': punto.periodo_inicio, 'pronosticado': punto.valor,
            'real': reales.get(_clave_desde_fecha(punto.periodo_inicio), CERO),
        }
        for punto in transcurridos
    ]
    return {
        'generacion': pronostico.generacion_id,
        'puntos': filas,
        'wape': modelo.wape([f['real'] for f in filas], [f['pronosticado'] for f in filas]),
    }


def ultima_precision(metrica, horizonte, producto=None, categoria=None, ahora=None):
    """Precisión real de la generación más reciente de ese horizonte que ya
    tenga algún periodo transcurrido."""

    for generacion in GeneracionPronostico.objects.filter(
        horizonte=horizonte, estado=GeneracionPronostico.ESTADO_EXITOSA,
    ).order_by('-fecha_inicio', '-id')[:20]:
        pronostico = pronostico_vigente(metrica, horizonte, producto, categoria, generacion=generacion)
        if pronostico is None or pronostico.estado != Pronostico.ESTADO_GENERADO:
            continue
        precision = precision_real(pronostico, ahora)
        if precision is not None:
            return precision
    return None


def proyeccion_dashboard(periodo, ahora=None):
    """Ventas reales del periodo actual del Dashboard (todas, alcance admin)
    + los puntos del pronóstico vigente que caen en sus periodos restantes:
    diario para "semana" y "mes", mensual para "año"."""

    ahora = ahora or _ahora()
    inicio_dia = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    if periodo == PERIODO_SEMANA:
        inicio, granularidad = inicio_dia - timedelta(days=ahora.weekday()), DIA
        fin = inicio + timedelta(days=7)
    elif periodo == PERIODO_MES:
        inicio, granularidad = inicio_dia.replace(day=1), DIA
        fin = siguiente_clave(inicio, MES)
    elif periodo == PERIODO_ANIO:
        inicio, granularidad = inicio_dia.replace(month=1, day=1), MES
        fin = inicio.replace(year=inicio.year + 1)
    else:
        raise ValueError(f'La proyección no aplica al periodo {periodo!r}.')

    ventas = Venta.objects.filter(estado__in=ESTADOS_VENTA_CUENTAN, fecha__gte=inicio, fecha__lte=ahora)
    totales = {}
    for fecha, total in ventas.values_list('fecha', 'total'):
        clave = clave_bucket(timezone.localtime(fecha), granularidad)
        totales[clave] = totales.get(clave, CERO) + total
    real = []
    cursor = inicio
    actual = clave_bucket(ahora, granularidad)
    while cursor <= actual:
        real.append({'periodo_inicio': cursor.date(), 'valor': totales.get(cursor, CERO)})
        cursor = siguiente_clave(cursor, granularidad)

    horizonte = GeneracionPronostico.HORIZONTE_DIAS_7 if granularidad == DIA else GeneracionPronostico.HORIZONTE_MESES_3
    pronostico = pronostico_vigente(Pronostico.METRICA_MONTO_VENTAS, horizonte)
    proyeccion = []
    if pronostico is not None and pronostico.estado == Pronostico.ESTADO_GENERADO:
        proyeccion = [
            {
                'periodo_inicio': punto.periodo_inicio, 'valor': punto.valor,
                'limite_inferior': punto.limite_inferior, 'limite_superior': punto.limite_superior,
            }
            for punto in pronostico.puntos.filter(
                periodo_inicio__gt=actual.date(), periodo_inicio__lt=fin.date(),
            ).order_by('periodo_inicio')
        ]
    return {
        'granularidad': granularidad,
        'real': real,
        'proyeccion': proyeccion,
        'generacion_fecha': pronostico.generacion.fecha_inicio if pronostico else None,
    }


def demanda_pronosticada(horizonte, limite=None, generacion=None):
    """Productos con su demanda pronosticada del horizonte (o de una
    generación concreta) frente a su stock total actual (suma de
    sucursales), de mayor a menor demanda."""

    generacion = generacion or generacion_vigente(horizonte)
    if generacion is None:
        return {'generacion': None, 'productos': []}

    pronosticos = list(
        generacion.pronosticos.filter(
            metrica=Pronostico.METRICA_UNIDADES_PRODUCTO, estado=Pronostico.ESTADO_GENERADO,
        ).select_related('producto').order_by('-total_pronosticado', 'producto__nombre_producto'),
    )
    if limite:
        pronosticos = pronosticos[:limite]
    stock = dict(
        InventarioSucursalProducto.objects.filter(producto__in=[p.producto_id for p in pronosticos])
        .values('producto').annotate(total=Sum('stock_actual')).values_list('producto', 'total'),
    )
    productos = []
    for pronostico in pronosticos:
        stock_total = stock.get(pronostico.producto_id) or CERO
        productos.append({
            'producto': pronostico.producto_id,
            'producto_nombre': pronostico.producto.nombre_producto,
            'unidades': pronostico.total_pronosticado,
            'limite_inferior': pronostico.total_inferior,
            'limite_superior': pronostico.total_superior,
            'wape': pronostico.wape,
            'precision': modelo.etiqueta_precision(pronostico.wape),
            'stock_total': stock_total,
            'insuficiente': pronostico.total_pronosticado > stock_total,
        })
    return {'generacion': generacion, 'productos': productos}
