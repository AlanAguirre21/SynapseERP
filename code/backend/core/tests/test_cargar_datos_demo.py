"""`cargar_datos_demo` — `025 · Datos de demostración`. Corre la carga completa
sobre la base de pruebas: detecta si algún endpoint cambió y rompe el seed."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.asistente.models import MensajeAsistente
from apps.auditoria.models import ConteoFisico, CorteCaja, DiscrepanciaAuditoria
from apps.caja.models import MovimientoCaja
from apps.catalogo.models import MateriaPrima, Producto
from apps.compras.models import Compra
from apps.contabilidad.models import AsientoContable
from apps.facturacion.models import ComplementoPago, Factura
from apps.inventario.models import MovimientoInventario, Traslado
from apps.produccion.models import Produccion, Receta
from apps.rrhh.models import Empleado, SolicitudNomina
from apps.sucursales.models import Sucursal
from apps.terceros.models import Cliente, Proveedor
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta
from core.management.commands.cargar_datos_demo import DOMINIO


@pytest.fixture
def entorno_dev(settings, tmp_path):
    settings.DEBUG = True
    settings.MEDIA_ROOT = tmp_path
    # El entorno de pruebas fija `ALLOWED_HOSTS = ['testserver']`, que anula el
    # `localhost` implícito de `DEBUG` con el que corre el comando en desarrollo.
    settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, 'localhost']


def _cargar(*args):
    salida = StringIO()
    call_command('cargar_datos_demo', *args, stdout=salida)
    return salida.getvalue()


@pytest.mark.django_db
def test_carga_unos_diez_registros_por_feature(entorno_dev):
    _cargar()

    assert Sucursal.objects.count() == 5
    assert Producto.objects.count() == 10
    assert MateriaPrima.objects.count() == 10
    assert Proveedor.objects.count() == 10
    assert Cliente.objects.count() == 10
    assert Empleado.objects.count() == 10
    assert Usuario.objects.filter(email__endswith=f'@{DOMINIO}').count() == 6
    assert Receta.objects.exists()
    assert Produccion.objects.count() == 10
    assert Traslado.objects.count() == 10

    assert Compra.objects.filter(estado=Compra.ESTADO_RECIBIDA).count() == 10
    assert Compra.objects.filter(estado=Compra.ESTADO_PENDIENTE).count() == 1
    assert Compra.objects.filter(estado=Compra.ESTADO_CANCELADA).count() == 1
    assert Venta.objects.count() == 13
    assert Venta.objects.filter(estado=Venta.ESTADO_CANCELADA).count() == 1
    # El operador también vende: su Dashboard y su asistente tienen cifras propias.
    assert Venta.objects.filter(usuario__rol_usuario='operador').count() == 7

    estados_nomina = set(SolicitudNomina.objects.values_list('estado', flat=True))
    assert len(estados_nomina) == 3

    # Nunca se contactó al PAC: todos los folios son de demostración.
    assert Factura.objects.count() == 6
    assert all(folio.startswith('DEMO') for folio in Factura.objects.values_list('folio_fiscal', flat=True))
    assert ComplementoPago.objects.count() == 2

    assert CorteCaja.objects.count() == 1
    assert ConteoFisico.objects.count() == 2
    assert DiscrepanciaAuditoria.objects.filter(estado=DiscrepanciaAuditoria.ESTADO_JUSTIFICADA).count() == 1
    assert MensajeAsistente.objects.count() == 7

    # Todo pasó por los libros: stock y caja con movimientos, y asientos contables.
    assert MovimientoInventario.objects.exists()
    assert MovimientoCaja.objects.filter(motivo=MovimientoCaja.MOTIVO_VENTA).exists()
    assert AsientoContable.objects.exists()


@pytest.mark.django_db
def test_es_idempotente(entorno_dev):
    _cargar()
    ventas = Venta.objects.count()

    assert 'ya existen' in _cargar()
    assert Venta.objects.count() == ventas


@pytest.mark.django_db
def test_simular_no_deja_datos(entorno_dev, tmp_path):
    assert 'Simulación completa' in _cargar('--simular')

    assert not Usuario.objects.filter(email__endswith=f'@{DOMINIO}').exists()
    assert not Venta.objects.exists()
    assert not any(tmp_path.rglob('*.xml'))


@pytest.mark.django_db
def test_se_niega_sin_debug(settings):
    settings.DEBUG = False

    with pytest.raises(CommandError, match='DEBUG=True'):
        _cargar()
    assert not Usuario.objects.exists()
