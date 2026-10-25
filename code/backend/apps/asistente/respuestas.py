"""Respuestas del asistente — `024`. Una función por intención: calcula con
los servicios que ya usan el Dashboard (`apps.reportes`) y Analítica
(`apps.analitica`), con el mismo alcance por rol, y llena una plantilla
fija. Ningún texto lo genera un modelo.

Cada función devuelve `{texto, datos, botones, enlace}`; `datos` guarda las
cifras usadas como texto decimal, para el registro de auditoría.
"""

from decimal import Decimal

from django.utils import timezone

from apps.analitica import services as analitica
from apps.analitica.models import Pronostico
from apps.reportes import services as reportes
from core.permissions import es_admin

from . import periodos
from .arbol import HORIZONTES, boton, boton_menu, botones_horizonte, botones_periodo

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre']
DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']


def moneda(valor):
    return f'${Decimal(valor):,.2f}'


def cantidad(valor):
    valor = Decimal(valor)
    return f'{valor:,.0f}' if valor == valor.to_integral_value() else f'{valor:,.2f}'


def fecha_corta(fecha):
    fecha = timezone.localtime(fecha) if hasattr(fecha, 'hour') else fecha
    return f'{DIAS[fecha.weekday()]} {fecha.day} de {MESES[fecha.month - 1]}'


def describir_rango(periodo, desde, hasta):
    if periodo in (periodos.HOY, periodos.AYER):
        return f'{periodos.ETIQUETAS[periodo]} ({fecha_corta(desde)})'
    return f'{periodos.ETIQUETAS[periodo]} (del {fecha_corta(desde)} al {fecha_corta(hasta)})'


def _texto_decimal(datos):
    return {clave: str(valor) if isinstance(valor, Decimal) else valor for clave, valor in datos.items()}


def _otros_periodos(intencion, actual):
    return [b for b in botones_periodo(intencion) if not b['nodo'].endswith(f':{actual}')][:3]


ENLACES = {
    'ventas': {'ruta': '/ventas', 'etiqueta': 'Abrir Ventas'},
    'compras': {'ruta': '/compras', 'etiqueta': 'Abrir Compras'},
    'ganancias': {'ruta': '/dashboard', 'etiqueta': 'Abrir el Dashboard'},
    'pronosticos': {'ruta': '/auditoria-analisis?pestana=pronosticos', 'etiqueta': 'Ver pronósticos'},
}


# --- Consultas con periodo -------------------------------------------------------


def _sujeto(usuario, propio, empresa):
    return empresa if es_admin(usuario) else propio


def ventas_total(usuario, periodo, desde, hasta):
    resumen = reportes.resumen_rango(desde, hasta, None if es_admin(usuario) else usuario)
    rango = describir_rango(periodo, desde, hasta)
    if resumen['ventas_numero'] == 0:
        texto = f'{_sujeto(usuario, "No registraste ventas", "No hubo ventas")} {rango}.'
    else:
        sujeto = _sujeto(usuario, 'Tus ventas', 'Ventas')
        texto = (f'{sujeto} de {rango}: {moneda(resumen["ventas_total"])} en '
                 f'{resumen["ventas_numero"]} venta(s) (sin contar las canceladas).')
    return {
        'texto': texto, 'datos': _texto_decimal(resumen),
        'botones': [*_otros_periodos('ventas_total', periodo), boton('Productos más vendidos',
                                                                     f'consulta:ventas_top_productos:{periodo}')],
        'enlace': ENLACES['ventas'],
    }


def ventas_numero(usuario, periodo, desde, hasta):
    resumen = reportes.resumen_rango(desde, hasta, None if es_admin(usuario) else usuario)
    rango = describir_rango(periodo, desde, hasta)
    numero = resumen['ventas_numero']
    if numero == 0:
        texto = f'{_sujeto(usuario, "No registraste ventas", "No hubo ventas")} {rango}.'
    else:
        texto = (f'{_sujeto(usuario, "Registraste", "Se registraron")} {numero} venta(s) {rango}, '
                 f'por {moneda(resumen["ventas_total"])}.')
    return {
        'texto': texto, 'datos': _texto_decimal(resumen),
        'botones': [*_otros_periodos('ventas_numero', periodo), boton('Total vendido', f'consulta:ventas_total:{periodo}')],
        'enlace': ENLACES['ventas'],
    }


def ventas_top_productos(usuario, periodo, desde, hasta):
    filas = reportes.top_productos_rango(desde, hasta, usuario=None if es_admin(usuario) else usuario)
    rango = describir_rango(periodo, desde, hasta)
    if not filas:
        texto = f'No hubo productos vendidos {rango}.'
    else:
        lista = '; '.join(f'{i}. {f["producto"]} ({cantidad(f["cantidad"])} u.)' for i, f in enumerate(filas, start=1))
        texto = f'{_sujeto(usuario, "Tus productos más vendidos", "Productos más vendidos")} de {rango}: {lista}.'
    return {
        'texto': texto,
        'datos': {'productos': [{'producto': f['producto'], 'cantidad': str(f['cantidad'])} for f in filas]},
        'botones': _otros_periodos('ventas_top_productos', periodo),
        'enlace': ENLACES['ventas'],
    }


def ventas_top_clientes(usuario, periodo, desde, hasta):
    admin = es_admin(usuario)
    # Mismo criterio que el Dashboard: el operador ve número de compras, no importes.
    por = reportes.TOP_CLIENTES_POR_MONTO if admin else reportes.TOP_CLIENTES_POR_COMPRAS
    filas = reportes.top_clientes_rango(desde, hasta, por=por, usuario=None if admin else usuario)
    rango = describir_rango(periodo, desde, hasta)
    if not filas:
        texto = f'No hubo ventas a clientes registrados {rango} (las ventas de mostrador no cuentan).'
    else:
        if admin:
            lista = '; '.join(f'{i}. {f["cliente"]} ({moneda(f["monto"])})' for i, f in enumerate(filas, start=1))
        else:
            lista = '; '.join(f'{i}. {f["cliente"]} ({f["compras"]} compra(s))' for i, f in enumerate(filas, start=1))
        texto = f'{_sujeto(usuario, "Tus clientes con más compras", "Clientes con más compras")} de {rango}: {lista}.'
    return {
        'texto': texto,
        'datos': {'clientes': [_texto_decimal(f) for f in filas]},
        'botones': _otros_periodos('ventas_top_clientes', periodo),
        'enlace': {'ruta': '/terceros', 'etiqueta': 'Abrir Terceros'},
    }


def ganancia_periodo(usuario, periodo, desde, hasta):
    resumen = reportes.resumen_rango(desde, hasta, None)
    rango = describir_rango(periodo, desde, hasta)
    ganancia = resumen['ganancia']
    signo = 'Ganancia' if ganancia >= 0 else 'Pérdida'
    texto = (f'{signo} de {rango}: {moneda(abs(ganancia))} (ventas {moneda(resumen["ventas_total"])} − compras '
             f'{moneda(resumen["compras_total"])}, la misma fórmula del Dashboard).')
    return {
        'texto': texto, 'datos': _texto_decimal(resumen),
        'botones': _otros_periodos('ganancia_periodo', periodo),
        'enlace': ENLACES['ganancias'],
    }


def compras_total(usuario, periodo, desde, hasta):
    resumen = reportes.resumen_rango(desde, hasta, None if es_admin(usuario) else usuario)
    rango = describir_rango(periodo, desde, hasta)
    if resumen['compras_numero'] == 0:
        texto = f'{_sujeto(usuario, "No registraste compras", "No hubo compras")} {rango}.'
    else:
        texto = (f'{_sujeto(usuario, "Tus compras", "Compras")} de {rango}: {moneda(resumen["compras_total"])} en '
                 f'{resumen["compras_numero"]} compra(s) (sin contar las canceladas).')
    return {
        'texto': texto, 'datos': _texto_decimal(resumen),
        'botones': [*_otros_periodos('compras_total', periodo),
                    boton('Proveedores principales', f'consulta:compras_top_proveedores:{periodo}')],
        'enlace': ENLACES['compras'],
    }


def compras_numero(usuario, periodo, desde, hasta):
    resumen = reportes.resumen_rango(desde, hasta, None if es_admin(usuario) else usuario)
    rango = describir_rango(periodo, desde, hasta)
    numero = resumen['compras_numero']
    if numero == 0:
        texto = f'{_sujeto(usuario, "No registraste compras", "No hubo compras")} {rango}.'
    else:
        texto = (f'{_sujeto(usuario, "Registraste", "Se registraron")} {numero} compra(s) {rango}, '
                 f'por {moneda(resumen["compras_total"])}.')
    return {
        'texto': texto, 'datos': _texto_decimal(resumen),
        'botones': [*_otros_periodos('compras_numero', periodo), boton('Total comprado', f'consulta:compras_total:{periodo}')],
        'enlace': ENLACES['compras'],
    }


def compras_top_proveedores(usuario, periodo, desde, hasta):
    filas = reportes.top_proveedores_rango(desde, hasta, usuario=None if es_admin(usuario) else usuario)
    rango = describir_rango(periodo, desde, hasta)
    if not filas:
        texto = f'{_sujeto(usuario, "No registraste compras", "No hubo compras")} {rango}.'
    else:
        lista = '; '.join(f'{i}. {f["proveedor"]} ({moneda(f["monto"])})' for i, f in enumerate(filas, start=1))
        texto = f'{_sujeto(usuario, "Tus proveedores principales", "Proveedores principales")} de {rango}: {lista}.'
    return {
        'texto': texto,
        'datos': {'proveedores': [_texto_decimal(f) for f in filas]},
        'botones': _otros_periodos('compras_top_proveedores', periodo),
        'enlace': ENLACES['compras'],
    }


# --- Pronósticos (solo admin) ------------------------------------------------------


def _cita(pronostico):
    generacion = pronostico.generacion
    precision = {'alta': 'alta', 'media': 'media', 'baja': 'baja'}.get(
        analitica.modelo.etiqueta_precision(pronostico.wape), None,
    )
    texto = f'según el pronóstico generado el {fecha_corta(generacion.fecha_inicio)}'
    if precision:
        porcentaje = max(0, round((1 - float(pronostico.wape)) * 100))
        texto += f' (precisión {precision}, {porcentaje} %)'
    return texto


def _sin_pronostico(pronostico):
    """Texto si no hay pronóstico utilizable; `None` si sí lo hay."""
    if pronostico is None:
        return 'Todavía no hay pronósticos generados para ese horizonte. Se generan cada lunes, o desde «Pronósticos».'
    if pronostico.estado != Pronostico.ESTADO_GENERADO:
        return (f'No hay pronóstico para ese horizonte: el historial es insuficiente ({pronostico.periodos_historial} '
                f'periodo(s) de {pronostico.periodos_minimos} necesarios).')
    return None


def pronostico_ventas(usuario, horizonte):
    monto = analitica.pronostico_vigente(Pronostico.METRICA_MONTO_VENTAS, horizonte)
    numero = analitica.pronostico_vigente(Pronostico.METRICA_NUMERO_VENTAS, horizonte)
    sin = _sin_pronostico(monto)
    if sin:
        texto, datos = sin, {}
    else:
        texto = (f'Para {HORIZONTES[horizonte]} se esperan ventas por {moneda(monto.total_pronosticado)} (rango '
                 f'{moneda(monto.total_inferior)} – {moneda(monto.total_superior)})')
        if numero is not None and numero.estado == Pronostico.ESTADO_GENERADO:
            texto += f', en unas {cantidad(numero.total_pronosticado)} venta(s)'
        texto += f', {_cita(monto)}.'
        datos = {'generacion': monto.generacion_id, 'monto': str(monto.total_pronosticado),
                 'inferior': str(monto.total_inferior), 'superior': str(monto.total_superior)}
    return {'texto': texto, 'datos': datos, 'botones': [b for b in botones_horizonte('pronostico_ventas')
                                                         if not b['nodo'].endswith(horizonte)],
            'enlace': ENLACES['pronosticos']}


def pronostico_demanda(usuario, horizonte):
    demanda = analitica.demanda_pronosticada(horizonte, limite=5)
    if demanda['generacion'] is None:
        texto, datos = _sin_pronostico(None), {}
    elif not demanda['productos']:
        texto, datos = 'Ningún producto tiene historial suficiente para pronosticar su demanda todavía.', {}
    else:
        lista = '; '.join(
            f'{i}. {p["producto_nombre"]}: {cantidad(p["unidades"])} u. (stock {cantidad(p["stock_total"])}'
            f'{", se quedaría corto" if p["insuficiente"] else ""})'
            for i, p in enumerate(demanda['productos'], start=1)
        )
        cortos = sum(1 for p in demanda['productos'] if p['insuficiente'])
        texto = (f'Demanda esperada para {HORIZONTES[horizonte]}: {lista}. '
                 f'{cortos} de estos producto(s) no alcanzarían con el stock actual.')
        datos = {'generacion': demanda['generacion'].id,
                 'productos': [{'producto': p['producto_nombre'], 'unidades': str(p['unidades']),
                                'stock_total': str(p['stock_total'])} for p in demanda['productos']]}
    return {'texto': texto, 'datos': datos, 'botones': [b for b in botones_horizonte('pronostico_demanda')
                                                         if not b['nodo'].endswith(horizonte)],
            'enlace': ENLACES['pronosticos']}


def pronostico_clientes(usuario, horizonte):
    nuevos = analitica.pronostico_vigente(Pronostico.METRICA_CLIENTES_NUEVOS, horizonte)
    base = analitica.pronostico_vigente(Pronostico.METRICA_BASE_CLIENTES, horizonte)
    sin = _sin_pronostico(nuevos)
    if sin:
        texto, datos = sin, {}
    else:
        texto = (f'Para {HORIZONTES[horizonte]} se esperan unos {cantidad(nuevos.total_pronosticado)} cliente(s) '
                 f'nuevo(s) (rango {cantidad(nuevos.total_inferior)} – {cantidad(nuevos.total_superior)})')
        if base is not None and base.estado == Pronostico.ESTADO_GENERADO:
            texto += f'; la base llegaría a unos {cantidad(base.total_pronosticado)} cliente(s)'
        texto += f', {_cita(nuevos)}.'
        datos = {'generacion': nuevos.generacion_id, 'nuevos': str(nuevos.total_pronosticado),
                 'base': str(base.total_pronosticado) if base and base.total_pronosticado is not None else None}
    return {'texto': texto, 'datos': datos, 'botones': [b for b in botones_horizonte('pronostico_clientes')
                                                         if not b['nodo'].endswith(horizonte)],
            'enlace': ENLACES['pronosticos']}


CON_PERIODO = {
    'ventas_total': ventas_total,
    'ventas_numero': ventas_numero,
    'ventas_top_productos': ventas_top_productos,
    'ventas_top_clientes': ventas_top_clientes,
    'ganancia_periodo': ganancia_periodo,
    'compras_total': compras_total,
    'compras_numero': compras_numero,
    'compras_top_proveedores': compras_top_proveedores,
}
CON_HORIZONTE = {
    'pronostico_ventas': pronostico_ventas,
    'pronostico_demanda': pronostico_demanda,
    'pronostico_clientes': pronostico_clientes,
}


def con_menu(respuesta):
    respuesta['botones'] = [*respuesta['botones'], boton_menu()]
    return respuesta
