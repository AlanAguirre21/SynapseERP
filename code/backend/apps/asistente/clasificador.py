"""Clasificador de intención por similitud semántica — capa de IA de `024`.

Calcula el *embedding* de la pregunta con un modelo ONNX local
(`fastembed`, sin GPU; el texto nunca sale del servidor) y lo compara por
similitud coseno contra los ejemplos indexados de las intenciones que el rol
puede usar. Solo elige a qué nodo del árbol ir: nunca redacta respuestas.

Decisión (umbrales calibrados con `evaluar_asistente`, ver `tasks.md`):
- alta  → puntuación ≥ UMBRAL_ALTO y ventaja ≥ MARGEN sobre la segunda;
- media → puntuación ≥ UMBRAL_BAJO (se ofrecen las 3 más cercanas);
- baja  → el resto (menú y ayuda).

El modelo y el índice se cargan una sola vez por proceso.
"""

import logging
import threading

from django.conf import settings

from .catalogo import VERSION_CATALOGO, intenciones_para_rol
from .models import EjemploIndexado

logger = logging.getLogger(__name__)

ALTA, MEDIA, BAJA = 'alta', 'media', 'baja'

_candado = threading.Lock()
_modelo = None
_indice = None  # (matriz normalizada, lista de intenciones por fila)


class ClasificadorNoDisponible(Exception):
    """El modelo o el índice no se pudieron cargar: el asistente sigue en
    modo "solo botones"."""


def nombre_modelo():
    return settings.ASISTENTE_MODELO_EMBEDDINGS


def cargar_modelo():
    """El modelo de `fastembed`; lo descarga a `ASISTENTE_CACHE_MODELOS` la
    primera vez (en producción, durante el despliegue con
    `indexar_intenciones`, nunca en una petición de usuario)."""

    global _modelo
    if _modelo is None:
        with _candado:
            if _modelo is None:
                try:
                    from fastembed import TextEmbedding
                    _modelo = TextEmbedding(nombre_modelo(), cache_dir=str(settings.ASISTENTE_CACHE_MODELOS))
                except Exception as exc:
                    logger.exception('No se pudo cargar el modelo de embeddings')
                    raise ClasificadorNoDisponible(f'No se pudo cargar el modelo: {exc}') from exc
    return _modelo


def vectorizar(textos):
    """Vectores normalizados (norma 1) de los textos, como `numpy.ndarray`."""

    import numpy as np

    vectores = np.array(list(cargar_modelo().embed(list(textos))), dtype=np.float32)
    normas = np.linalg.norm(vectores, axis=1, keepdims=True)
    normas[normas == 0] = 1
    return vectores / normas


def _cargar_indice():
    global _indice
    if _indice is None:
        import numpy as np

        filas = list(EjemploIndexado.objects.values_list('intencion', 'vector', 'modelo', 'version_catalogo'))
        if not filas:
            raise ClasificadorNoDisponible('El índice de intenciones está vacío: corre `indexar_intenciones`.')
        if any(modelo != nombre_modelo() or version != VERSION_CATALOGO for _, _, modelo, version in filas):
            raise ClasificadorNoDisponible(
                'El índice de intenciones está desactualizado (otro modelo o versión del catálogo): '
                'corre `indexar_intenciones`.',
            )
        matriz = np.vstack([np.frombuffer(bytes(vector), dtype=np.float32) for _, vector, _, _ in filas])
        _indice = (matriz, [intencion for intencion, _, _, _ in filas])
    return _indice


def reiniciar():
    """Olvida el índice en memoria (tras reindexar o en pruebas)."""
    global _indice
    _indice = None


def clasificar(texto, rol):
    """`{intencion, puntuacion, alternativas, confianza}` para el texto (ya
    normalizado y sin expresión de periodo), considerando solo las
    intenciones permitidas para `rol`."""

    permitidas = set(intenciones_para_rol(rol))
    matriz, intenciones = _cargar_indice()
    try:
        consulta = vectorizar([texto])[0]
    except ClasificadorNoDisponible:
        raise
    except Exception as exc:
        logger.exception('Falló el cálculo del embedding')
        raise ClasificadorNoDisponible(f'No se pudo procesar la pregunta: {exc}') from exc

    similitudes = matriz @ consulta
    mejores = {}
    for intencion, similitud in zip(intenciones, similitudes, strict=True):
        if intencion in permitidas and similitud > mejores.get(intencion, -1.0):
            mejores[intencion] = float(similitud)
    if not mejores:
        return {'intencion': None, 'puntuacion': 0.0, 'alternativas': [], 'confianza': BAJA}

    orden = sorted(mejores.items(), key=lambda par: par[1], reverse=True)
    intencion, puntuacion = orden[0]
    ventaja = puntuacion - (orden[1][1] if len(orden) > 1 else 0.0)
    if puntuacion >= settings.ASISTENTE_UMBRAL_ALTO and ventaja >= settings.ASISTENTE_MARGEN:
        confianza = ALTA
    elif puntuacion >= settings.ASISTENTE_UMBRAL_BAJO:
        confianza = MEDIA
    else:
        confianza = BAJA

    return {
        'intencion': intencion,
        'puntuacion': puntuacion,
        'alternativas': [{'intencion': i, 'puntuacion': round(p, 4)} for i, p in orden[:3]],
        'confianza': confianza,
    }
