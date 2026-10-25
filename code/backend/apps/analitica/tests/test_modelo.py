"""Modelo de pronóstico — funciones puras, sin base de datos."""

from decimal import Decimal

from apps.analitica import modelo

D = Decimal


def test_tendencia_exacta_sobre_una_serie_lineal():
    pendiente, intercepto = modelo.ajustar_tendencia([D(3), D(5), D(7), D(9)])
    assert pendiente == D(2)
    assert intercepto == D(3)


def test_un_solo_punto_no_tiene_pendiente():
    assert modelo.ajustar_tendencia([D(4)]) == (D(0), D(4))


def test_pronostico_lineal_continua_la_recta_sin_rango():
    ajuste = modelo.ajustar([D(10), D(20), D(30), D(40)])
    puntos = modelo.pronosticar(ajuste, [4, 5])
    assert [p['valor'] for p in puntos] == [D('50.00'), D('60.00')]
    # Ajuste perfecto: sin dispersión, el rango colapsa al valor.
    assert puntos[0]['inferior'] == puntos[0]['superior'] == D('50.00')


def test_indices_estacionales_reproducen_un_patron_semanal():
    patron = [D(8), D(8), D(9), D(10), D(12), D(15), D(8)]
    valores = patron * 4
    posiciones = [i % 7 for i in range(len(valores))]

    ajuste = modelo.ajustar(valores, posiciones)
    puntos = modelo.pronosticar(ajuste, list(range(28, 35)), list(range(7)))

    assert ajuste['estacional']
    assert abs(sum(ajuste['indices'].values()) / 7 - D(1)) < D('1e-20')
    # El sábado (posición 5) se pronostica como el día más alto, como en el historial.
    valores_futuros = [p['valor'] for p in puntos]
    assert valores_futuros.index(max(valores_futuros)) == 5
    for real, pronosticado in zip(patron, valores_futuros, strict=True):
        assert abs(real - pronosticado) < D('1')


def test_ningun_valor_pronosticado_es_negativo():
    ajuste = modelo.ajustar([D(40), D(30), D(20), D(10)])
    puntos = modelo.pronosticar(ajuste, [6, 7, 8])
    assert all(p['valor'] == 0 and p['inferior'] == 0 for p in puntos)


def test_el_rango_es_simetrico_cuando_no_se_recorta():
    ajuste = modelo.ajustar([D(100), D(90), D(115), D(105), D(120), D(108)])
    punto = modelo.pronosticar(ajuste, [6])[0]
    assert punto['inferior'] > 0
    assert punto['superior'] - punto['valor'] == punto['valor'] - punto['inferior']


def test_wape_pondera_por_volumen_y_tolera_ceros():
    # |0-2| + |10-8| = 4 sobre un real total de 10.
    assert modelo.wape([D(0), D(10)], [D(2), D(8)]) == D('0.4000')


def test_wape_sin_ventas_reales_es_indefinido():
    assert modelo.wape([D(0), D(0)], [D(3), D(1)]) is None


def test_etiqueta_de_precision():
    assert modelo.etiqueta_precision(D('0.10')) == 'alta'
    assert modelo.etiqueta_precision(D('0.30')) == 'media'
    assert modelo.etiqueta_precision(D('0.55')) == 'baja'
    assert modelo.etiqueta_precision(None) is None


def test_validar_necesita_historial_suficiente_fuera_del_tramo_reservado():
    valores = [D(i) for i in range(10)]
    assert modelo.validar(valores, None, 4, minimo=8) is None
    assert modelo.validar(valores, None, 2, minimo=8) == D('0.0000')
