"""Modelo de pronóstico — `023 · Analítica predictiva`. Funciones puras
sobre listas de `Decimal`, sin acceso a la base de datos: tendencia lineal
por mínimos cuadrados × índice estacional, con un rango esperado a partir de
la dispersión de los residuos y un error de validación (WAPE).

Las posiciones del ciclo estacional las calcula quien llama (día de la
semana, mes del año); aquí solo son enteros.
"""

from decimal import ROUND_HALF_UP, Decimal, localcontext

CERO = Decimal(0)
UNO = Decimal(1)
CENTAVO = Decimal('0.01')
# ± 1.28 desviaciones estándar ≈ rango que contiene el 80 % de los casos.
Z_RANGO = Decimal('1.28')

UMBRAL_PRECISION_ALTA = Decimal('0.20')
UMBRAL_PRECISION_MEDIA = Decimal('0.40')


def redondear(valor):
    return valor.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def ajustar_tendencia(valores):
    """`(pendiente, intercepto)` de la recta de mínimos cuadrados sobre
    x = 0..n-1. Con un solo punto la pendiente es 0."""

    n = len(valores)
    if n == 0:
        return CERO, CERO
    with localcontext() as contexto:
        contexto.prec = 28
        dn = Decimal(n)
        suma_x = Decimal(n * (n - 1) // 2)
        suma_x2 = Decimal((n - 1) * n * (2 * n - 1) // 6)
        suma_y = sum(valores, CERO)
        suma_xy = sum((Decimal(x) * y for x, y in enumerate(valores)), CERO)
        denominador = dn * suma_x2 - suma_x * suma_x
        pendiente = CERO if denominador == 0 else (dn * suma_xy - suma_x * suma_y) / denominador
        intercepto = (suma_y - pendiente * suma_x) / dn
        return pendiente, intercepto


def _tendencia(pendiente, intercepto, x):
    return intercepto + pendiente * Decimal(x)


def indices_estacionales(valores, posiciones, pendiente, intercepto):
    """Índice promedio por posición del ciclo (valor ÷ tendencia),
    normalizado para que promedie 1. Los puntos con tendencia ≤ 0 no aportan;
    una posición sin datos toma índice 1."""

    with localcontext() as contexto:
        contexto.prec = 28
        razones = {}
        for x, (valor, posicion) in enumerate(zip(valores, posiciones, strict=True)):
            tendencia = _tendencia(pendiente, intercepto, x)
            if tendencia > 0:
                razones.setdefault(posicion, []).append(valor / tendencia)

        indices = {posicion: sum(lista, CERO) / Decimal(len(lista)) for posicion, lista in razones.items()}
        if not indices:
            return {}
        promedio = sum(indices.values(), CERO) / Decimal(len(indices))
        if promedio <= 0:
            return {}
        return {posicion: indice / promedio for posicion, indice in indices.items()}


def ajustar(valores, posiciones=None):
    """Ajusta el modelo. `posiciones=None` = solo tendencia. Devuelve un
    dict con lo necesario para pronosticar."""

    pendiente, intercepto = ajustar_tendencia(valores)
    indices = indices_estacionales(valores, posiciones, pendiente, intercepto) if posiciones else {}

    with localcontext() as contexto:
        contexto.prec = 28
        ajustados = [
            _tendencia(pendiente, intercepto, x) * indices.get(posiciones[x], UNO) if posiciones
            else _tendencia(pendiente, intercepto, x)
            for x in range(len(valores))
        ]
        residuos = [valor - ajustado for valor, ajustado in zip(valores, ajustados, strict=True)]
        if len(residuos) > 1:
            varianza = sum((r * r for r in residuos), CERO) / Decimal(len(residuos) - 1)
            desviacion = varianza.sqrt()
        else:
            desviacion = CERO

    return {
        'pendiente': pendiente, 'intercepto': intercepto, 'indices': indices, 'desviacion': desviacion,
        'estacional': bool(indices),
    }


def pronosticar(ajuste, xs, posiciones=None):
    """Puntos `{valor, inferior, superior}` para cada x futuro (índices
    continuos con el historial). Nada es negativo."""

    puntos = []
    with localcontext() as contexto:
        contexto.prec = 28
        # Valor y margen se redondean una sola vez, para que el rango sea simétrico.
        margen = redondear(Z_RANGO * ajuste['desviacion'])
        for i, x in enumerate(xs):
            valor = _tendencia(ajuste['pendiente'], ajuste['intercepto'], x)
            if posiciones is not None and ajuste['indices']:
                valor *= ajuste['indices'].get(posiciones[i], UNO)
            valor = redondear(max(valor, CERO))
            puntos.append({'valor': valor, 'inferior': max(valor - margen, CERO), 'superior': valor + margen})
    return puntos


def margen_total(ajuste, cantidad_periodos):
    """Margen del total del horizonte, suponiendo errores independientes:
    1.28 × σ × √h."""

    with localcontext() as contexto:
        contexto.prec = 28
        return redondear(Z_RANGO * ajuste['desviacion'] * Decimal(cantidad_periodos).sqrt())


def wape(reales, pronosticados):
    """Σ|real − pronóstico| ÷ Σ real. `None` si no hubo nada real que medir."""

    with localcontext() as contexto:
        contexto.prec = 28
        total_real = sum(reales, CERO)
        if total_real <= 0:
            return None
        error = sum((abs(r - p) for r, p in zip(reales, pronosticados, strict=True)), CERO)
        return (error / total_real).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)


def etiqueta_precision(valor_wape):
    if valor_wape is None:
        return None
    if valor_wape <= UMBRAL_PRECISION_ALTA:
        return 'alta'
    if valor_wape <= UMBRAL_PRECISION_MEDIA:
        return 'media'
    return 'baja'


def validar(valores, posiciones, cantidad, minimo):
    """Reserva los últimos `cantidad` periodos, ajusta con el resto y mide
    el WAPE contra lo real. `None` si el resto queda bajo el mínimo."""

    if cantidad <= 0 or len(valores) - cantidad < minimo:
        return None
    entrenamiento = valores[:-cantidad]
    posiciones_entrenamiento = posiciones[:-cantidad] if posiciones else None
    ajuste = ajustar(entrenamiento, posiciones_entrenamiento)
    xs = list(range(len(entrenamiento), len(valores)))
    posiciones_prueba = posiciones[-cantidad:] if posiciones else None
    puntos = pronosticar(ajuste, xs, posiciones_prueba)
    return wape(valores[-cantidad:], [p['valor'] for p in puntos])
