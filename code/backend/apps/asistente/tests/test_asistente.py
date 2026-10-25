from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from unittest import mock

import pytest
from django.conf import settings
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.analitica import services as analitica
from apps.analitica.models import GeneracionPronostico
from apps.asistente import clasificador, servicio
from apps.asistente.models import ConversacionAsistente, MensajeAsistente
from apps.reportes.services import resumen_rango
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta

URL = '/api/asistente/'


@pytest.fixture
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@synapse.test', password='clave-segura-123', rol_usuario='admin',
    )


@pytest.fixture
def operador(db):
    return Usuario.objects.create_user(
        username='operador1', email='operador1@synapse.test', password='clave-segura-123', rol_usuario='operador',
    )


def _cliente(usuario):
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


def _venta(usuario, sucursal, total, fecha=None, estado=Venta.ESTADO_ENTREGADA):
    venta = Venta.objects.create(sucursal=sucursal, usuario=usuario, total=Decimal(total), estado=estado)
    if fecha is not None:
        Venta.objects.filter(pk=venta.pk).update(fecha=fecha)
    return venta


def _clasificacion(intencion, confianza=clasificador.ALTA, puntuacion=0.9, alternativas=None):
    return {
        'intencion': intencion, 'puntuacion': puntuacion, 'confianza': confianza,
        'alternativas': alternativas or [{'intencion': intencion, 'puntuacion': puntuacion}],
    }


def _preguntar(usuario, texto=None, nodo=None, clasificacion=None, ahora=None):
    conversacion = ConversacionAsistente.objects.create(usuario=usuario)
    with mock.patch.object(clasificador, 'clasificar', return_value=clasificacion):
        return servicio.procesar(usuario, conversacion, texto=texto, nodo=nodo, ahora=ahora)


# --- Respuestas: mismas cifras que el Dashboard, con el mismo alcance ----------------


@pytest.mark.django_db
def test_ventas_de_hoy_coinciden_con_el_dashboard(admin, operador, sucursal):
    _venta(admin, sucursal, '150.00')
    _venta(operador, sucursal, '50.00')
    _venta(admin, sucursal, '999.00', estado=Venta.ESTADO_CANCELADA)

    mensaje, respuesta = _preguntar(admin, texto='¿cuánto vendimos hoy?', clasificacion=_clasificacion('ventas_total'))

    ahora = timezone.localtime()
    esperado = resumen_rango(ahora.replace(hour=0, minute=0, second=0, microsecond=0), ahora)
    assert esperado['ventas_total'] == Decimal('200.00')
    assert '$200.00 en 2 venta(s)' in respuesta['texto']
    assert respuesta['texto'].startswith('Ventas de hoy')
    assert mensaje.respuesta_datos['ventas_total'] == '200.00'
    assert (mensaje.intencion, mensaje.periodo, mensaje.confianza) == ('ventas_total', 'hoy', 'alta')


@pytest.mark.django_db
def test_el_operador_solo_ve_sus_propias_ventas(admin, operador, sucursal):
    _venta(admin, sucursal, '150.00')
    _venta(operador, sucursal, '50.00')

    _, respuesta = _preguntar(operador, nodo='consulta:ventas_total:hoy')

    assert respuesta['texto'].startswith('Tus ventas de hoy')
    assert '$50.00 en 1 venta(s)' in respuesta['texto']


@pytest.mark.django_db
def test_sin_datos_lo_dice_en_vez_de_mostrar_ceros(admin):
    _, respuesta = _preguntar(admin, nodo='consulta:compras_total:ayer')
    assert respuesta['texto'].startswith('No hubo compras ayer')


@pytest.mark.django_db
def test_ganancia_usa_la_formula_del_dashboard(admin, sucursal):
    _venta(admin, sucursal, '300.00')

    _, respuesta = _preguntar(admin, nodo='consulta:ganancia_periodo:este_mes')

    assert respuesta['texto'].startswith('Ganancia de este mes')
    assert 'ventas $300.00 − compras $0.00' in respuesta['texto']


@pytest.mark.django_db
def test_una_pregunta_sin_periodo_lo_pide_con_botones(admin):
    _, respuesta = _preguntar(admin, texto='total de ventas', clasificacion=_clasificacion('ventas_total'))

    assert respuesta['texto'] == 'Total vendido: ¿de qué periodo?'
    assert 'consulta:ventas_total:semana_pasada' in [b['nodo'] for b in respuesta['botones']]


@pytest.mark.django_db
def test_pronostico_sin_generaciones_no_inventa_cifras(admin):
    _, respuesta = _preguntar(admin, nodo='consulta:pronostico_ventas:semanas_4')
    assert respuesta['texto'].startswith('Todavía no hay pronósticos generados')


@pytest.mark.django_db
def test_pronostico_con_historial_insuficiente_lo_explica(admin, sucursal):
    _venta(admin, sucursal, '100.00', fecha=timezone.now() - timedelta(days=10))
    analitica.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    _, respuesta = _preguntar(admin, nodo='consulta:pronostico_ventas:semanas_4')

    assert 'historial es insuficiente' in respuesta['texto']


@pytest.mark.django_db
def test_pronostico_cita_la_generacion_y_detecta_el_horizonte(admin, sucursal):
    lunes = analitica.clave_bucket(timezone.localtime(), 'semana')
    for i in range(10):
        _venta(admin, sucursal, str(100 + 10 * i), fecha=lunes - timedelta(weeks=10 - i, days=-2))
    analitica.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    mensaje, respuesta = _preguntar(
        admin, texto='cuánto vamos a vender el próximo mes', clasificacion=_clasificacion('pronostico_ventas'),
    )

    assert mensaje.periodo == 'semanas_4'
    assert 'se esperan ventas por $900.00' in respuesta['texto']
    assert 'según el pronóstico generado el' in respuesta['texto']


# --- Confianza y modos --------------------------------------------------------------


@pytest.mark.django_db
def test_confianza_media_sugiere_sin_dar_datos(admin, sucursal):
    _venta(admin, sucursal, '150.00')
    alternativas = [{'intencion': 'ventas_total', 'puntuacion': 0.72}, {'intencion': 'ventas_numero', 'puntuacion': 0.7},
                    {'intencion': 'compras_total', 'puntuacion': 0.6}]

    mensaje, respuesta = _preguntar(admin, texto='ventas hoy', clasificacion=_clasificacion(
        'ventas_total', confianza=clasificador.MEDIA, puntuacion=0.72, alternativas=alternativas,
    ))

    assert respuesta['texto'] == 'No estoy seguro de haber entendido. ¿Quisiste decir…?'
    assert [b['nodo'] for b in respuesta['botones']][:3] == [
        'consulta:ventas_total:hoy', 'consulta:ventas_numero:hoy', 'consulta:compras_total:hoy',
    ]
    assert '$' not in respuesta['texto']
    assert mensaje.confianza == 'media'
    assert mensaje.alternativas == alternativas


@pytest.mark.django_db
def test_confianza_baja_muestra_el_menu(admin):
    _, respuesta = _preguntar(admin, texto='cuéntame un chiste', clasificacion=_clasificacion(
        'menu', confianza=clasificador.BAJA, puntuacion=0.3,
    ))
    assert respuesta['texto'].startswith('No entendí la pregunta')
    assert 'tema:ventas' in [b['nodo'] for b in respuesta['botones']]


@pytest.mark.django_db
def test_sin_clasificador_pasa_a_solo_botones(admin):
    conversacion = ConversacionAsistente.objects.create(usuario=admin)
    with mock.patch.object(clasificador, 'clasificar', side_effect=clasificador.ClasificadorNoDisponible('sin modelo')):
        mensaje, respuesta = servicio.procesar(admin, conversacion, texto='cuánto vendimos hoy')

    assert respuesta['modo'] == 'solo_arbol'
    assert 'no está disponible' in respuesta['texto']
    assert mensaje.modo == 'solo_arbol'


@pytest.mark.django_db
def test_un_boton_no_usa_el_clasificador(admin):
    conversacion = ConversacionAsistente.objects.create(usuario=admin)
    with mock.patch.object(clasificador, 'clasificar') as clasificar:
        mensaje, _ = servicio.procesar(admin, conversacion, nodo='tema:ventas')

    clasificar.assert_not_called()
    assert mensaje.confianza == 'boton'


@pytest.mark.django_db
def test_una_falla_de_calculo_no_es_un_500(admin):
    with mock.patch('apps.asistente.respuestas.reportes.resumen_rango', side_effect=RuntimeError('fallo')):
        mensaje, respuesta = _preguntar(admin, nodo='consulta:ventas_total:hoy')

    assert respuesta['texto'] == 'No pude calcular eso ahora. Intenta de nuevo en un momento.'
    assert mensaje.nodo_respuesta == 'error'


@pytest.mark.django_db
@pytest.mark.parametrize('nodo', ['tema:ganancias', 'consulta:ganancia_periodo:hoy', 'consulta:pronostico_ventas:dias_7'])
def test_el_operador_no_obtiene_nodos_de_admin(operador, nodo):
    _, respuesta = _preguntar(operador, nodo=nodo)
    assert respuesta['texto'] == 'Esa información no está disponible para tu rol.'


@pytest.mark.django_db
def test_el_clasificador_del_operador_solo_considera_sus_intenciones(operador):
    """Aunque un clasificador devolviera una intención de admin, el nodo se
    vuelve a comprobar (doble control)."""
    _, respuesta = _preguntar(operador, texto='cuánto ganamos hoy', clasificacion=_clasificacion('ganancia_periodo'))
    assert respuesta['texto'] == 'Esa información no está disponible para tu rol.'


# --- API --------------------------------------------------------------------------------


@pytest.mark.django_db
def test_flujo_por_la_api(admin):
    client = _cliente(admin)

    abierta = client.post(f'{URL}conversaciones/')
    tema = client.post(f'{URL}conversaciones/{abierta.data["conversacion"]}/mensajes/', {'nodo': 'tema:ventas'})

    assert abierta.status_code == 201
    assert abierta.data['botones'][0] == {'etiqueta': 'Ventas', 'nodo': 'tema:ventas'}
    assert tema.status_code == 201
    assert tema.data['texto'] == 'Ventas: ¿qué quieres consultar?'
    assert MensajeAsistente.objects.count() == 1


@pytest.mark.django_db
def test_no_se_puede_escribir_en_la_conversacion_de_otro(admin, operador):
    conversacion = ConversacionAsistente.objects.create(usuario=admin)
    respuesta = _cliente(operador).post(f'{URL}conversaciones/{conversacion.pk}/mensajes/', {'nodo': 'menu'})
    assert respuesta.status_code == 404


@pytest.mark.django_db
def test_mensaje_exige_texto_o_nodo_pero_no_ambos(admin):
    client = _cliente(admin)
    conversacion = client.post(f'{URL}conversaciones/').data['conversacion']
    ruta = f'{URL}conversaciones/{conversacion}/mensajes/'

    assert client.post(ruta, {}).status_code == 400
    assert client.post(ruta, {'texto': 'hola', 'nodo': 'menu'}).status_code == 400


@pytest.mark.django_db
def test_registro_solo_para_admin_y_filtra_dudosas(admin, operador):
    _preguntar(admin, texto='algo raro', clasificacion=_clasificacion('menu', confianza=clasificador.BAJA, puntuacion=0.2))
    _preguntar(admin, nodo='menu')

    dudosas = _cliente(admin).get(f'{URL}registro/', {'solo_dudosas': 'true'})

    assert _cliente(operador).get(f'{URL}registro/').status_code == 403
    assert dudosas.status_code == 200
    assert [m['entrada_texto'] for m in dudosas.data] == ['algo raro']
    assert dudosas.data[0]['usuario_nombre']


@pytest.mark.django_db
@pytest.mark.parametrize('metodo', ['put', 'patch', 'delete'])
def test_los_mensajes_son_insert_only(admin, metodo):
    client = _cliente(admin)
    conversacion = client.post(f'{URL}conversaciones/').data['conversacion']
    assert getattr(client, metodo)(f'{URL}conversaciones/{conversacion}/mensajes/', {}).status_code == 405


@pytest.mark.django_db
def test_menu_por_rol(operador):
    respuesta = _cliente(operador).get(f'{URL}menu/')
    assert [b['nodo'] for b in respuesta.data['botones']] == ['tema:ventas', 'tema:compras', 'ayuda']


# --- Clasificador con el modelo real -------------------------------------------------------


def _modelo_disponible():
    try:
        import fastembed  # noqa: F401
    except ImportError:
        return False
    cache = Path(settings.ASISTENTE_CACHE_MODELOS)
    return cache.exists() and any(cache.iterdir())


@pytest.mark.django_db
@pytest.mark.skipif(not _modelo_disponible(), reason='Modelo de embeddings no descargado (corre `indexar_intenciones`).')
def test_clasificador_real_cumple_el_umbral_de_evaluacion():
    from apps.asistente.management.commands.evaluar_asistente import evaluar

    call_command('indexar_intenciones')
    resultado = evaluar()

    assert resultado['aciertos'] / resultado['total'] >= 0.90
    assert resultado['fuera_directas'] == []
