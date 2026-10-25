"""Historial sintético de ventas y clientes para probar los pronósticos —
`023 · Analítica predictiva`. SOLO DESARROLLO: se niega a correr con
`DEBUG=False`.

Crea su propia sucursal, categoría, productos y clientes (todos con el
prefijo "Demo ·", para reconocerlos y no tocar el catálogo real) y registra
las ventas a través de `POST /api/ventas/`, así que también se generan sus
movimientos de inventario, caja y asientos contables. El stock se repone con
un ajuste de inventario (`apps.inventario.services.ajustar_stock`).

Limitación conocida: `Venta.fecha` es `auto_now_add`, así que se fecha
retroactivamente con `update()` después de crear cada venta; sus movimientos
de caja e inventario conservan la fecha real de creación (los libros son
insert-only y no se tocan).

    python manage.py generar_historial_demo --dias 540 --semilla 7
"""

import random
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, Producto
from apps.inventario.models import MovimientoInventario
from apps.inventario.services import ajustar_stock
from apps.sucursales.models import Sucursal
from apps.usuarios.models import Usuario
from apps.ventas.models import Venta

PREFIJO = 'Demo · '
PRODUCTOS = [
    ('Suero oral 500 ml', '35.00'),
    ('Gasas estériles (paquete)', '22.50'),
    ('Venda elástica', '48.00'),
    ('Alcohol 250 ml', '29.90'),
    ('Termómetro digital', '149.00'),
]
# Efecto del día de la semana (lunes = 0): más ventas a fin de semana.
PATRON_SEMANAL = [0.8, 0.85, 0.9, 1.0, 1.15, 1.35, 0.95]


class Command(BaseCommand):
    help = 'SOLO DESARROLLO: genera un historial sintético de ventas y clientes para probar los pronósticos.'

    def add_arguments(self, parser):
        parser.add_argument('--dias', type=int, default=540, help='Días de historial hacia atrás (por defecto 540).')
        parser.add_argument('--semilla', type=int, default=7, help='Semilla del generador (reproducible).')

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('generar_historial_demo solo puede correr con DEBUG=True (entorno de desarrollo).')
        if Categoria.objects.filter(nombre_categoria=f'{PREFIJO}General').exists():
            raise CommandError('El historial demo ya existe (categoría "Demo · General").')

        dias = options['dias']
        aleatorio = random.Random(options['semilla'])
        usuario = self._usuario_demo()
        sucursal, productos = self._catalogo_demo(usuario, dias)
        cliente_api = APIClient(SERVER_NAME='localhost')
        cliente_api.force_authenticate(user=usuario)

        clientes = []
        hoy = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
        creadas = 0
        for indice_dia in range(dias):
            dia = hoy - timedelta(days=dias - indice_dia)
            # La cartera crece con el tiempo: unos 2 clientes nuevos por semana.
            while len(clientes) < 3 + indice_dia * 2 // 7:
                clientes.append(self._crear_cliente(cliente_api, len(clientes) + 1))

            # Tendencia creciente × patrón semanal × ruido.
            esperado = (2 + 3 * indice_dia / dias) * PATRON_SEMANAL[dia.weekday()]
            for _ in range(max(0, round(aleatorio.gauss(esperado, 1)))):
                self._crear_venta(cliente_api, aleatorio, dia, sucursal, productos, clientes)
                creadas += 1

            if indice_dia and indice_dia % 60 == 0:
                self.stdout.write(f'  {indice_dia}/{dias} días, {creadas} ventas…')

        self.stdout.write(self.style.SUCCESS(
            f'Historial demo listo: {creadas} ventas en {dias} días, {len(clientes)} clientes. '
            'Ahora corre `python manage.py generar_pronosticos`.',
        ))

    def _usuario_demo(self):
        usuario, creado = Usuario.objects.get_or_create(
            email='demo.historial@synapse.test',
            defaults={'username': 'demo.historial', 'rol_usuario': 'admin', 'first_name': 'Historial',
                      'last_name': 'Demo'},
        )
        if creado:
            usuario.set_unusable_password()
            usuario.save()
        return usuario

    @transaction.atomic
    def _catalogo_demo(self, usuario, dias):
        sucursal = Sucursal.objects.create(nombre_sucursal=f'{PREFIJO}Sucursal')
        categoria = Categoria.objects.create(nombre_categoria=f'{PREFIJO}General', tipo='ambos')
        productos = []
        for numero, (nombre, precio) in enumerate(PRODUCTOS, start=1):
            producto = Producto.objects.create(
                nombre_producto=f'{PREFIJO}{nombre}', sku=f'DEMO-{numero:03d}', unidad_medida='pza',
                categoria=categoria, precio_venta=Decimal(precio),
            )
            # Stock de sobra para todo el historial, con su ajuste auditado.
            ajustar_stock(
                sucursal=sucursal, tipo_item=MovimientoInventario.TIPO_PRODUCTO, item=producto,
                diferencia=Decimal(dias * 40), referencia_id=None, usuario=usuario,
            )
            productos.append(producto)
        return sucursal, productos

    def _crear_cliente(self, cliente_api, numero):
        respuesta = cliente_api.post(
            '/api/terceros/clientes/', {'nombre_cliente': f'{PREFIJO}Cliente {numero:03d}'}, format='json',
        )
        if respuesta.status_code != 201:
            raise CommandError(f'No se pudo crear el cliente demo {numero}: {respuesta.data}')
        return respuesta.data['id']

    def _crear_venta(self, cliente_api, aleatorio, dia, sucursal, productos, clientes):
        lineas = aleatorio.sample(productos, k=aleatorio.choice([1, 1, 2]))
        datos = {
            'sucursal': sucursal.pk,
            # Un 25 % de ventas de mostrador (sin cliente).
            'cliente': aleatorio.choice(clientes) if aleatorio.random() > 0.25 else None,
            'detalles': [{'producto': p.pk, 'cantidad': str(aleatorio.randint(1, 4))} for p in lineas],
        }
        respuesta = cliente_api.post('/api/ventas/', datos, format='json')
        if respuesta.status_code != 201:
            raise CommandError(f'No se pudo crear una venta demo: {respuesta.data}')
        fecha = dia + timedelta(hours=aleatorio.randint(9, 19), minutes=aleatorio.randint(0, 59))
        Venta.objects.filter(pk=respuesta.data['id']).update(fecha=fecha)
