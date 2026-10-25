"""Conjunto de evaluación del clasificador — `024`. Frases DISTINTAS a los
ejemplos de `catalogo.py`, para medir cómo generaliza. Solo lo usan los
tests y `evaluar_asistente` (para calibrar los umbrales); no se indexa.
"""

EVALUACION = {
    'ventas_total': [
        '¿cuánto vendimos esta semana?', 'dame el monto de las ventas de hoy', 'cuánto dinero hicimos en ventas',
        'qué tal estuvieron las ventas en lana', 'total vendido el mes pasado', 'cuánto ingresó por ventas ayer',
        'necesito el importe total vendido', 'cuánto llevamos de venta este año', 'cuánto vendí hoy',
        'cuál es el monto de lo que vendimos',
    ],
    'ventas_numero': [
        '¿cuántas ventas se hicieron hoy?', 'cuántos tickets llevamos esta semana', 'número de ventas del mes pasado',
        'cuántas ventas registré ayer', 'qué cantidad de ventas hubo este mes', 'cuántas notas se hicieron',
        'cuántas ventas tuvimos en el año', 'dime cuántas ventas van', 'cuántas operaciones de venta registramos',
        'conteo de tickets de hoy',
    ],
    'ventas_top_productos': [
        '¿cuál fue el producto más vendido del mes?', 'qué productos tuvieron más salida', 'dame el top 5 de productos',
        'qué se vende más en la tienda', 'cuáles son los productos que más vendemos', 'producto más popular',
        'qué artículo vendió más unidades', 'los más vendidos de la semana', 'qué productos piden más los clientes',
        'lista de productos más vendidos',
    ],
    'ventas_top_clientes': [
        '¿quién fue el cliente que más compró?', 'dame los clientes que más nos compran', 'mejor cliente del mes',
        'qué clientes gastaron más', 'top 5 clientes', 'quiénes compran más seguido', 'clientes con mayores compras',
        'cliente número uno', 'a qué clientes les vendemos más', 'clientes más importantes del año',
    ],
    'ganancia_periodo': [
        '¿cuánto ganamos este mes?', 'cuál fue la utilidad de la semana', 'tuvimos ganancia ayer',
        'cuánto dinero nos quedó este año', 'cómo estuvo la ganancia del mes pasado', 'resultado de ventas menos compras',
        'cuánto es la utilidad neta', 'estamos en números negros', 'cuál es el margen de ganancia', 'ganancia de hoy',
    ],
    'compras_total': [
        '¿cuánto compramos esta semana?', 'cuánto gastamos con proveedores', 'monto de las compras del mes',
        'cuánto dinero se fue en compras', 'gasto total en compras de hoy', 'cuánto pagamos en mercancía el mes pasado',
        'importe comprado este año', 'cuánto compré ayer', 'cuál es el gasto de compras', 'total pagado en compras',
    ],
    'compras_numero': [
        '¿cuántas compras hicimos esta semana?', 'cuántos pedidos se hicieron a proveedores', 'número de compras del mes',
        'cuántas compras registré hoy', 'cantidad de órdenes de compra del año', 'cuántas compras llevamos',
        'cuántas veces le compramos a proveedores', 'conteo de pedidos de compra', 'cuántas compras hubo ayer',
        'qué cantidad de compras hicimos',
    ],
    'compras_top_proveedores': [
        '¿a qué proveedor le compramos más este mes?', 'principales proveedores del año', 'top 5 de proveedores',
        'con quién gastamos más en compras', 'qué proveedores son los más grandes', 'proveedor más importante',
        'a qué proveedores les pagamos más', 'cuál es el proveedor principal', 'ranking de proveedores del mes',
        'proveedores con mayor monto comprado',
    ],
    'pronostico_ventas': [
        '¿cuánto vamos a vender el mes que viene?', 'proyección de ventas para las próximas semanas',
        'cuánto se pronostica vender', 'cuál es la predicción de ventas', 'cómo se ven las ventas a futuro',
        'estimación de ventas del próximo trimestre', 'qué ventas esperamos', 'cuánto venderemos',
        'pronóstico de ingresos por ventas', 'cuánto se espera vender la próxima semana',
    ],
    'pronostico_demanda': [
        '¿qué productos se van a vender más el próximo mes?', 'qué productos me van a faltar',
        'qué debo reabastecer', 'demanda pronosticada de productos', 'qué productos se terminarán pronto',
        'cuánto vamos a necesitar de cada producto', 'qué producir la próxima semana', 'qué productos tendrán más demanda',
        'qué inventario se va a acabar', 'qué tengo que pedir a proveedores para no quedarme sin stock',
    ],
    'pronostico_clientes': [
        '¿cuántos clientes nuevos esperamos?', 'cómo crecerá nuestra base de clientes', 'proyección de clientes nuevos',
        'cuántos clientes vamos a ganar el próximo mes', 'tendencia de la cartera de clientes',
        'cuántos clientes tendremos al final del trimestre', 'pronóstico de crecimiento de clientes',
        'va a aumentar el número de clientes', 'clientes esperados a futuro', 'cuántos clientes activos tendremos',
    ],
    'menu': [
        'muéstrame el menú', 'quiero volver al menú', 'regresar al principio', 'hola, buenas', 'buenas noches',
        'ir al inicio', 'ver las opciones', 'menu', 'hola qué tal', 'empezar otra vez',
    ],
    'ayuda': [
        '¿qué cosas me puedes decir?', 'cómo te puedo usar', 'qué tipo de preguntas respondes', 'ayúdame',
        'no sé qué preguntar', 'qué puedes hacer por mí', 'explícame cómo funcionas', 'qué información me das',
        'ejemplos de lo que puedo preguntar', 'para qué te usan',
    ],
}

FUERA_DE_DOMINIO = [
    '¿qué clima hace hoy?', 'cuéntame un chiste', 'quién ganó el partido', 'cuál es la capital de Francia',
    'pon música', 'escríbeme un poema', 'cuánto es 2 más 2', 'qué hora es en Japón', 'recomiéndame una película',
    'cómo se hace un pastel', 'traduce esto al inglés', 'quién es el presidente', 'apaga la luz',
    'cuál es tu color favorito', 'dime una frase motivadora', 'cómo arreglo mi computadora',
    'qué noticias hay', 'agenda una cita con el doctor', 'cuánto mide el monte Everest', 'te quiero',
    'registra una venta de tres sueros', 'borra la última compra',
]
