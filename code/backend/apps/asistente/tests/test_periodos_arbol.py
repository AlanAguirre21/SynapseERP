"""Periodos y árbol — sin base de datos."""

from datetime import date, datetime

import pytest
from django.utils import timezone

from apps.asistente import arbol, periodos
from apps.asistente.servicio import detectar_horizonte

TZ = timezone.get_current_timezone()


@pytest.mark.parametrize(('texto', 'periodo', 'restante'), [
    ('¿Cuánto vendimos HOY?', periodos.HOY, 'cuanto vendimos'),
    ('ventas de ayer', periodos.AYER, 'ventas de'),
    ('cuánto vendimos esta semana', periodos.ESTA_SEMANA, 'cuanto vendimos'),
    ('compras de la semana pasada', periodos.SEMANA_PASADA, 'compras de'),
    ('ganancia de este mes', periodos.ESTE_MES, 'ganancia de'),
    ('top de productos del mes pasado', periodos.MES_PASADO, 'top de productos del'),
    ('cuánto ganamos este año', periodos.ESTE_ANIO, 'cuanto ganamos'),
    ('cuanto vendimos este ano', periodos.ESTE_ANIO, 'cuanto vendimos'),
    ('qué productos se vendieron más', None, 'que productos se vendieron mas'),
])
def test_detectar_periodo(texto, periodo, restante):
    assert periodos.detectar_periodo(texto) == (periodo, restante)


def test_semana_pasada_gana_sobre_semana():
    assert periodos.detectar_periodo('ventas de la semana pasada')[0] == periodos.SEMANA_PASADA


def test_un_periodo_futuro_no_se_detecta_y_se_conserva_en_el_texto():
    assert periodos.detectar_periodo('cuánto vamos a vender el próximo mes') == (
        None, 'cuanto vamos a vender el proximo mes',
    )


def test_rangos_en_hora_local():
    # Miércoles 14 de octubre de 2026, 15:30.
    ahora = datetime(2026, 10, 14, 15, 30, tzinfo=TZ)

    assert periodos.rango_de(periodos.HOY, ahora) == (datetime(2026, 10, 14, tzinfo=TZ), ahora)
    desde, hasta = periodos.rango_de(periodos.AYER, ahora)
    assert (desde, hasta.date(), hasta.hour) == (datetime(2026, 10, 13, tzinfo=TZ), date(2026, 10, 13), 23)
    assert periodos.rango_de(periodos.ESTA_SEMANA, ahora)[0] == datetime(2026, 10, 12, tzinfo=TZ)  # lunes
    desde, hasta = periodos.rango_de(periodos.SEMANA_PASADA, ahora)
    assert desde == datetime(2026, 10, 5, tzinfo=TZ) and hasta.date() == date(2026, 10, 11)
    assert periodos.rango_de(periodos.ESTE_MES, ahora)[0] == datetime(2026, 10, 1, tzinfo=TZ)
    desde, hasta = periodos.rango_de(periodos.MES_PASADO, ahora)
    assert desde == datetime(2026, 9, 1, tzinfo=TZ) and hasta.date() == date(2026, 9, 30)
    assert periodos.rango_de(periodos.ESTE_ANIO, ahora)[0] == datetime(2026, 1, 1, tzinfo=TZ)


def test_mes_pasado_en_enero_es_diciembre_del_anio_anterior():
    desde, hasta = periodos.rango_de(periodos.MES_PASADO, datetime(2027, 1, 10, 9, 0, tzinfo=TZ))
    assert desde == datetime(2026, 12, 1, tzinfo=TZ)
    assert hasta.date() == date(2026, 12, 31)


@pytest.mark.parametrize(('texto', 'horizonte'), [
    ('cuanto vamos a vender la proxima semana', 'dias_7'),
    ('ventas esperadas el proximo mes', 'semanas_4'),
    ('pronostico del proximo trimestre', 'meses_3'),
    ('pronostico de ventas', None),
])
def test_detectar_horizonte(texto, horizonte):
    assert detectar_horizonte(texto) == horizonte


def test_el_menu_del_operador_no_ofrece_ganancias_ni_pronosticos():
    nodos = [b['nodo'] for b in arbol.botones_menu('operador')]
    assert nodos == ['tema:ventas', 'tema:compras', 'ayuda']


def test_el_menu_del_admin_ofrece_los_cuatro_temas():
    nodos = [b['nodo'] for b in arbol.botones_menu('admin')]
    assert nodos == ['tema:ventas', 'tema:ganancias', 'tema:compras', 'tema:pronosticos', 'ayuda']


@pytest.mark.parametrize('nodo', ['', 'tema:otro', 'consulta:no_existe', 'consulta:ventas_total:mañana',
                                  'consulta:pronostico_ventas:hoy', 'consulta:ventas_total:hoy:extra'])
def test_nodos_invalidos(nodo):
    assert arbol.analizar_nodo(nodo) is None
