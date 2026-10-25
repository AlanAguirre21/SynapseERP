"""Orquestación del asistente — `024`. Recibe un texto escrito o un botón
pulsado, decide el nodo del árbol (con el clasificador solo para texto),
arma la respuesta y registra el intercambio (`MensajeAsistente`).

Nunca lanza un error al usuario: si el clasificador no está disponible
pasa a "solo botones"; si un cálculo falla, responde que no pudo.
"""

import logging
import re
from decimal import Decimal

from django.utils import timezone

from . import arbol, clasificador, periodos, respuestas
from .catalogo import INTENCIONES, VERSION_CATALOGO
from .models import MensajeAsistente

logger = logging.getLogger(__name__)

# Horizonte de un pronóstico desde el texto (reglas, igual que los periodos).
_REGLAS_HORIZONTE = [
    ('meses_3', r'trimestre|3 meses|tres meses|proximos meses|meses que vienen'),
    ('semanas_4', r'proximo mes|mes que viene|siguiente mes|4 semanas|cuatro semanas|proximas semanas'),
    ('dias_7', r'proxima semana|semana que viene|siguiente semana|7 dias|siete dias|proximos dias'),
]


def detectar_horizonte(texto_normalizado):
    for horizonte, patron in _REGLAS_HORIZONTE:
        if re.search(rf'\b(?:{patron})\b', texto_normalizado):
            return horizonte
    return None


def _respuesta(texto, botones=None, enlace=None, datos=None):
    return {'texto': texto, 'botones': botones or [], 'enlace': enlace, 'datos': datos or {}}


def _menu(usuario, texto=None):
    return _respuesta(texto or '¿Sobre qué quieres saber?', arbol.botones_menu(usuario.rol_usuario))


def _no_disponible():
    return _respuesta('Esa información no está disponible para tu rol.', [arbol.boton_menu()])


def _responder_consulta(usuario, intencion, detalle, ahora):
    """Respuesta de un nodo `consulta:…`: pide el periodo/horizonte si falta,
    o calcula. Devuelve `(respuesta, nodo, periodo, desde, hasta)`."""

    if not arbol.permitido(intencion, usuario.rol_usuario):
        return _no_disponible(), f'consulta:{intencion}', '', None, None

    etiqueta = INTENCIONES[intencion]['etiqueta']
    if arbol.es_pronostico(intencion):
        if detalle is None:
            return (_respuesta(f'{etiqueta}: ¿para qué horizonte?',
                               [*arbol.botones_horizonte(intencion), arbol.boton_menu()]),
                    f'consulta:{intencion}', '', None, None)
        respuesta = respuestas.con_menu(respuestas.CON_HORIZONTE[intencion](usuario, detalle))
        return respuesta, f'consulta:{intencion}:{detalle}', detalle, None, None

    if detalle is None:
        return (_respuesta(f'{etiqueta}: ¿de qué periodo?', [*arbol.botones_periodo(intencion), arbol.boton_menu()]),
                f'consulta:{intencion}', '', None, None)
    desde, hasta = periodos.rango_de(detalle, ahora)
    respuesta = respuestas.con_menu(respuestas.CON_PERIODO[intencion](usuario, detalle, desde, hasta))
    return respuesta, f'consulta:{intencion}:{detalle}', detalle, desde, hasta


def _por_nodo(usuario, nodo, ahora):
    analizado = arbol.analizar_nodo(nodo)
    if analizado is None:
        return _menu(usuario, 'No reconozco esa opción. ¿Sobre qué quieres saber?'), 'menu', '', None, None
    tipo, valor, detalle = analizado
    rol = usuario.rol_usuario
    if tipo == 'menu':
        return _menu(usuario), 'menu', '', None, None
    if tipo == 'ayuda':
        return _respuesta(arbol.texto_ayuda(rol), arbol.botones_menu(rol)), 'ayuda', '', None, None
    if tipo == 'tema':
        if rol not in arbol.TEMAS[valor]['roles']:
            return _no_disponible(), nodo, '', None, None
        return (_respuesta(f'{arbol.TEMAS[valor]["etiqueta"]}: ¿qué quieres consultar?',
                           [*arbol.botones_tema(valor, rol), arbol.boton_menu()]), nodo, '', None, None)
    return _responder_consulta(usuario, valor, detalle, ahora)


def _sugerencias(clasificacion, periodo):
    botones = []
    for alternativa in clasificacion['alternativas']:
        intencion = alternativa['intencion']
        nodo = f'consulta:{intencion}'
        if periodo and not arbol.es_pronostico(intencion) and INTENCIONES[intencion]['requiere_periodo']:
            nodo += f':{periodo}'
        if intencion in ('menu', 'ayuda'):
            nodo = intencion
        botones.append(arbol.boton(INTENCIONES[intencion]['etiqueta'], nodo))
    return botones


def procesar(usuario, conversacion, texto=None, nodo=None, ahora=None):
    """Procesa un mensaje y lo registra. Devuelve `(mensaje, respuesta)`."""

    ahora = ahora or timezone.localtime()
    registro = {
        'conversacion': conversacion, 'version_catalogo': VERSION_CATALOGO,
        'modo': MensajeAsistente.MODO_SEMANTICO, 'alternativas': [],
    }

    try:
        if nodo is not None:
            registro.update(entrada_tipo=MensajeAsistente.ENTRADA_BOTON, nodo_solicitado=nodo,
                            confianza=MensajeAsistente.CONFIANZA_BOTON)
            respuesta, nodo_respuesta, periodo, desde, hasta = _por_nodo(usuario, nodo, ahora)
            intencion = nodo_respuesta.split(':')[1] if nodo_respuesta.startswith('consulta:') else ''
        else:
            registro.update(entrada_tipo=MensajeAsistente.ENTRADA_TEXTO, entrada_texto=texto)
            respuesta, nodo_respuesta, periodo, desde, hasta, intencion = _por_texto(usuario, texto, ahora, registro)
    except Exception:
        logger.exception('Falló el asistente procesando %r / %r', texto, nodo)
        respuesta = _respuesta('No pude calcular eso ahora. Intenta de nuevo en un momento.', [arbol.boton_menu()])
        nodo_respuesta, periodo, desde, hasta, intencion = 'error', '', None, None, registro.get('intencion', '')
        registro.setdefault('entrada_tipo', MensajeAsistente.ENTRADA_BOTON if nodo else MensajeAsistente.ENTRADA_TEXTO)
        registro.setdefault('confianza', MensajeAsistente.CONFIANZA_BOTON if nodo else MensajeAsistente.CONFIANZA_BAJA)

    registro.update(
        intencion=intencion, periodo=periodo or '', periodo_desde=desde, periodo_hasta=hasta,
        nodo_respuesta=nodo_respuesta, respuesta_texto=respuesta['texto'], respuesta_datos=respuesta['datos'],
    )
    mensaje = MensajeAsistente.objects.create(**registro)
    respuesta['modo'] = registro['modo']
    return mensaje, respuesta


def _por_texto(usuario, texto, ahora, registro):
    periodo, restante = periodos.detectar_periodo(texto or '')
    try:
        clasificacion = clasificador.clasificar(restante or periodos.normalizar(texto or ''), usuario.rol_usuario)
    except clasificador.ClasificadorNoDisponible:
        registro.update(modo=MensajeAsistente.MODO_SOLO_ARBOL, confianza=MensajeAsistente.CONFIANZA_BAJA)
        respuesta = _menu(usuario, 'La búsqueda por texto no está disponible en este momento; usa los botones.')
        return respuesta, 'menu', periodo, None, None, ''

    confianza = clasificacion['confianza']
    registro.update(
        confianza=confianza,
        puntuacion=Decimal(str(round(clasificacion['puntuacion'], 4))),
        alternativas=clasificacion['alternativas'],
    )
    intencion = clasificacion['intencion']

    if confianza == clasificador.ALTA:
        if intencion in ('menu', 'ayuda'):
            respuesta, nodo, *_ = _por_nodo(usuario, intencion, ahora)
            return respuesta, nodo, '', None, None, intencion
        detalle = (detectar_horizonte(periodos.normalizar(texto)) if arbol.es_pronostico(intencion) else periodo)
        respuesta, nodo, periodo_usado, desde, hasta = _responder_consulta(usuario, intencion, detalle, ahora)
        return respuesta, nodo, periodo_usado, desde, hasta, intencion

    if confianza == clasificador.MEDIA:
        respuesta = _respuesta('No estoy seguro de haber entendido. ¿Quisiste decir…?',
                               [*_sugerencias(clasificacion, periodo), arbol.boton_menu()])
        return respuesta, 'sugerencias', periodo, None, None, intencion

    respuesta = _respuesta(
        'No entendí la pregunta. Puedo darte información de ventas, compras y más; elige una opción o pide ayuda.',
        arbol.botones_menu(usuario.rol_usuario),
    )
    return respuesta, 'menu', periodo, None, None, ''
