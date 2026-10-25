from datetime import timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auditoria import services
from apps.auditoria.models import (
    ConteoFisico,
    CorteCaja,
    DetalleConteoFisico,
    DiscrepanciaAuditoria,
    EjecucionAuditoria,
)
from apps.caja.models import MovimientoCaja
from apps.caja.services import registrar_movimiento_caja
from apps.catalogo.models import Categoria, MateriaPrima, Producto
from apps.inventario.models import InventarioSucursalProducto, MovimientoInventario
from apps.inventario.services import registrar_movimiento_inventario
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario

URL = '/api/auditoria/'


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


@pytest.fixture
def admin_client(admin):
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def operador_client(operador):
    client = APIClient()
    client.force_authenticate(user=operador)
    return client


@pytest.fixture
def matriz(db):
    return Sucursal.objects.create(nombre_sucursal='Matriz')


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nombre_categoria='General', tipo='ambos')


@pytest.fixture
def suero(categoria):
    return Producto.objects.create(
        nombre_producto='Suero fisiológico', sku='SKU-AU-1', unidad_medida='pza',
        categoria=categoria, precio_venta='10.00',
    )


@pytest.fixture
def cloruro(categoria):
    return MateriaPrima.objects.create(nombre_item='Cloruro de sodio', unidad_medida='kg', categoria=categoria)


def _movimiento_caja(admin, tipo='ingreso', monto='100.00', motivo=MovimientoCaja.MOTIVO_MANUAL):
    with transaction.atomic():
        return registrar_movimiento_caja(
            tipo_movimiento=tipo, monto=Decimal(monto), motivo=motivo, referencia_id=None, usuario=admin,
            observacion='Prueba',
        )


def _stock_con_historial(sucursal, producto, usuario, cantidad):
    """Stock inicial registrado como lo hacen las compras: fila + movimiento."""
    InventarioSucursalProducto.objects.create(sucursal=sucursal, producto=producto, stock_actual=cantidad)
    registrar_movimiento_inventario(
        sucursal=sucursal, tipo_item=MovimientoInventario.TIPO_PRODUCTO, item_id=producto.pk,
        tipo_movimiento=MovimientoInventario.ENTRADA, cantidad=Decimal(cantidad),
        motivo=MovimientoInventario.MOTIVO_COMPRA, referencia_id=None, stock_resultante=Decimal(cantidad),
        usuario=usuario,
    )


def _conteo(client, sucursal, item, cantidad, tipo_item='producto'):
    return client.post(f'{URL}conteos/', {
        'sucursal': sucursal.pk,
        'detalles': [{'tipo_item': tipo_item, 'item_id': item.pk, 'cantidad_contada': cantidad}],
    }, format='json')


def _ejecutar(tipo, usuario=None):
    return services.ejecutar_auditoria(tipo, EjecucionAuditoria.ORIGEN_MANUAL, usuario=usuario)


# --- Conciliación de caja ------------------------------------------------------


@pytest.mark.django_db
def test_corte_cuadrado_no_genera_discrepancias(admin):
    _movimiento_caja(admin, monto='250.00')
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('250.00'), usuario=admin)

    ejecucion = _ejecutar(EjecucionAuditoria.TIPO_CAJA, admin)

    assert ejecucion.estado == EjecucionAuditoria.ESTADO_EXITOSA
    assert ejecucion.discrepancias_encontradas == 0
    assert ejecucion.elementos_revisados == 2  # un corte + un movimiento verificado
    corte = CorteCaja.objects.get()
    assert corte.ejecucion == ejecucion
    assert corte.saldo_esperado == Decimal('250.00')


@pytest.mark.django_db
@pytest.mark.parametrize(('contado', 'diferencia'), [('230.00', '-20.00'), ('275.50', '25.50')])
def test_corte_con_faltante_o_sobrante(admin, contado, diferencia):
    _movimiento_caja(admin, monto='250.00')
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal(contado), usuario=admin)

    ejecucion = _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    discrepancia = DiscrepanciaAuditoria.objects.get()
    assert discrepancia.ejecucion == ejecucion
    assert discrepancia.categoria == DiscrepanciaAuditoria.CATEGORIA_CAJA_CORTE
    assert discrepancia.valor_esperado == Decimal('250.00')
    assert discrepancia.valor_registrado == Decimal(contado)
    assert discrepancia.diferencia == Decimal(diferencia)


@pytest.mark.django_db
def test_corte_se_compara_contra_el_saldo_a_su_instante(admin):
    primero = _movimiento_caja(admin, monto='100.00')
    segundo = _movimiento_caja(admin, monto='50.00')
    hace_una_hora = timezone.now() - timedelta(hours=1)
    MovimientoCaja.objects.filter(pk=primero.pk).update(fecha=hace_una_hora - timedelta(minutes=5))
    MovimientoCaja.objects.filter(pk=segundo.pk).update(fecha=hace_una_hora + timedelta(minutes=5))
    CorteCaja.objects.create(fecha_hora_corte=hace_una_hora, monto_contado=Decimal('100.00'), usuario=admin)

    _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    assert not DiscrepanciaAuditoria.objects.filter(categoria=DiscrepanciaAuditoria.CATEGORIA_CAJA_CORTE).exists()


@pytest.mark.django_db
def test_corte_compara_contra_saldo_total_con_envios(admin):
    _movimiento_caja(admin, monto='100.00', motivo=MovimientoCaja.MOTIVO_VENTA)
    _movimiento_caja(admin, monto='30.00', motivo=MovimientoCaja.MOTIVO_ENVIO)
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('130.00'), usuario=admin)

    ejecucion = _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    assert ejecucion.discrepancias_encontradas == 0


@pytest.mark.django_db
def test_cadena_de_caja_alterada_genera_discrepancia_de_integridad(admin):
    _movimiento_caja(admin, monto='100.00')
    alterado = _movimiento_caja(admin, monto='50.00')
    _movimiento_caja(admin, monto='10.00')
    # Simula una corrupción del libro (en la app real es insert-only).
    MovimientoCaja.objects.filter(pk=alterado.pk).update(saldo_resultante=Decimal('170.00'))

    _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    discrepancias = DiscrepanciaAuditoria.objects.filter(categoria=DiscrepanciaAuditoria.CATEGORIA_CAJA_INTEGRIDAD)
    # El eslabón roto y el siguiente (que partió de 170 y espera 180, no 160).
    assert [(d.movimiento_caja_id, d.valor_esperado, d.valor_registrado) for d in discrepancias.order_by('id')] == [
        (alterado.pk, Decimal('150.00'), Decimal('170.00')),
        (alterado.pk + 1, Decimal('180.00'), Decimal('160.00')),
    ]


@pytest.mark.django_db
def test_la_cadena_continua_desde_el_ultimo_movimiento_verificado(admin):
    _movimiento_caja(admin, monto='100.00')
    primera = _ejecutar(EjecucionAuditoria.TIPO_CAJA)
    _movimiento_caja(admin, monto='20.00')

    segunda = _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    assert primera.elementos_revisados == 1
    assert segunda.elementos_revisados == 1


@pytest.mark.django_db
def test_ejecutar_dos_veces_no_duplica_discrepancias(admin):
    _movimiento_caja(admin, monto='100.00')
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('90.00'), usuario=admin)

    _ejecutar(EjecucionAuditoria.TIPO_CAJA)
    segunda = _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    assert DiscrepanciaAuditoria.objects.count() == 1
    assert segunda.elementos_revisados == 0


@pytest.mark.django_db
def test_corte_reemplazado_no_se_audita(admin):
    _movimiento_caja(admin, monto='100.00')
    erroneo = CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('10.00'), usuario=admin)
    CorteCaja.objects.create(
        fecha_hora_corte=timezone.now(), monto_contado=Decimal('100.00'), usuario=admin, reemplaza=erroneo,
    )

    ejecucion = _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    assert ejecucion.discrepancias_encontradas == 0
    erroneo.refresh_from_db()
    assert erroneo.ejecucion is None


# --- Auditoría de inventario -----------------------------------------------------


@pytest.mark.django_db
def test_conteo_congela_el_stock_teorico(admin_client, admin, matriz, suero):
    _stock_con_historial(matriz, suero, admin, '20.00')

    respuesta = _conteo(admin_client, matriz, suero, '18.00')
    InventarioSucursalProducto.objects.filter(sucursal=matriz, producto=suero).update(stock_actual=Decimal('5.00'))

    assert respuesta.status_code == 201
    assert DetalleConteoFisico.objects.get().stock_teorico == Decimal('20.00')


@pytest.mark.django_db
def test_conteo_con_diferencia_genera_discrepancia(admin_client, admin, matriz, suero):
    _stock_con_historial(matriz, suero, admin, '20.00')
    _conteo(admin_client, matriz, suero, '17.00')

    ejecucion = _ejecutar(EjecucionAuditoria.TIPO_INVENTARIO)

    discrepancia = DiscrepanciaAuditoria.objects.get()
    assert ejecucion.discrepancias_encontradas == 1
    assert discrepancia.categoria == DiscrepanciaAuditoria.CATEGORIA_INVENTARIO_CONTEO
    assert discrepancia.diferencia == Decimal('-3.00')
    assert discrepancia.sucursal == matriz
    assert ConteoFisico.objects.get().ejecucion == ejecucion


@pytest.mark.django_db
def test_stock_sin_historial_genera_discrepancia_de_integridad(admin_client, matriz, suero):
    # Stock creado sin `MovimientoInventario` (como hace `seed_dev.py`).
    InventarioSucursalProducto.objects.create(sucursal=matriz, producto=suero, stock_actual=Decimal('8.00'))
    _conteo(admin_client, matriz, suero, '8.00')

    _ejecutar(EjecucionAuditoria.TIPO_INVENTARIO)

    discrepancia = DiscrepanciaAuditoria.objects.get()
    assert discrepancia.categoria == DiscrepanciaAuditoria.CATEGORIA_INVENTARIO_INTEGRIDAD
    assert discrepancia.valor_esperado == Decimal('0.00')
    assert discrepancia.valor_registrado == Decimal('8.00')


@pytest.mark.django_db
def test_conteo_descartado_no_se_audita(admin_client, admin, matriz, suero):
    _stock_con_historial(matriz, suero, admin, '20.00')
    conteo_id = _conteo(admin_client, matriz, suero, '1.00').data['id']
    assert admin_client.post(f'{URL}conteos/{conteo_id}/descartar/').status_code == 200

    ejecucion = _ejecutar(EjecucionAuditoria.TIPO_INVENTARIO)

    assert ejecucion.elementos_revisados == 0
    assert not DiscrepanciaAuditoria.objects.exists()


@pytest.mark.django_db
def test_conteo_auditado_no_se_puede_descartar(admin_client, admin, matriz, suero):
    _stock_con_historial(matriz, suero, admin, '20.00')
    conteo_id = _conteo(admin_client, matriz, suero, '20.00').data['id']
    _ejecutar(EjecucionAuditoria.TIPO_INVENTARIO)

    assert admin_client.post(f'{URL}conteos/{conteo_id}/descartar/').status_code == 400


@pytest.mark.django_db
def test_conteo_rechaza_items_repetidos_y_cantidades_negativas(admin_client, matriz, suero):
    linea = {'tipo_item': 'producto', 'item_id': suero.pk, 'cantidad_contada': '1.00'}
    repetidos = admin_client.post(f'{URL}conteos/', {'sucursal': matriz.pk, 'detalles': [linea, linea]}, format='json')
    negativa = _conteo(admin_client, matriz, suero, '-1.00')

    assert repetidos.status_code == 400
    assert negativa.status_code == 400
    assert not ConteoFisico.objects.exists()


# --- Ejecución: concurrencia, fallos y comando ------------------------------------


@pytest.mark.django_db
def test_ejecucion_concurrente_no_procesa_nada(admin):
    _movimiento_caja(admin, monto='100.00')
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('90.00'), usuario=admin)

    with mock.patch.object(services, '_tomar_bloqueo', return_value=False):
        ejecucion = _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    assert ejecucion.estado == EjecucionAuditoria.ESTADO_EXITOSA
    assert ejecucion.elementos_revisados == 0
    assert CorteCaja.objects.get().ejecucion is None


@pytest.mark.django_db
def test_fallo_deja_la_ejecucion_fallida_sin_discrepancias_parciales(admin):
    _movimiento_caja(admin, monto='100.00')
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('90.00'), usuario=admin)

    with mock.patch.object(services, 'verificar_cadena_caja', side_effect=RuntimeError('fallo simulado')):
        ejecucion = services.ejecutar_auditoria(EjecucionAuditoria.TIPO_CAJA, EjecucionAuditoria.ORIGEN_MANUAL)

    assert ejecucion.estado == EjecucionAuditoria.ESTADO_FALLIDA
    assert 'fallo simulado' in ejecucion.mensaje_error
    assert not DiscrepanciaAuditoria.objects.exists()
    assert CorteCaja.objects.get().ejecucion is None


@pytest.mark.django_db
def test_comando_corre_un_solo_tipo(admin):
    call_command('ejecutar_auditorias', '--tipo', 'caja')

    ejecucion = EjecucionAuditoria.objects.get()
    assert ejecucion.tipo == EjecucionAuditoria.TIPO_CAJA
    assert ejecucion.origen == EjecucionAuditoria.ORIGEN_PROGRAMADA
    assert ejecucion.iniciada_por is None


@pytest.mark.django_db
def test_comando_sin_tipo_corre_ambas(admin):
    call_command('ejecutar_auditorias')
    assert sorted(EjecucionAuditoria.objects.values_list('tipo', flat=True)) == ['caja', 'inventario']


@pytest.mark.django_db
def test_comando_falla_con_codigo_de_error(admin):
    with mock.patch.object(services, 'auditar_caja', side_effect=RuntimeError('sin conexión')), \
            pytest.raises(CommandError):
        call_command('ejecutar_auditorias', '--tipo', 'caja')


# --- Resolución de discrepancias -------------------------------------------------


def _discrepancia_de_conteo(client, admin, sucursal, producto, stock, contado):
    _stock_con_historial(sucursal, producto, admin, stock)
    _conteo(client, sucursal, producto, contado)
    _ejecutar(EjecucionAuditoria.TIPO_INVENTARIO)
    return DiscrepanciaAuditoria.objects.get(categoria=DiscrepanciaAuditoria.CATEGORIA_INVENTARIO_CONTEO)


@pytest.mark.django_db
@pytest.mark.parametrize(('contado', 'tipo_movimiento', 'stock_final'), [
    ('17.00', MovimientoInventario.SALIDA, Decimal('17.00')),
    ('23.00', MovimientoInventario.ENTRADA, Decimal('23.00')),
])
def test_ajustar_genera_movimiento_de_ajuste(admin_client, admin, matriz, suero, contado, tipo_movimiento, stock_final):
    discrepancia = _discrepancia_de_conteo(admin_client, admin, matriz, suero, '20.00', contado)

    respuesta = admin_client.post(f'{URL}discrepancias/{discrepancia.pk}/ajustar/', {}, format='json')

    assert respuesta.status_code == 200
    assert respuesta.data['estado'] == 'ajustada'
    movimiento = MovimientoInventario.objects.get(motivo=MovimientoInventario.MOTIVO_AJUSTE)
    assert movimiento.tipo_movimiento == tipo_movimiento
    assert movimiento.cantidad == Decimal('3.00')
    assert movimiento.referencia_id == discrepancia.pk
    assert respuesta.data['movimiento_ajuste_id'] == movimiento.pk
    assert InventarioSucursalProducto.objects.get(sucursal=matriz, producto=suero).stock_actual == stock_final


@pytest.mark.django_db
def test_ajuste_que_dejaria_stock_negativo_se_rechaza(admin_client, admin, matriz, suero):
    discrepancia = _discrepancia_de_conteo(admin_client, admin, matriz, suero, '20.00', '5.00')
    # Ventas posteriores al conteo dejan menos stock que el faltante (15).
    InventarioSucursalProducto.objects.filter(sucursal=matriz, producto=suero).update(stock_actual=Decimal('10.00'))

    respuesta = admin_client.post(f'{URL}discrepancias/{discrepancia.pk}/ajustar/', {}, format='json')

    assert respuesta.status_code == 400
    discrepancia.refresh_from_db()
    assert discrepancia.estado == DiscrepanciaAuditoria.ESTADO_ABIERTA
    assert not MovimientoInventario.objects.filter(motivo=MovimientoInventario.MOTIVO_AJUSTE).exists()


@pytest.mark.django_db
def test_no_se_puede_resolver_dos_veces(admin_client, admin, matriz, suero):
    discrepancia = _discrepancia_de_conteo(admin_client, admin, matriz, suero, '20.00', '19.00')
    admin_client.post(f'{URL}discrepancias/{discrepancia.pk}/ajustar/', {}, format='json')

    segunda = admin_client.post(
        f'{URL}discrepancias/{discrepancia.pk}/justificar/', {'comentario': 'Otra vez'}, format='json',
    )

    assert segunda.status_code == 400
    assert MovimientoInventario.objects.filter(motivo=MovimientoInventario.MOTIVO_AJUSTE).count() == 1


@pytest.mark.django_db
def test_justificar_exige_comentario(admin_client, admin):
    _movimiento_caja(admin, monto='100.00')
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('90.00'), usuario=admin)
    _ejecutar(EjecucionAuditoria.TIPO_CAJA)
    discrepancia = DiscrepanciaAuditoria.objects.get()

    sin_comentario = admin_client.post(f'{URL}discrepancias/{discrepancia.pk}/justificar/', {}, format='json')
    con_comentario = admin_client.post(
        f'{URL}discrepancias/{discrepancia.pk}/justificar/', {'comentario': 'Billete falso retirado'}, format='json',
    )

    assert sin_comentario.status_code == 400
    assert con_comentario.status_code == 200
    assert con_comentario.data['estado'] == 'justificada'


@pytest.mark.django_db
def test_discrepancia_de_caja_no_se_puede_ajustar(admin_client, admin):
    _movimiento_caja(admin, monto='100.00')
    CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('90.00'), usuario=admin)
    _ejecutar(EjecucionAuditoria.TIPO_CAJA)
    discrepancia = DiscrepanciaAuditoria.objects.get()

    respuesta = admin_client.post(f'{URL}discrepancias/{discrepancia.pk}/ajustar/', {}, format='json')

    assert respuesta.status_code == 400


# --- API: cortes, ejecutar, resumen, PDF ---------------------------------------------


@pytest.mark.django_db
def test_corte_no_puede_estar_en_el_futuro(admin_client):
    futuro = (timezone.now() + timedelta(hours=1)).isoformat()
    respuesta = admin_client.post(
        f'{URL}cortes-caja/', {'monto_contado': '10.00', 'fecha_hora_corte': futuro}, format='json',
    )
    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_corte_auditado_no_se_puede_reemplazar(admin_client, admin):
    corte = CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('0.00'), usuario=admin)
    _ejecutar(EjecucionAuditoria.TIPO_CAJA)

    respuesta = admin_client.post(
        f'{URL}cortes-caja/', {'monto_contado': '5.00', 'reemplaza': corte.pk}, format='json',
    )

    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_crear_corte_y_ejecutar_desde_la_api(admin_client, admin):
    _movimiento_caja(admin, monto='80.00')

    creado = admin_client.post(f'{URL}cortes-caja/', {'monto_contado': '80.00'}, format='json')
    ejecutada = admin_client.post(f'{URL}ejecuciones/ejecutar/', {'tipo': 'caja'}, format='json')
    cortes = admin_client.get(f'{URL}cortes-caja/')

    assert creado.status_code == 201
    assert creado.data['estado'] == 'pendiente'
    assert ejecutada.status_code == 201
    assert ejecutada.data['origen'] == 'manual'
    assert cortes.data[0]['estado'] == 'auditado'
    assert cortes.data[0]['diferencia'] == '0.00'


@pytest.mark.django_db
def test_resumen_para_vistas_vinculadas(admin_client, admin, matriz, suero):
    _discrepancia_de_conteo(admin_client, admin, matriz, suero, '20.00', '18.00')

    respuesta = admin_client.get(f'{URL}resumen/')

    assert respuesta.status_code == 200
    assert respuesta.data['abiertas_inventario'] == 1
    assert respuesta.data['ultima_inventario']['discrepancias_abiertas'] == 1
    assert respuesta.data['abiertas_por_sucursal'] == [
        {'sucursal': matriz.pk, 'sucursal_nombre': 'Matriz', 'abiertas': 1},
    ]
    assert respuesta.data['ultima_caja'] is None


@pytest.mark.django_db
def test_reporte_pdf(admin_client, admin):
    ejecucion = _ejecutar(EjecucionAuditoria.TIPO_CAJA, admin)
    respuesta = admin_client.get(f'{URL}ejecuciones/{ejecucion.pk}/pdf/')
    assert respuesta.status_code == 200
    assert respuesta['Content-Type'] == 'application/pdf'


# --- Permisos -------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(('metodo', 'ruta'), [
    ('get', 'cortes-caja/'),
    ('post', 'cortes-caja/'),
    ('get', 'ejecuciones/'),
    ('post', 'ejecuciones/ejecutar/'),
    ('get', 'discrepancias/'),
    ('get', 'resumen/'),
])
def test_operador_no_accede_a_endpoints_de_admin(operador_client, metodo, ruta):
    respuesta = getattr(operador_client, metodo)(f'{URL}{ruta}', {}, format='json')
    assert respuesta.status_code == 403


@pytest.mark.django_db
def test_operador_captura_conteo_ciego(operador_client, admin, matriz, suero):
    _stock_con_historial(matriz, suero, admin, '20.00')

    creado = _conteo(operador_client, matriz, suero, '19.00')
    lista = operador_client.get(f'{URL}conteos/')

    assert creado.status_code == 201
    assert 'stock_teorico' not in creado.data['detalles'][0]
    assert 'stock_teorico' not in lista.data[0]['detalles'][0]


@pytest.mark.django_db
def test_operador_no_puede_descartar_conteos(operador_client, admin, matriz, suero):
    _stock_con_historial(matriz, suero, admin, '20.00')
    conteo_id = _conteo(operador_client, matriz, suero, '19.00').data['id']

    assert operador_client.post(f'{URL}conteos/{conteo_id}/descartar/').status_code == 403


@pytest.mark.django_db
def test_admin_si_ve_el_stock_teorico(admin_client, admin, matriz, suero):
    _stock_con_historial(matriz, suero, admin, '20.00')
    creado = _conteo(admin_client, matriz, suero, '19.00')
    assert creado.data['detalles'][0]['stock_teorico'] == '20.00'


@pytest.mark.django_db
@pytest.mark.parametrize('metodo', ['put', 'patch', 'delete'])
def test_cortes_y_conteos_son_insert_only(admin_client, admin, matriz, suero, metodo):
    corte = CorteCaja.objects.create(fecha_hora_corte=timezone.now(), monto_contado=Decimal('1.00'), usuario=admin)
    _stock_con_historial(matriz, suero, admin, '20.00')
    conteo_id = _conteo(admin_client, matriz, suero, '20.00').data['id']

    assert getattr(admin_client, metodo)(f'{URL}cortes-caja/{corte.pk}/', {}, format='json').status_code == 405
    assert getattr(admin_client, metodo)(f'{URL}conteos/{conteo_id}/', {}, format='json').status_code == 405


@pytest.mark.django_db
def test_modulo_visible_para_ambos_roles(admin_client, operador_client):
    for client in (admin_client, operador_client):
        slugs = [modulo['slug'] for modulo in client.get('/api/usuarios/me/').data['modulos']]
        assert 'auditoria_analisis' in slugs


@pytest.mark.django_db
def test_conteo_de_materia_prima(admin_client, matriz, cloruro):
    respuesta = _conteo(admin_client, matriz, cloruro, '2.50', tipo_item='materia_prima')
    assert respuesta.status_code == 201
    assert respuesta.data['detalles'][0]['item_nombre'] == 'Cloruro de sodio'
