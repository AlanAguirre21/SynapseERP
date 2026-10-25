"""Árbol de decisión del asistente — núcleo determinista de `024`.

Los nodos se identifican con texto:
- `menu`, `ayuda`
- `tema:<tema>`                        → consultas de ese tema
- `consulta:<intencion>`               → pide el periodo (o el horizonte)
- `consulta:<intencion>:<periodo>`     → respuesta con datos
- `consulta:<intencion>:<horizonte>`   → respuesta de pronóstico

Los botones navegan el árbol directamente, sin clasificador. Cada nodo se
filtra por rol aquí Y se vuelve a comprobar en `servicio.py`.
"""

from . import periodos
from .catalogo import INTENCIONES, TEMAS, intenciones_para_rol

HORIZONTES = {
    'dias_7': 'los próximos 7 días',
    'semanas_4': 'las próximas 4 semanas',
    'meses_3': 'los próximos 3 meses',
}


def boton(etiqueta, nodo):
    return {'etiqueta': etiqueta, 'nodo': nodo}


def boton_menu():
    return boton('Volver al menú', 'menu')


def es_pronostico(intencion):
    return INTENCIONES[intencion]['tema'] == 'pronosticos'


def permitido(intencion, rol):
    return intencion in INTENCIONES and rol in INTENCIONES[intencion]['roles']


def botones_menu(rol):
    botones = [boton(datos['etiqueta'], f'tema:{tema}') for tema, datos in TEMAS.items() if rol in datos['roles']]
    return [*botones, boton('¿Qué puedo preguntar?', 'ayuda')]


def botones_tema(tema, rol):
    return [
        boton(datos['etiqueta'], f'consulta:{intencion}')
        for intencion, datos in intenciones_para_rol(rol).items() if datos['tema'] == tema
    ]


def botones_periodo(intencion):
    return [boton(etiqueta.capitalize(), f'consulta:{intencion}:{clave}') for clave, etiqueta in periodos.ETIQUETAS.items()]


def botones_horizonte(intencion):
    return [boton(etiqueta.capitalize(), f'consulta:{intencion}:{clave}') for clave, etiqueta in HORIZONTES.items()]


def analizar_nodo(nodo):
    """`(tipo, valor, detalle)`: ('menu'|'ayuda'|'tema'|'consulta', …).
    `None` si el nodo no existe."""

    partes = (nodo or '').split(':')
    if partes == ['menu'] or partes == ['ayuda']:
        return partes[0], None, None
    if len(partes) == 2 and partes[0] == 'tema' and partes[1] in TEMAS:
        return 'tema', partes[1], None
    if partes[0] == 'consulta' and len(partes) in (2, 3) and partes[1] in INTENCIONES:
        detalle = partes[2] if len(partes) == 3 else None
        validos = HORIZONTES if es_pronostico(partes[1]) else periodos.ETIQUETAS
        if detalle is not None and detalle not in validos:
            return None
        return 'consulta', partes[1], detalle
    return None


def texto_ayuda(rol):
    temas = [datos['etiqueta'].lower() for datos in TEMAS.values() if rol in datos['roles']]
    return (
        f'Puedo darte información de {", ".join(temas[:-1])} y {temas[-1]}. '
        'Escribe tu pregunta (por ejemplo «¿cuánto vendimos esta semana?» o «¿qué productos se venden más?») o usa '
        'los botones. Periodos que entiendo: hoy, ayer, esta semana, la semana pasada, este mes, el mes pasado y este '
        'año. Solo consulto información: no registro ni modifico nada.'
    )
