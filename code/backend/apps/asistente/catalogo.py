"""Catálogo de intenciones del asistente — `024 · Asistente conversacional`.

Fuente única de qué puede responder el asistente. Las frases de ejemplo
alimentan el clasificador semántico (`indexar_intenciones` calcula sus
vectores). Cambiar o ampliar ejemplos requiere subir `VERSION_CATALOGO`,
volver a indexar y que el test de evaluación siga en ≥ 90 %.
"""

from core.permissions import ROL_ADMIN, ROL_OPERADOR

VERSION_CATALOGO = '2026.10-2'

TODOS = (ROL_ADMIN, ROL_OPERADOR)
SOLO_ADMIN = (ROL_ADMIN,)

INTENCIONES = {
    'ventas_total': {
        'etiqueta': 'Total vendido',
        'tema': 'ventas',
        'roles': TODOS,
        'requiere_periodo': True,
        'ejemplos': [
            'cuánto vendimos', 'cuánto se vendió', 'total de ventas', 'monto vendido', 'cuánto dinero entró por ventas',
            'cuánto llevamos vendido', 'importe de las ventas', 'cuánta lana hicimos vendiendo', 'cómo van las ventas en dinero',
            'suma de lo vendido', 'ingresos por ventas', 'cuánto facturamos en ventas', 'dime el total vendido',
            'cuánto he vendido', 'qué tanto vendimos', 'monto total de ventas', 'cuánto sacamos de ventas',
            'ventas en pesos', 'cuál fue la venta total', 'cuánto vendí', 'cuánto dinero vendí', 'el dinero de las ventas',
            'cuánto se vendió en total en pesos',
        ],
    },
    'ventas_numero': {
        'etiqueta': 'Número de ventas',
        'tema': 'ventas',
        'roles': TODOS,
        'requiere_periodo': True,
        'ejemplos': [
            'cuántas ventas hubo', 'cuántas ventas hicimos', 'número de ventas', 'cantidad de ventas',
            'cuántas ventas llevo', 'cuántos tickets de venta', 'cuántas operaciones de venta', 'cuántas veces vendimos',
            'conteo de ventas', 'cuántas ventas se registraron', 'qué tantas ventas hubo', 'cuántas ventas he registrado',
            'número de tickets', 'cuántas notas de venta', 'cuántas ventas van', 'total de ventas registradas en número',
        ],
    },
    'ventas_top_productos': {
        'etiqueta': 'Productos más vendidos',
        'tema': 'ventas',
        'roles': TODOS,
        'requiere_periodo': True,
        'ejemplos': [
            'qué productos se vendieron más', 'productos más vendidos', 'cuál es el producto que más se vende',
            'top de productos', 'qué se vendió más', 'los productos estrella', 'ranking de productos vendidos',
            'qué producto salió más', 'cuáles productos tienen más ventas', 'lo más vendido', 'mejores productos en ventas',
            'qué artículos se venden más', 'producto con más unidades vendidas', 'qué es lo que más compran los clientes',
            'los cinco productos más vendidos', 'qué se está vendiendo más', 'el producto con más salida',
            'qué productos se vendieron en mayor cantidad', 'cuál fue el artículo más vendido',
        ],
    },
    'ventas_top_clientes': {
        'etiqueta': 'Clientes con más compras',
        'tema': 'ventas',
        'roles': TODOS,
        'requiere_periodo': True,
        'ejemplos': [
            'quiénes son los mejores clientes', 'clientes que más compran', 'top de clientes', 'qué cliente compró más',
            'ranking de clientes', 'clientes más frecuentes', 'quién nos compra más', 'mejores clientes',
            'cuál es el cliente que más gasta', 'clientes con más compras', 'a quién le vendimos más',
            'los cinco mejores clientes', 'qué clientes compraron más', 'clientes principales', 'quién es nuestro mejor cliente',
            'a qué clientes les vendí más', 'qué cliente nos dejó más dinero',
        ],
    },
    'ganancia_periodo': {
        'etiqueta': 'Ganancia',
        'tema': 'ganancias',
        'roles': SOLO_ADMIN,
        'requiere_periodo': True,
        'ejemplos': [
            'cuánto ganamos', 'cuál fue la ganancia', 'utilidad', 'ganancias', 'cuánto nos quedó',
            'ventas menos compras', 'cuál es la ganancia neta', 'cómo vamos de ganancias', 'cuánto dinero ganamos',
            'margen del periodo', 'ganamos o perdimos', 'cuánto fue la utilidad', 'rentabilidad', 'beneficio obtenido',
            'qué tanto ganamos', 'cuál es el resultado del periodo', 'balance de ganancias', 'estamos ganando dinero',
        ],
    },
    'compras_total': {
        'etiqueta': 'Total comprado',
        'tema': 'compras',
        'roles': TODOS,
        'requiere_periodo': True,
        'ejemplos': [
            'cuánto compramos', 'cuánto se gastó en compras', 'total de compras', 'monto comprado', 'gasto en compras',
            'cuánto dinero salió por compras', 'cuánto le pagamos a proveedores', 'importe de las compras',
            'cuánto llevamos comprado', 'cuánto gastamos en mercancía', 'cuánto he comprado', 'compras en pesos',
            'suma de las compras', 'cuánto invertimos en compras', 'cuál fue el gasto en compras', 'cuánto compré',
            'el dinero gastado en compras', 'cuánto se compró en total en pesos',
        ],
    },
    'compras_numero': {
        'etiqueta': 'Número de compras',
        'tema': 'compras',
        'roles': TODOS,
        'requiere_periodo': True,
        'ejemplos': [
            'cuántas compras hubo', 'cuántas compras hicimos', 'número de compras', 'cantidad de compras',
            'cuántos pedidos a proveedores', 'cuántas órdenes de compra', 'cuántas compras registramos', 'conteo de compras',
            'cuántas veces compramos', 'cuántas compras llevo', 'qué tantas compras se hicieron', 'cuántos pedidos hicimos',
            'cuántas compras he registrado', 'número de pedidos de compra', 'cuántas compras van',
        ],
    },
    'compras_top_proveedores': {
        'etiqueta': 'Proveedores con más compras',
        'tema': 'compras',
        'roles': TODOS,
        'requiere_periodo': True,
        'ejemplos': [
            'a qué proveedor le compramos más', 'proveedores principales', 'top de proveedores', 'mejores proveedores',
            'ranking de proveedores', 'con qué proveedor gastamos más', 'quién es nuestro principal proveedor',
            'proveedores con más compras', 'a quién le compramos más', 'proveedores más usados', 'los cinco proveedores principales',
            'qué proveedor nos vende más', 'proveedor al que más le pagamos', 'de quién compramos más',
            'proveedores más importantes', 'en qué proveedor se fue más dinero', 'proveedor con el que más gastamos',
        ],
    },
    'pronostico_ventas': {
        'etiqueta': 'Pronóstico de ventas',
        'tema': 'pronosticos',
        'roles': SOLO_ADMIN,
        'requiere_periodo': False,
        'ejemplos': [
            'cuánto vamos a vender', 'pronóstico de ventas', 'cuánto se espera vender', 'proyección de ventas',
            'cuánto venderemos el próximo mes', 'predicción de ventas', 'estimado de ventas', 'cómo van a estar las ventas',
            'cuánto vamos a vender la próxima semana', 'ventas esperadas', 'qué ventas se esperan',
            'cuánto dinero vamos a vender', 'tendencia de ventas a futuro', 'proyección de ingresos por ventas',
            'pronóstico de cuántas ventas habrá', 'cómo se ven las ventas para adelante',
        ],
    },
    'pronostico_demanda': {
        'etiqueta': 'Demanda pronosticada',
        'tema': 'pronosticos',
        'roles': SOLO_ADMIN,
        'requiere_periodo': False,
        'ejemplos': [
            'qué productos se van a vender más', 'demanda de productos', 'qué productos vamos a necesitar',
            'pronóstico de demanda', 'qué se va a acabar', 'productos que se quedarán sin stock', 'qué tengo que comprar',
            'qué debo producir', 'demanda esperada por producto', 'qué productos van a tener más salida',
            'cuántas unidades vamos a vender', 'qué inventario va a faltar', 'proyección de demanda',
            'qué productos se van a agotar', 'qué conviene reabastecer', 'qué productos se van a vender más adelante',
            'qué voy a necesitar producir', 'qué pedirle a los proveedores para no quedarme sin inventario',
        ],
    },
    'pronostico_clientes': {
        'etiqueta': 'Crecimiento de clientes',
        'tema': 'pronosticos',
        'roles': SOLO_ADMIN,
        'requiere_periodo': False,
        'ejemplos': [
            'cuántos clientes nuevos vamos a tener', 'crecimiento de clientes', 'proyección de clientes',
            'cuántos clientes vamos a tener', 'cómo va a crecer la cartera de clientes', 'clientes nuevos esperados',
            'pronóstico de clientes', 'va a crecer la base de clientes', 'cuántos clientes activos habrá',
            'crecimiento de la cartera', 'tendencia de clientes nuevos', 'proyección de la base de clientes',
            'cuántos clientes ganaremos', 'estimado de clientes nuevos', 'clientes a futuro', 'cuántos clientes vamos a conseguir',
        ],
    },
    'menu': {
        'etiqueta': 'Menú principal',
        'tema': 'navegacion',
        'roles': TODOS,
        'requiere_periodo': False,
        'ejemplos': [
            'menú', 'menú principal', 'volver al inicio', 'empezar de nuevo', 'regresar', 'opciones', 'inicio',
            'qué opciones hay', 'volver', 'mostrar el menú', 'hola', 'buenos días', 'buenas tardes', 'qué tal',
            'hola asistente',
        ],
    },
    'ayuda': {
        'etiqueta': 'Ayuda',
        'tema': 'navegacion',
        'roles': TODOS,
        'requiere_periodo': False,
        'ejemplos': [
            'ayuda', 'qué puedo preguntarte', 'qué sabes hacer', 'cómo funcionas', 'para qué sirves',
            'qué preguntas puedo hacer', 'necesito ayuda', 'cómo te uso', 'qué temas conoces', 'qué información tienes',
            'en qué me puedes ayudar', 'instrucciones', 'cómo se usa el asistente', 'qué puedes responder',
            'dame ejemplos de preguntas',
        ],
    },
}

TEMAS = {
    'ventas': {'etiqueta': 'Ventas', 'roles': TODOS},
    'ganancias': {'etiqueta': 'Ganancias', 'roles': SOLO_ADMIN},
    'compras': {'etiqueta': 'Compras', 'roles': TODOS},
    'pronosticos': {'etiqueta': 'Pronósticos', 'roles': SOLO_ADMIN},
}


def intenciones_para_rol(rol):
    return {clave: datos for clave, datos in INTENCIONES.items() if rol in datos['roles']}


def ejemplos():
    """`[(intencion, texto)]` de todo el catálogo; falla si una frase está en
    dos intenciones (el clasificador no podría distinguirlas)."""

    vistos = {}
    pares = []
    for intencion, datos in INTENCIONES.items():
        for texto in datos['ejemplos']:
            clave = texto.strip().lower()
            if clave in vistos and vistos[clave] != intencion:
                raise ValueError(f'La frase «{texto}» está en «{vistos[clave]}» y en «{intencion}».')
            vistos[clave] = intencion
            pares.append((intencion, texto))
    return pares
