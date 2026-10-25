from datetime import date, datetime, time, timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.analitica import series, services
from apps.analitica.models import GeneracionPronostico, Pronostico, PuntoPronostico
from apps.caja.models import MovimientoCaja
from apps.catalogo.models import Categoria, Producto
from apps.inventario.models import InventarioSucursalProducto
from apps.reportes.services import clave_bucket
from apps.sucursales.models import Sucursal
from apps.terceros.models import Cliente
from apps.usuarios.models import Usuario
from apps.ventas.models import DetalleVenta, Venta

URL = '/api/analitica/'
SEMANA = GeneracionPronostico.GRANULARIDAD_SEMANA
DIA = GeneracionPronostico.GRANULARIDAD_DIA


@pytest.fixture
def admin(db):
    return Usuario.objects.create_user(
        username='admin1', email='admin1@synapse.test', password='clave-segura-123', rol_usuario='admin',
    )


@pytest.fixture
def admin_client(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def operador_client(db):
    operador = Usuario.objects.create_user(
        username='operador1', email='operador1@synapse.test', password='clave-segura-123', rol_usuario='operador',
    )
    client = APIClient()
    client.force_authenticate(user=operador)
    return client


@pytest.fixture
def sucursal(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def suero(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-AN-1', unidad_medida='pza', categoria=categoria,
        precio_venta='10.00',
    )


def _venta(admin, sucursal, fecha, total='100.00', cliente=None, estado=Venta.ESTADO_ENTREGADA, lineas=()):
    """Venta histórica directa en el ORM (solo pruebas): `fecha` es
    `auto_now_add`, así que se fecha retroactivamente con `update()`."""

    venta = Venta.objects.create(
        sucursal=sucursal, usuario=admin, cliente=cliente, total=Decimal(total), estado=estado,
    )
    for producto, cantidad in lineas:
        precio = Decimal(str(producto.precio_venta))
        DetalleVenta.objects.create(
            venta=venta, producto=producto, cantidad=Decimal(cantidad), precio_unitario=precio,
            subtotal=precio * Decimal(cantidad),
        )
    Venta.objects.filter(pk=venta.pk).update(fecha=fecha)
    return venta


def _lunes_actual():
    return clave_bucket(timezone.localtime(), SEMANA)


def _historial_semanal(admin, sucursal, semanas, producto=None, cliente=None):
    """Una venta por semana completa, creciente: 100, 110, 120…"""
    lunes = _lunes_actual()
    for i in range(semanas):
        fecha = lunes - timedelta(weeks=semanas - i) + timedelta(days=2, hours=12)
        lineas = [(producto, '1')] if producto else ()
        _venta(admin, sucursal, fecha, total=str(100 + 10 * i), cliente=cliente, lineas=lineas)


# --- Series --------------------------------------------------------------------


@pytest.mark.django_db
def test_serie_excluye_canceladas_y_rellena_con_ceros(admin, sucursal):
    lunes = _lunes_actual()
    _venta(admin, sucursal, lunes - timedelta(weeks=3, days=-1), total='50.00')
    _venta(admin, sucursal, lunes - timedelta(weeks=3, days=-2), total='999.00', estado=Venta.ESTADO_CANCELADA)
    _venta(admin, sucursal, lunes - timedelta(weeks=1, days=-1), total='70.00')

    claves = series.claves_historial(SEMANA, lunes)
    monto, numero = series.serie_ventas(SEMANA, lunes)

    assert series.a_lista(monto, claves) == [Decimal('50.00'), Decimal('0.00'), Decimal('70.00')]
    assert series.a_lista(numero, claves) == [Decimal(1), Decimal(0), Decimal(1)]


@pytest.mark.django_db
def test_las_semanas_van_de_lunes_a_domingo(admin, sucursal):
    lunes = _lunes_actual()
    domingo = lunes - timedelta(days=1) + timedelta(hours=23)
    _venta(admin, sucursal, domingo)

    claves = series.claves_historial(SEMANA, lunes)

    assert claves == [lunes - timedelta(weeks=1)]
    assert claves[0].weekday() == 0


@pytest.mark.django_db
def test_cliente_adquirido_en_su_primera_venta_no_cancelada(admin, sucursal):
    lunes = _lunes_actual()
    ana = Cliente.objects.create(nombre_cliente='Ana')
    _venta(admin, sucursal, lunes - timedelta(weeks=3, days=-1), cliente=ana, estado=Venta.ESTADO_CANCELADA)
    _venta(admin, sucursal, lunes - timedelta(weeks=2, days=-1), cliente=ana)
    _venta(admin, sucursal, lunes - timedelta(weeks=1, days=-1), cliente=ana)
    _venta(admin, sucursal, lunes - timedelta(weeks=1, days=-2))  # mostrador, sin cliente

    nuevos, activos = series.serie_clientes(SEMANA, lunes)

    assert nuevos == {lunes - timedelta(weeks=2): Decimal(1)}
    assert activos == {lunes - timedelta(weeks=2): Decimal(1), lunes - timedelta(weeks=1): Decimal(1)}


# --- Generación ---------------------------------------------------------------------


@pytest.mark.django_db
def test_historial_insuficiente_se_registra_sin_puntos(admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=5)

    generacion = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    pronostico = generacion.pronosticos.get(metrica=Pronostico.METRICA_MONTO_VENTAS)
    assert generacion.estado == GeneracionPronostico.ESTADO_EXITOSA
    assert pronostico.estado == Pronostico.ESTADO_HISTORIAL_INSUFICIENTE
    assert (pronostico.periodos_historial, pronostico.periodos_minimos) == (5, 8)
    assert not pronostico.puntos.exists()


@pytest.mark.django_db
def test_pronostico_semanal_empieza_el_lunes_siguiente(admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)

    generacion = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    pronostico = generacion.pronosticos.get(metrica=Pronostico.METRICA_MONTO_VENTAS)
    puntos = list(pronostico.puntos.order_by('periodo_inicio'))
    siguiente_lunes = (_lunes_actual() + timedelta(weeks=1)).date()
    assert generacion.periodo_desde == siguiente_lunes
    assert [p.periodo_inicio for p in puntos] == [siguiente_lunes + timedelta(weeks=i) for i in range(4)]
    assert puntos[0].periodo_fin == siguiente_lunes + timedelta(days=6)
    # Serie 100, 110… 190 (x = 0..9): la semana en curso es x = 10, la siguiente x = 11 → 210.
    assert puntos[0].valor == Decimal('210.00')
    assert pronostico.metodo == Pronostico.METODO_TENDENCIA
    assert pronostico.total_pronosticado == Decimal('210.00') + Decimal('220.00') + Decimal('230.00') + Decimal(
        '240.00',
    )


@pytest.mark.django_db
def test_genera_series_por_producto_categoria_y_clientes(admin, sucursal, suero):
    ana = Cliente.objects.create(nombre_cliente='Ana')
    _historial_semanal(admin, sucursal, semanas=10, producto=suero, cliente=ana)

    generacion = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    metricas = set(generacion.pronosticos.values_list('metrica', flat=True))
    assert metricas == {metrica for metrica, _ in Pronostico.METRICA_CHOICES}
    assert generacion.pronosticos.get(metrica=Pronostico.METRICA_UNIDADES_PRODUCTO).producto == suero
    base = generacion.pronosticos.get(metrica=Pronostico.METRICA_BASE_CLIENTES)
    # Un solo cliente adquirido y ninguno nuevo esperado: la base se mantiene en 1.
    assert base.total_pronosticado >= Decimal(1)


@pytest.mark.django_db
def test_una_falla_deja_la_generacion_fallida_sin_pronosticos(admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)

    with mock.patch.object(services.series, 'serie_clientes', side_effect=RuntimeError('fallo simulado')):
        generacion = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    assert generacion.estado == GeneracionPronostico.ESTADO_FALLIDA
    assert 'fallo simulado' in generacion.mensaje_error
    assert not Pronostico.objects.exists()


@pytest.mark.django_db
def test_una_generacion_nueva_no_modifica_las_anteriores(admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)
    primera = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)
    puntos_antes = list(PuntoPronostico.objects.filter(pronostico__generacion=primera).values_list('valor', flat=True))

    segunda = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    puntos_despues = list(PuntoPronostico.objects.filter(pronostico__generacion=primera).values_list('valor', flat=True))
    assert puntos_antes == puntos_despues
    assert services.generacion_vigente(GeneracionPronostico.HORIZONTE_SEMANAS_4) == segunda


@pytest.mark.django_db
def test_rango_personalizado_valido(admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)
    hoy = timezone.localdate()

    generacion = services.generar(
        GeneracionPronostico.HORIZONTE_PERSONALIZADO, GeneracionPronostico.ORIGEN_MANUAL,
        desde=hoy + timedelta(days=14), hasta=hoy + timedelta(days=42), granularidad=SEMANA,
    )

    pronostico = generacion.pronosticos.get(metrica=Pronostico.METRICA_MONTO_VENTAS)
    assert generacion.estado == GeneracionPronostico.ESTADO_EXITOSA
    assert pronostico.puntos.first().periodo_inicio >= hoy + timedelta(days=8)


@pytest.mark.django_db
@pytest.mark.parametrize(('desde', 'hasta', 'granularidad'), [
    (-5, 10, DIA),      # empieza en el pasado
    (10, 5, DIA),       # hasta ≤ desde
    (2, 200, DIA),      # más de 90 días
])
def test_rango_personalizado_invalido(desde, hasta, granularidad, db):
    hoy = timezone.localdate()
    with pytest.raises(services.RangoInvalido):
        services.generar(
            GeneracionPronostico.HORIZONTE_PERSONALIZADO, GeneracionPronostico.ORIGEN_MANUAL,
            desde=hoy + timedelta(days=desde), hasta=hoy + timedelta(days=hasta), granularidad=granularidad,
        )
    assert not GeneracionPronostico.objects.exists()


@pytest.mark.django_db
def test_precision_real_compara_lo_pronosticado_con_lo_vendido(admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)
    generacion = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)
    pronostico = generacion.pronosticos.get(metrica=Pronostico.METRICA_MONTO_VENTAS)
    primera_semana = datetime.combine(generacion.periodo_desde, time.min, tzinfo=timezone.get_current_timezone())
    _venta(admin, sucursal, primera_semana + timedelta(days=1), total='200.00')

    precision = services.precision_real(pronostico, ahora=primera_semana + timedelta(weeks=1, days=1))

    assert precision['puntos'] == [
        {'periodo_inicio': generacion.periodo_desde, 'pronosticado': Decimal('210.00'), 'real': Decimal('200.00')},
    ]
    assert precision['wape'] == Decimal('0.0500')


@pytest.mark.django_db
def test_demanda_marca_los_productos_que_se_quedarian_cortos(admin, sucursal, suero):
    _historial_semanal(admin, sucursal, semanas=10, producto=suero)
    InventarioSucursalProducto.objects.create(sucursal=sucursal, producto=suero, stock_actual=Decimal('2.00'))
    services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    demanda = services.demanda_pronosticada(GeneracionPronostico.HORIZONTE_SEMANAS_4)

    fila = demanda['productos'][0]
    assert fila['producto'] == suero.pk
    assert fila['unidades'] == Decimal('4.00')
    assert fila['stock_total'] == Decimal('2.00')
    assert fila['insuficiente'] is True


# --- API ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_generar_desde_la_api_y_consultar_la_vista(admin_client, admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)

    generadas = admin_client.post(f'{URL}generaciones/generar/', {}, format='json')
    vista = admin_client.get(f'{URL}vista/', {'metrica': 'monto_ventas', 'horizonte': 'semanas_4'})

    assert generadas.status_code == 201
    assert sorted(g['horizonte'] for g in generadas.data) == ['dias_7', 'meses_3', 'semanas_4']
    assert vista.status_code == 200
    assert vista.data['pronostico']['estado'] == 'generado'
    assert len(vista.data['pronostico']['puntos']) == 4
    assert len(vista.data['historial']) == 10
    assert vista.data['historial'][-1]['valor'] == '190.00'


@pytest.mark.django_db
def test_generar_rango_personalizado_invalido_responde_400(admin_client):
    hoy = timezone.localdate()
    respuesta = admin_client.post(f'{URL}generaciones/generar/', {
        'horizonte': 'personalizado', 'desde': str(hoy - timedelta(days=1)), 'hasta': str(hoy + timedelta(days=5)),
        'granularidad': 'dia',
    }, format='json')
    incompleto = admin_client.post(f'{URL}generaciones/generar/', {'horizonte': 'personalizado'}, format='json')

    assert respuesta.status_code == 400
    assert 'futura' in respuesta.data['detail']
    assert incompleto.status_code == 400


@pytest.mark.django_db
def test_proyeccion_del_dashboard(admin_client, admin, sucursal):
    hoy = timezone.localtime()
    for dias_atras in range(40, 0, -1):
        _venta(admin, sucursal, hoy - timedelta(days=dias_atras), total='100.00')
    services.generar(GeneracionPronostico.HORIZONTE_DIAS_7, GeneracionPronostico.ORIGEN_MANUAL)

    respuesta = admin_client.get(f'{URL}proyeccion-dashboard/', {'periodo': 'semana'})

    assert respuesta.status_code == 200
    assert respuesta.data['granularidad'] == 'dia'
    assert len(respuesta.data['real']) == hoy.weekday() + 1
    # La proyección cubre los días que faltan de la semana (ninguno si hoy es domingo).
    assert len(respuesta.data['proyeccion']) == 6 - hoy.weekday()
    assert admin_client.get(f'{URL}proyeccion-dashboard/', {'periodo': 'dia'}).status_code == 400


@pytest.mark.django_db
def test_pronosticos_filtra_por_generacion_vigente(admin_client, admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)
    services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)

    respuesta = admin_client.get(f'{URL}pronosticos/', {
        'vigente': 'true', 'horizonte': 'semanas_4', 'metrica': 'numero_ventas',
    })

    assert respuesta.status_code == 200
    assert len(respuesta.data) == 1
    assert respuesta.data[0]['precision'] in ('alta', 'media', 'baja', None)


@pytest.mark.django_db
@pytest.mark.parametrize(('metodo', 'ruta'), [
    ('get', 'generaciones/'),
    ('post', 'generaciones/generar/'),
    ('get', 'pronosticos/'),
    ('get', 'vista/'),
    ('get', 'proyeccion-dashboard/?periodo=semana'),
    ('get', 'demanda/'),
])
def test_operador_no_accede_a_los_pronosticos(operador_client, metodo, ruta):
    assert getattr(operador_client, metodo)(f'{URL}{ruta}').status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize('metodo', ['put', 'patch', 'delete'])
def test_los_pronosticos_son_insert_only(admin_client, admin, sucursal, metodo):
    _historial_semanal(admin, sucursal, semanas=10)
    generacion = services.generar(GeneracionPronostico.HORIZONTE_SEMANAS_4, GeneracionPronostico.ORIGEN_MANUAL)
    pronostico = generacion.pronosticos.first()

    assert getattr(admin_client, metodo)(f'{URL}generaciones/{generacion.pk}/', {}).status_code == 405
    assert getattr(admin_client, metodo)(f'{URL}pronosticos/{pronostico.pk}/', {}).status_code == 405


# --- Comandos --------------------------------------------------------------------------


@pytest.mark.django_db
def test_comando_genera_los_tres_horizontes(admin, sucursal):
    _historial_semanal(admin, sucursal, semanas=10)
    call_command('generar_pronosticos')

    generaciones = GeneracionPronostico.objects.all()
    assert sorted(generaciones.values_list('horizonte', flat=True)) == ['dias_7', 'meses_3', 'semanas_4']
    assert all(g.origen == GeneracionPronostico.ORIGEN_PROGRAMADA for g in generaciones)


@pytest.mark.django_db
def test_comando_sale_con_error_si_una_generacion_falla(db):
    with mock.patch.object(services.series, 'serie_ventas', side_effect=RuntimeError('sin conexión')), \
            pytest.raises(CommandError):
        call_command('generar_pronosticos')


@pytest.mark.django_db
def test_historial_demo_se_niega_sin_debug(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError, match='DEBUG=True'):
        call_command('generar_historial_demo', '--dias', '3')
    assert not Venta.objects.exists()


@pytest.mark.django_db
def test_historial_demo_registra_ventas_por_la_api(settings):
    settings.DEBUG = True
    settings.ALLOWED_HOSTS = ['localhost']
    call_command('generar_historial_demo', '--dias', '14', '--semilla', '3')

    ventas = Venta.objects.all()
    assert ventas.exists()
    assert ventas.filter(fecha__date__lt=timezone.localdate()).count() == ventas.count()
    # Las ventas pasaron por el flujo real: cada una tiene su ingreso de caja.
    assert MovimientoCaja.objects.filter(motivo=MovimientoCaja.MOTIVO_VENTA).count() == ventas.count()
    with pytest.raises(CommandError, match='ya existe'):
        call_command('generar_historial_demo', '--dias', '3')


def test_fin_de_periodo_mensual():
    clave = datetime(2026, 2, 1, tzinfo=timezone.get_current_timezone())
    assert services.fin_de_periodo(clave, GeneracionPronostico.GRANULARIDAD_MES) == date(2026, 2, 28)
