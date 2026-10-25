"""Periodos del asistente — `024`. Reglas deterministas de palabras clave,
no del modelo: los *embeddings* distinguen temas, pero no "esta semana" de
"la semana pasada". El texto se normaliza (minúsculas, sin acentos) y las
reglas van de la más específica a la menos ("semana pasada" antes que
"semana").

`detectar_periodo()` devuelve además el texto SIN la expresión de periodo,
para que el clasificador juzgue solo el tema de la pregunta.
"""

import re
import unicodedata
from datetime import timedelta

from apps.reportes.services import clave_bucket

HOY = 'hoy'
AYER = 'ayer'
ESTA_SEMANA = 'esta_semana'
SEMANA_PASADA = 'semana_pasada'
ESTE_MES = 'este_mes'
MES_PASADO = 'mes_pasado'
ESTE_ANIO = 'este_anio'

ETIQUETAS = {
    HOY: 'hoy',
    AYER: 'ayer',
    ESTA_SEMANA: 'esta semana',
    SEMANA_PASADA: 'la semana pasada',
    ESTE_MES: 'este mes',
    MES_PASADO: 'el mes pasado',
    ESTE_ANIO: 'este año',
}
PERIODOS = list(ETIQUETAS)

# (periodo, patrón sobre texto normalizado). Orden: de más a menos específico.
_REGLAS = [
    (SEMANA_PASADA, r'(la )?semana (pasada|anterior)|(la )?ultima semana|(la )?pasada semana'),
    (MES_PASADO, r'(el )?mes (pasado|anterior)|(el )?ultimo mes|(el )?pasado mes'),
    (ESTA_SEMANA, r'(esta|la presente|en la) semana|(de|en) la semana( actual)?|semana actual|en lo que va de la semana'),
    (ESTE_MES, r'(este|el presente|en el) mes|(del|en el) mes( actual)?|mes actual|en lo que va del mes'),
    (ESTE_ANIO, r'(este|el presente|en el) ano|(del|en el) ano( actual)?|ano actual|en lo que va del ano'),
    (AYER, r'\bayer\b'),
    (HOY, r'\bhoy\b|\bel dia de hoy\b|\ben el dia\b'),
]
# Los periodos futuros no se quitan del texto: indican un pronóstico.
_FUTURO = re.compile(r'proxim[oa]s?|siguiente|que viene|vamos a|venider')


def normalizar(texto):
    """Minúsculas, sin acentos (conserva la ñ como n), sin signos, espacios simples."""

    sin_acentos = ''.join(
        c for c in unicodedata.normalize('NFD', texto.lower()) if unicodedata.category(c) != 'Mn'
    )
    solo_letras = re.sub(r'[^a-z0-9 ]+', ' ', sin_acentos)
    return re.sub(r'\s+', ' ', solo_letras).strip()


def detectar_periodo(texto):
    """`(periodo | None, texto_sin_periodo)`. Si la pregunta habla del futuro
    ("el próximo mes"), no se detecta periodo: es un pronóstico."""

    normal = normalizar(texto)
    if _FUTURO.search(normal):
        return None, normal
    for periodo, patron in _REGLAS:
        coincidencia = re.search(rf'\b(?:{patron})\b', normal)
        if coincidencia:
            restante = (normal[:coincidencia.start()] + ' ' + normal[coincidencia.end():]).strip()
            return periodo, re.sub(r'\s+', ' ', restante)
    return None, normal


def rango_de(periodo, ahora):
    """`(desde, hasta)` en hora local. Los periodos en curso terminan en
    `ahora`; los cerrados, en el último instante de ese periodo. Semanas de
    lunes a domingo, como en el Dashboard."""

    hoy = clave_bucket(ahora, 'dia')
    if periodo == HOY:
        return hoy, ahora
    if periodo == AYER:
        return hoy - timedelta(days=1), hoy - timedelta(microseconds=1)

    semana = clave_bucket(ahora, 'semana')
    if periodo == ESTA_SEMANA:
        return semana, ahora
    if periodo == SEMANA_PASADA:
        return semana - timedelta(days=7), semana - timedelta(microseconds=1)

    mes = clave_bucket(ahora, 'mes')
    if periodo == ESTE_MES:
        return mes, ahora
    if periodo == MES_PASADO:
        mes_anterior = (mes - timedelta(days=1)).replace(day=1)
        return mes_anterior, mes - timedelta(microseconds=1)

    if periodo == ESTE_ANIO:
        return mes.replace(month=1), ahora
    raise ValueError(f'Periodo desconocido: {periodo!r}')
