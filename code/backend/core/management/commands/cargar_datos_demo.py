"""Datos de demostración para todas las features — `025 · Datos de
demostración`. SOLO DESARROLLO: se niega a correr con `DEBUG=False`.

Carga unos 10 registros por feature, siempre a través de la API (el mismo
patrón que `generar_historial_demo`), así que cada operación respeta las
validaciones, los permisos y los efectos de la aplicación: el stock cambia
solo por `MovimientoInventario`, la caja por `MovimientoCaja`, y se generan
los asientos contables. La facturación usa un PAC simulado: nunca se
timbra nada real.

    python manage.py cargar_datos_demo             # carga los datos
    python manage.py cargar_datos_demo --simular   # corre todo y lo revierte

Usuarios de demostración: `@demo.synapse.test`, contraseña `CONTRASENA_DEMO`.
"""

import unicodedata
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.usuarios.models import Usuario

CONTRASENA_DEMO = 'Synapse.Demo2026'
DOMINIO = 'demo.synapse.test'
# Su existencia indica que la carga ya se hizo.
CENTINELA = f'ana.torres@{DOMINIO}'


def _sin_acentos(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', texto.lower()) if unicodedata.category(c) != 'Mn')


def _folio_demo():
    """UUID de 36 caracteres que empieza con «DEMO»: se distingue de un folio fiscal real."""
    return f'DEMO{str(uuid.uuid4())[4:]}'


class _Revertir(Exception):
    """Fuerza el rollback de `--simular`."""


class Command(BaseCommand):
    help = 'SOLO DESARROLLO: carga unos 10 registros de demostración por feature, a través de la API.'

    def add_arguments(self, parser):
        parser.add_argument('--simular', action='store_true', help='Corre la carga completa y la revierte al final.')

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('cargar_datos_demo solo puede correr con DEBUG=True (entorno de desarrollo).')
        if Usuario.objects.filter(email=CENTINELA).exists():
            self.stdout.write('Los datos de demostración ya existen; no se insertó nada.')
            return

        self.simular = options['simular']
        try:
            with transaction.atomic():
                resumen = self._cargar()
                if self.simular:
                    raise _Revertir
        except _Revertir:
            self.stdout.write(self.style.WARNING('Simulación completa: se revirtieron todos los cambios.'))
        else:
            self.stdout.write(self.style.SUCCESS('Datos de demostración cargados.'))
            self.stdout.write(f'Usuarios @{DOMINIO}, contraseña «{CONTRASENA_DEMO}».')
        for linea in resumen:
            self.stdout.write(f'  {linea}')

    # --- Utilidades -----------------------------------------------------------------

    def _cliente(self, usuario):
        cliente = APIClient(SERVER_NAME='localhost')
        cliente.force_authenticate(user=usuario)
        return cliente

    def _post(self, cliente, url, datos=None, esperado=(200, 201)):
        respuesta = cliente.post(url, datos or {}, format='json')
        if respuesta.status_code not in esperado:
            raise CommandError(f'POST {url} respondió {respuesta.status_code}: {respuesta.data}')
        return respuesta.data

    def _get(self, cliente, url, params=None):
        respuesta = cliente.get(url, params or {})
        if respuesta.status_code != 200:
            raise CommandError(f'GET {url} respondió {respuesta.status_code}: {respuesta.data}')
        return respuesta.data

    def _patch(self, cliente, url, datos):
        respuesta = cliente.patch(url, datos, format='json')
        if respuesta.status_code != 200:
            raise CommandError(f'PATCH {url} respondió {respuesta.status_code}: {respuesta.data}')
        return respuesta.data

    # --- Carga ----------------------------------------------------------------------

    def _cargar(self):
        self.admin = self._admin()
        self.api = self._cliente(self.admin)
        self.resumen = []

        self._configuracion_fiscal()
        self._sucursales()
        self._catalogo()
        self._terceros()
        self._rrhh()
        self._usuarios()
        self._caja_inicial()
        self._compras()
        self._produccion()
        self._traslados()
        self._ventas()
        self._caja_gastos()
        self._nomina()
        self._facturacion()
        self._contabilidad()
        self._auditoria()
        self._analitica()
        self._asistente()
        return self.resumen

    def _admin(self):
        """El admin demo hace las operaciones; con su propia cuenta para que las
        cifras del Dashboard del admin real no se confundan con las demo."""

        admin = Usuario.objects.create_user(
            email=f'direccion@{DOMINIO}', username=f'direccion@{DOMINIO}', password=CONTRASENA_DEMO,
            first_name='Laura', last_name='Mendoza', rol_usuario='admin',
        )
        return admin

    def _configuracion_fiscal(self):
        empresa = self._get(self.api, '/api/configuracion-fiscal/datos-empresa/')
        if not empresa.get('rfc'):
            # RFC genérico de pruebas del SAT.
            self._patch(self.api, '/api/configuracion-fiscal/datos-empresa/', {
                'rfc': 'EKU9003173C9', 'razon_social': 'ESCUELA KEMPER URGATE', 'regimen_fiscal': '601',
                'codigo_postal_fiscal': '42501',
            })
        series = {s['serie'] for s in self._get(self.api, '/api/configuracion-fiscal/series/')}
        for serie, folio in [('A', 100), ('B', 1)]:
            if serie not in series:
                self._post(self.api, '/api/configuracion-fiscal/series/', {'serie': serie, 'folio_actual': folio})
        self.resumen.append('Configuración fiscal: datos de la empresa (si estaban vacíos) y series A y B.')

    def _sucursales(self):
        existentes = {s['nombre_sucursal']: s['id'] for s in self._get(self.api, '/api/sucursales/')}
        datos = [
            ('Matriz', 'Av. Insurgentes Sur 1458, CDMX', '55 5524 8890'),
            ('Sucursal Norte', 'Av. Constitución 2100, Monterrey, N.L.', '81 8340 1120'),
            ('Sucursal Occidente', 'Av. Vallarta 3050, Guadalajara, Jal.', '33 3615 4470'),
            ('Sucursal Sur', 'Blvd. 5 de Mayo 1802, Puebla, Pue.', '22 2240 3315'),
            ('Almacén Central', 'Calle Norte 45 #120, Tlalnepantla, Edo. Méx.', '55 5390 2201'),
        ]
        self.sucursales = []
        for nombre, ubicacion, telefono in datos:
            if nombre in existentes:
                self.sucursales.append(existentes[nombre])
                continue
            creada = self._post(self.api, '/api/sucursales/', {
                'nombre_sucursal': nombre, 'ubicacion_sucursal': ubicacion, 'telefono_sucursal': telefono,
            })
            self.sucursales.append(creada['id'])
        self.resumen.append(f'Sucursales: {len(self.sucursales)} (Matriz se reutiliza si ya existía).')

    def _catalogo(self):
        categorias = {}
        for nombre, tipo, descripcion in [
            ('Soluciones', 'producto', 'Sueros y soluciones envasadas'),
            ('Curación', 'producto', 'Material de curación'),
            ('Higiene', 'producto', 'Antisépticos y protección'),
            ('Instrumental', 'producto', 'Equipo médico de diagnóstico'),
            ('Insumos químicos', 'materia_prima', 'Materias primas para fabricación'),
            ('Envases y etiquetas', 'materia_prima', 'Material de empaque'),
        ]:
            categorias[nombre] = self._post(self.api, '/api/catalogo/categorias/', {
                'nombre_categoria': nombre, 'tipo': tipo, 'descripcion_categoria': descripcion,
            })['id']

        self.productos = {}
        for sku, nombre, categoria, precio, costo in [
            ('SOL-001', 'Suero oral 500 ml', 'Soluciones', '35.00', '14.00'),
            ('SOL-002', 'Solución salina 0.9% 1 L', 'Soluciones', '58.00', '21.00'),
            ('HIG-001', 'Alcohol etílico 70% 500 ml', 'Higiene', '42.00', '18.00'),
            ('HIG-002', 'Gel antibacterial 500 ml', 'Higiene', '65.00', '26.00'),
            ('HIG-003', 'Cubrebocas tricapa (caja 50)', 'Higiene', '95.00', None),
            ('CUR-001', 'Gasas estériles 10x10 (paquete)', 'Curación', '22.50', None),
            ('CUR-002', 'Venda elástica 10 cm', 'Curación', '48.00', None),
            ('CUR-003', 'Guantes de nitrilo (caja 100)', 'Curación', '189.00', None),
            ('INS-001', 'Termómetro digital', 'Instrumental', '149.00', None),
            ('INS-002', 'Baumanómetro digital de brazo', 'Instrumental', '680.00', None),
        ]:
            datos = {'sku': sku, 'nombre_producto': nombre, 'categoria': categorias[categoria], 'unidad_medida': 'pza',
                     'precio_venta': precio}
            if costo:
                datos['costo_produccion'] = costo
            self.productos[sku] = self._post(self.api, '/api/catalogo/productos/', datos)['id']

        self.materias = {}
        for clave, nombre, categoria, unidad, costo in [
            ('agua', 'Agua purificada grado farmacéutico', 'Insumos químicos', 'L', '4.50'),
            ('cloruro', 'Cloruro de sodio USP', 'Insumos químicos', 'g', '0.04'),
            ('glucosa', 'Glucosa anhidra', 'Insumos químicos', 'g', '0.05'),
            ('citrato', 'Citrato de sodio', 'Insumos químicos', 'g', '0.10'),
            ('alcohol', 'Alcohol etílico 96°', 'Insumos químicos', 'L', '48.00'),
            ('carbopol', 'Carbopol 940', 'Insumos químicos', 'g', '0.41'),
            ('glicerina', 'Glicerina USP', 'Insumos químicos', 'ml', '0.08'),
            ('botella500', 'Botella PET 500 ml con tapa', 'Envases y etiquetas', 'pza', '3.20'),
            ('botella1l', 'Botella PET 1 L con tapa', 'Envases y etiquetas', 'pza', '4.10'),
            ('etiqueta', 'Etiqueta adhesiva impresa', 'Envases y etiquetas', 'pza', '0.60'),
        ]:
            self.materias[clave] = self._post(self.api, '/api/catalogo/materia-prima/', {
                'nombre_item': nombre, 'categoria': categorias[categoria], 'unidad_medida': unidad, 'costo_promedio': costo,
            })['id']
        self.resumen.append(f'Catálogo: {len(categorias)} categorías, {len(self.productos)} productos, '
                            f'{len(self.materias)} materias primas.')

    def _terceros(self):
        self.proveedores = []
        for nombre, rfc, contacto, telefono in [
            ('Laboratorios Pisa Distribución', 'LPD840512AB3', 'Jorge Salinas', '33 3678 1000'),
            ('Químicos Industriales del Bajío', 'QIB990823KL1', 'Marcela Ríos', '477 711 2040'),
            ('Envases Plásticos de México', 'EPM010215HG7', 'Ricardo Peña', '55 5361 8800'),
            ('Etiquetas y Empaques Monterrey', 'EEM120430JK2', 'Sofía Garza', '81 8150 3311'),
            ('Distribuidora Médica Azteca', 'DMA050817PL9', 'Héctor Luna', '55 5687 4512'),
            ('Equipos de Diagnóstico Omega', 'EDO110902MN4', 'Patricia Vega', '33 3121 9090'),
            ('Textiles Quirúrgicos de Puebla', 'TQP070611RS5', 'Arturo Méndez', '22 2231 6070'),
            ('Protección Sanitaria Integral', 'PSI150120TU8', 'Daniela Ortiz', '55 5250 7733'),
            ('Alcoholes Finos del Golfo', 'AFG031105VW6', 'Mario Castillo', '229 932 1440'),
            ('Comercializadora Farmacéutica Lerma', 'CFL180314XY1', 'Elena Robles', '722 215 6688'),
        ]:
            self.proveedores.append(self._post(self.api, '/api/terceros/proveedores/', {
                'nombre_proveedor': nombre, 'rfc': rfc, 'contacto_nombre': contacto, 'telefono': telefono,
                'email': f'ventas@{_sin_acentos(nombre.split()[0])}.example.com',
            })['id'])

        self.clientes = []
        self.clientes_fiscales = []
        for nombre, telefono, fiscales in [
            ('Hospital San Rafael', '55 5598 2200', ('HSR950601QW2', 'HOSPITAL SAN RAFAEL', '03100', '601', 'G03')),
            ('Clínica Santa Fe', '55 5292 4100', ('CSF080915ER4', 'CLINICA SANTA FE', '01210', '601', 'G03')),
            ('Farmacia del Ahorro Lindavista', '55 5752 0011', ('FAL100320TY6', 'FARMACIA DEL AHORRO LINDAVISTA', '07300', '601', 'G01')),
            ('Consultorio Dra. Martínez', '55 5611 3344', ('MAGL800415UI8', 'LUCIA MARTINEZ GARCIA', '03810', '612', 'G03')),
            ('Cruz Verde Monterrey', '81 8333 4455', ('CVM130708OP1', 'CRUZ VERDE MONTERREY', '64000', '603', 'G03')),
            ('Laboratorio Clínico Delta', '33 3640 2277', ('LCD160225AS3', 'LABORATORIO CLINICO DELTA', '44100', '601', 'G01')),
            ('Juan Pérez Hernández', '55 4321 7788', None),
            ('Residencia Geriátrica Los Pinos', '22 2248 9911', None),
            ('Escuela Primaria Benito Juárez', '55 5674 1203', None),
            ('Gimnasio Fortaleza', '33 3812 6655', None),
        ]:
            datos = {'nombre_cliente': nombre, 'telefono': telefono,
                     'email': f'compras@{_sin_acentos(nombre.split()[0])}.example.com'}
            if fiscales:
                rfc, razon, cp, regimen, uso = fiscales
                datos['datos_fiscales'] = {'rfc': rfc, 'razon_social': razon, 'codigo_postal_fiscal': cp,
                                           'regimen_fiscal': regimen, 'uso_cfdi_default': uso, 'requiere_factura': True}
            cliente_id = self._post(self.api, '/api/terceros/clientes/', datos)['id']
            self.clientes.append(cliente_id)
            if fiscales:
                self.clientes_fiscales.append(cliente_id)
        self.resumen.append(f'Terceros: {len(self.proveedores)} proveedores, {len(self.clientes)} clientes '
                            f'({len(self.clientes_fiscales)} con datos fiscales).')

    def _rrhh(self):
        departamentos = {}
        for nombre, padre in [('Dirección General', None), ('Ventas', 'Dirección General'),
                              ('Almacén y Logística', 'Dirección General'), ('Producción', 'Dirección General'),
                              ('Administración y Finanzas', 'Dirección General')]:
            departamentos[nombre] = self._post(self.api, '/api/rrhh/departamentos/', {
                'nombre_departamento': nombre, 'departamento_padre': departamentos.get(padre),
            })['id']

        posiciones = {}
        for titulo, departamento, reporta, minimo, maximo in [
            ('Director general', 'Dirección General', None, '45000', '70000'),
            ('Gerente de ventas', 'Ventas', 'Director general', '28000', '40000'),
            ('Ejecutivo de ventas', 'Ventas', 'Gerente de ventas', '12000', '18000'),
            ('Jefe de almacén', 'Almacén y Logística', 'Director general', '18000', '25000'),
            ('Auxiliar de almacén', 'Almacén y Logística', 'Jefe de almacén', '9000', '12000'),
            ('Supervisor de producción', 'Producción', 'Director general', '20000', '28000'),
            ('Operario de producción', 'Producción', 'Supervisor de producción', '9500', '13000'),
            ('Contador', 'Administración y Finanzas', 'Director general', '22000', '32000'),
        ]:
            posiciones[titulo] = self._post(self.api, '/api/rrhh/posiciones/', {
                'titulo_posicion': titulo, 'departamento': departamentos[departamento],
                'reporta_a': posiciones.get(reporta), 'salario_minimo': minimo, 'salario_maximo': maximo,
            })['id']
        self._patch(self.api, f'/api/rrhh/departamentos/{departamentos["Dirección General"]}/',
                    {'posicion_manager': posiciones['Director general']})

        self.empleados = {}
        for numero, (nombre, curp, rfc, nss, posicion, salario, inicio) in enumerate([
            ('Laura Mendoza Ruiz', 'MERL780210MDFNZR04', 'MERL780210QK3', '12957812345', 'Director general', '62000', '2019-02-01'),
            ('Ana Torres Gómez', 'TOGA900315MDFRMN06', 'TOGA900315RT8', '13159012345', 'Gerente de ventas', '34000', '2020-06-15'),
            ('Carlos Ramírez Soto', 'RASC920801HDFMTR02', 'RASC920801LP5', '13179212345', 'Ejecutivo de ventas', '15500', '2021-03-01'),
            ('Diana Flores Vázquez', 'FOVD950122MNLLZN09', 'FOVD950122HJ1', '13209512345', 'Ejecutivo de ventas', '14800', '2022-09-12'),
            ('Ernesto Gutiérrez Lara', 'GULE850607HDFTRR01', 'GULE850607MN6', '13048512345', 'Jefe de almacén', '22000', '2020-01-20'),
            ('Fernanda Castro Ibarra', 'CAIF970914MJCSBR03', 'CAIF970914PQ2', '13229712345', 'Auxiliar de almacén', '10500', '2023-04-03'),
            ('Gabriel Navarro Peña', 'NAPG880330HPLVXB07', 'NAPG880330ZX9', '13088812345', 'Supervisor de producción', '25000', '2019-11-11'),
            ('Hilda Morales Cruz', 'MOCH990505MDFRRL05', 'MOCH990505VB4', '13249912345', 'Operario de producción', '11200', '2024-02-19'),
            ('Iván Reyes Domínguez', 'REDI010718HDFYMV08', 'REDI010718NM3', '13260112345', 'Operario de producción', '10800', '2025-01-06'),
            ('Julia Herrera Campos', 'HECJ870226MDFRML02', 'HECJ870226AS7', '13068712345', 'Contador', '28500', '2021-08-02'),
        ], start=1):
            self.empleados[nombre] = self._post(self.api, '/api/rrhh/empleados/contratar/', {
                'nombre_completo': nombre, 'curp': curp, 'rfc': rfc, 'nss': nss,
                'telefono': f'55 {5100 + numero * 13} {2300 + numero * 71}',
                'email': _sin_acentos(f'{nombre.split()[0]}.{nombre.split()[1]}@{DOMINIO}'),
                'cuenta_bancaria': f'0121800{numero:02d}{numero * 7919:09d}',
                'posicion': posiciones[posicion], 'salario_asignado': salario, 'fecha_inicio': inicio,
            })['id']

        parentescos = ['Esposo(a)', 'Madre', 'Padre', 'Hermano(a)', 'Hijo(a)']
        for indice, (nombre, empleado) in enumerate(self.empleados.items()):
            apellido = nombre.split()[1]
            self._post(self.api, '/api/rrhh/contactos-emergencia/', {
                'empleado': empleado, 'nombre_contacto': f'{["María", "José", "Rosa", "Luis", "Carmen"][indice % 5]} {apellido}',
                'telefono': f'55 {7000 + indice * 37} {2000 + indice * 53}', 'parentesco': parentescos[indice % 5],
            })
        dependientes = [('Ana Torres Gómez', 'Sofía Torres', 'Hija'), ('Ana Torres Gómez', 'Mateo Torres', 'Hijo'),
                        ('Carlos Ramírez Soto', 'Valeria Ramírez', 'Hija'), ('Ernesto Gutiérrez Lara', 'Lucía Gutiérrez', 'Esposa'),
                        ('Gabriel Navarro Peña', 'Emilio Navarro', 'Hijo'), ('Julia Herrera Campos', 'Tomás Herrera', 'Hijo')]
        for empleado, nombre, parentesco in dependientes:
            self._post(self.api, '/api/rrhh/dependientes/', {
                'empleado': self.empleados[empleado], 'nombre_dependiente': nombre, 'parentesco': parentesco,
            })
        self.resumen.append(f'RRHH: {len(departamentos)} departamentos, {len(posiciones)} posiciones, '
                            f'{len(self.empleados)} empleados, {len(self.empleados)} contactos, {len(dependientes)} dependientes.')

    def _usuarios(self):
        # El admin demo ya existe (Laura); se vincula a su empleado.
        self._patch(self.api, f'/api/usuarios/{self.admin.id}/', {'empleado': self.empleados['Laura Mendoza Ruiz']})
        self.operadores = []
        for nombre, correo, rol in [
            ('Ana Torres Gómez', CENTINELA, 'operador'),
            ('Carlos Ramírez Soto', f'carlos.ramirez@{DOMINIO}', 'operador'),
            ('Diana Flores Vázquez', f'diana.flores@{DOMINIO}', 'operador'),
            ('Ernesto Gutiérrez Lara', f'ernesto.gutierrez@{DOMINIO}', 'operador'),
            ('Julia Herrera Campos', f'julia.herrera@{DOMINIO}', 'admin'),
        ]:
            partes = nombre.split()
            creado = self._post(self.api, '/api/usuarios/', {
                'email': correo, 'username': correo, 'first_name': partes[0], 'last_name': ' '.join(partes[1:]),
                'rol_usuario': rol, 'empleado': self.empleados[nombre], 'password': CONTRASENA_DEMO,
            })
            if rol == 'operador':
                self.operadores.append(Usuario.objects.get(pk=creado['id']))
        self.resumen.append('Usuarios: 6 (2 admin y 4 operadores), vinculados a sus empleados.')

    def _caja_inicial(self):
        self._post(self.api, '/api/caja/', {
            'tipo_movimiento': 'ingreso', 'monto': '250000.00', 'observacion': 'Aportación de capital de los socios',
        })

    def _compras(self):
        matriz, norte, occidente, sur, almacen = self.sucursales
        p, m, prov = self.productos, self.materias, self.proveedores
        compras = [
            (prov[1], almacen, [], [('agua', '400', '4.50'), ('cloruro', '1000', '0.04'), ('glucosa', '2000', '0.05')]),
            (prov[1], almacen, [], [('citrato', '600', '0.10'), ('carbopol', '500', '0.41'), ('glicerina', '1000', '0.08')]),
            (prov[8], almacen, [], [('alcohol', '120', '48.00')]),
            (prov[2], almacen, [], [('botella500', '500', '3.20'), ('botella1l', '200', '4.10')]),
            (prov[3], almacen, [], [('etiqueta', '800', '0.60')]),
            (prov[4], matriz, [('CUR-001', '150', '9.80'), ('CUR-002', '80', '21.00')], []),
            (prov[7], matriz, [('HIG-003', '60', '48.00'), ('CUR-003', '50', '105.00')], []),
            (prov[5], matriz, [('INS-001', '30', '82.00'), ('INS-002', '12', '410.00')], []),
            (prov[6], norte, [('CUR-001', '60', '9.90'), ('CUR-002', '40', '21.50')], []),
            (prov[9], occidente, [('HIG-003', '30', '49.00'), ('CUR-003', '20', '106.00')], []),
            (prov[4], sur, [('CUR-001', '40', '9.80')], []),
            (prov[0], matriz, [('INS-001', '10', '85.00')], []),
        ]
        ids = []
        for proveedor, sucursal, productos, materias in compras:
            ids.append(self._post(self.api, '/api/compras/', {
                'proveedor': proveedor, 'sucursal': sucursal,
                'detalles_producto': [{'producto': p[s], 'cantidad': c, 'costo_unitario': u} for s, c, u in productos],
                'detalles_materia_prima': [{'materia_prima': m[k], 'cantidad': c, 'costo_unitario': u}
                                           for k, c, u in materias],
            })['id'])
        # Las 10 primeras se reciben (dan el stock); una queda pendiente y otra se cancela.
        for compra in ids[:10]:
            self._recibir_si_pendiente(compra)
        self._post(self.api, f'/api/compras/{ids[11]}/cancelar/')
        self.resumen.append(f'Compras: {len(ids)} (10 recibidas, 1 pendiente, 1 cancelada).')

    def _recibir_si_pendiente(self, compra):
        if self._get(self.api, f'/api/compras/{compra}/')['estado'] == 'pendiente':
            self._post(self.api, f'/api/compras/{compra}/recibir/')

    def _produccion(self):
        p, m = self.productos, self.materias
        recetas = {
            'SOL-001': [('agua', '0.5'), ('glucosa', '10'), ('citrato', '3'), ('botella500', '1'), ('etiqueta', '1')],
            'SOL-002': [('agua', '1'), ('cloruro', '9'), ('botella1l', '1'), ('etiqueta', '1')],
            'HIG-001': [('alcohol', '0.37'), ('agua', '0.13'), ('botella500', '1'), ('etiqueta', '1')],
            'HIG-002': [('alcohol', '0.35'), ('carbopol', '5'), ('glicerina', '10'), ('agua', '0.13'),
                        ('botella500', '1'), ('etiqueta', '1')],
        }
        lineas = 0
        for sku, componentes in recetas.items():
            for clave, cantidad in componentes:
                self._post(self.api, '/api/produccion/recetas/', {
                    'producto': p[sku], 'materia_prima': m[clave], 'cantidad_requerida': cantidad,
                })
                lineas += 1
        almacen = self.sucursales[4]
        producciones = [('SOL-001', '60'), ('SOL-002', '40'), ('HIG-001', '50'), ('HIG-002', '40'), ('SOL-001', '50'),
                        ('SOL-002', '30'), ('HIG-001', '40'), ('HIG-002', '30'), ('SOL-001', '40'), ('HIG-001', '30')]
        for sku, cantidad in producciones:
            self._post(self.api, '/api/produccion/', {'producto': p[sku], 'sucursal': almacen, 'cantidad_producida': cantidad})
        self.resumen.append(f'Producción: {lineas} líneas de receta (4 productos), {len(producciones)} producciones.')

    def _traslados(self):
        matriz, norte, occidente, sur, almacen = self.sucursales
        p, m = self.productos, self.materias
        traslados = [
            (almacen, matriz, [('SOL-001', '40'), ('SOL-002', '25'), ('HIG-001', '30'), ('HIG-002', '25')]),
            (almacen, norte, [('SOL-001', '25'), ('HIG-001', '20'), ('HIG-002', '15')]),
            (almacen, occidente, [('SOL-001', '25'), ('SOL-002', '15'), ('HIG-002', '10')]),
            (almacen, sur, [('SOL-001', '20'), ('HIG-001', '15')]),
            (matriz, norte, [('INS-001', '6'), ('INS-002', '3')]),
            (matriz, occidente, [('INS-001', '6'), ('CUR-003', '10')]),
            (matriz, sur, [('INS-002', '2'), ('HIG-003', '10')]),
            (norte, sur, [('CUR-002', '10')]),
            (almacen, norte, [('materia:etiqueta', '50')]),
            (matriz, almacen, [('CUR-001', '20')]),
        ]
        for origen, destino, lineas in traslados:
            detalles = []
            for clave, cantidad in lineas:
                if clave.startswith('materia:'):
                    detalles.append({'tipo_item': 'materia_prima', 'item_id': m[clave.split(':')[1]], 'cantidad': cantidad})
                else:
                    detalles.append({'tipo_item': 'producto', 'item_id': p[clave], 'cantidad': cantidad})
            self._post(self.api, '/api/inventario/traslados/', {
                'sucursal_origen': origen, 'sucursal_destino': destino, 'detalles': detalles,
            })
        self.resumen.append(f'Inventario: {len(traslados)} traslados entre sucursales.')

    def _ventas(self):
        matriz, norte, occidente, sur, _almacen = self.sucursales
        p, c, fiscales = self.productos, self.clientes, self.clientes_fiscales
        ana, carlos, diana, ernesto = self.operadores
        ventas = [
            # (usuario, sucursal, cliente, líneas, envío)
            (self.admin, matriz, fiscales[0], [('SOL-002', '10'), ('CUR-001', '20'), ('CUR-003', '5')], None),
            (self.admin, matriz, fiscales[1], [('INS-002', '2'), ('INS-001', '4')], None),
            (self.admin, matriz, fiscales[2], [('HIG-001', '12'), ('HIG-002', '10'), ('HIG-003', '6')], None),
            (self.admin, matriz, fiscales[3], [('INS-001', '1'), ('CUR-002', '4')], None),
            (self.admin, matriz, None, [('SOL-001', '3'), ('CUR-001', '2')], None),
            (self.admin, matriz, c[7], [('CUR-003', '4'), ('SOL-001', '12')], '150.00'),
            (ana, matriz, fiscales[5], [('SOL-002', '8'), ('CUR-003', '3')], None),
            (ana, matriz, c[6], [('HIG-002', '2')], None),
            (carlos, norte, fiscales[4], [('SOL-001', '15'), ('HIG-001', '8'), ('CUR-001', '10')], None),
            (carlos, norte, None, [('HIG-002', '3'), ('INS-001', '1')], None),
            (diana, occidente, c[9], [('HIG-003', '5'), ('SOL-002', '6')], '120.00'),
            (diana, occidente, c[8], [('CUR-003', '2'), ('SOL-001', '10')], None),
            (ernesto, sur, None, [('SOL-001', '4'), ('HIG-001', '2')], None),
        ]
        self.ventas_facturables = []
        ids = []
        for usuario, sucursal, cliente, lineas, envio in ventas:
            datos = {'sucursal': sucursal, 'cliente': cliente,
                     'detalles': [{'producto': p[sku], 'cantidad': cantidad} for sku, cantidad in lineas]}
            if envio:
                datos.update(gasto_envio=envio, fecha_entrega=str(timezone.localdate()))
            venta = self._post(self._cliente(usuario), '/api/ventas/', datos)
            ids.append(venta['id'])
            if cliente in fiscales:
                self.ventas_facturables.append(venta['id'])
        # Una venta con envío se entrega y la otra queda pendiente; una de mostrador se cancela.
        self._entregar_si_pendiente(ids[5])
        self._post(self.api, f'/api/ventas/{ids[4]}/cancelar/')
        self.resumen.append(f'Ventas: {len(ids)} (6 del admin y 7 de operadores; 1 con envío pendiente, 1 cancelada).')

    def _entregar_si_pendiente(self, venta):
        if self._get(self.api, f'/api/ventas/{venta}/')['estado'] == 'pendiente':
            self._post(self.api, f'/api/ventas/{venta}/entregar/')

    def _caja_gastos(self):
        movimientos = [
            ('retiro', '18500.00', 'Renta del local Matriz (octubre)'),
            ('retiro', '3240.00', 'Recibo de luz CFE'),
            ('retiro', '1180.00', 'Servicio de internet y telefonía'),
            ('retiro', '850.00', 'Papelería y artículos de oficina'),
            ('ingreso', '2500.00', 'Reembolso de flete por parte de proveedor'),
            ('retiro', '2100.00', 'Mantenimiento del montacargas'),
            ('ingreso', '1200.00', 'Venta de cartón y PET de desecho'),
            ('retiro', '640.00', 'Garrafones de agua y cafetería'),
            ('retiro', '4300.00', 'Gasolina de unidades de reparto'),
        ]
        for tipo, monto, observacion in movimientos:
            self._post(self.api, '/api/caja/', {'tipo_movimiento': tipo, 'monto': monto, 'observacion': observacion})
        self.resumen.append(f'Caja: {len(movimientos) + 1} movimientos manuales (más los automáticos de compras, '
                            'ventas y nómina).')

    def _nomina(self):
        # Primera quincena del mes en curso (o la segunda del anterior, si aún no termina).
        hoy = timezone.localdate()
        anio, mes, quincena = (hoy.year, hoy.month, 1) if hoy.day > 15 else (
            (hoy.year, hoy.month - 1, 2) if hoy.month > 1 else (hoy.year - 1, 12, 2))
        generadas = self._post(self.api, '/api/rrhh/solicitudes-nomina/generar/',
                               {'anio': anio, 'mes': mes, 'quincena': quincena})['creadas']
        demo = [s['id'] for s in generadas if s['empleado'] in self.empleados.values()]
        self._post(self.api, '/api/rrhh/solicitudes-nomina/pagar-lote/', {'ids': demo[:7]})
        if len(demo) > 7:
            self._post(self.api, f'/api/rrhh/solicitudes-nomina/{demo[7]}/rechazar/')
        self.resumen.append(f'Nómina: {len(demo)} solicitudes de la quincena {quincena} de {mes:02d}/{anio} '
                            '(7 pagadas, 1 rechazada, el resto pendiente).')

    def _facturacion(self):
        pac = MagicMock()
        # Con `--simular` no se devuelve XML: la vista lo guardaría en disco y
        # el archivo sobreviviría al rollback de la base de datos.
        xml = '' if self.simular else (
            '<cfdi:Comprobante Version="4.0"><!-- CFDI de demostración, sin validez fiscal --></cfdi:Comprobante>'
        )
        pac.timbrar.side_effect = lambda datos: {'exito': True, 'folio_fiscal': _folio_demo(), 'xml': xml}
        pac.timbrar_complemento_pago.side_effect = lambda datos: {'exito': True, 'folio_fiscal': _folio_demo()}
        facturas = []
        with patch('apps.facturacion.views.PACClient', return_value=pac):
            for indice, venta in enumerate(self.ventas_facturables):
                metodo = 'PPD' if indice in (1, 4) else 'PUE'
                facturas.append(self._post(self.api, '/api/facturacion/', {
                    'venta': venta, 'uso_cfdi': 'G03', 'forma_pago': '99' if metodo == 'PPD' else '03',
                    'metodo_pago': metodo,
                }))
            complementos = 0
            for factura in facturas:
                if factura['metodo_pago'] == 'PPD':
                    # Primer pago parcial: la mitad del total.
                    monto = (Decimal(factura['venta_total']) / 2).quantize(Decimal('0.01'))
                    self._post(self.api, '/api/facturacion/complementos-pago/', {
                        'factura': factura['id'], 'monto_pagado': str(monto), 'fecha_pago': str(timezone.localdate()),
                    })
                    complementos += 1
        self.resumen.append(f'Facturación: {len(facturas)} facturas con PAC simulado (folios DEMO…), '
                            f'{complementos} complementos de pago.')

    def _contabilidad(self):
        cuentas = {c['codigo']: c['id'] for c in self._get(self.api, '/api/contabilidad/cuentas/')}
        nuevas = [('1110', 'Bancos', 'activo', '1000'), ('1310', 'Inventario de materia prima', 'activo', '1300'),
                  ('2110', 'Acreedores diversos', 'pasivo', '2000'), ('5210', 'Renta de locales', 'egreso', '5200'),
                  ('5220', 'Servicios (luz, agua, internet)', 'egreso', '5200'), ('5230', 'Combustibles', 'egreso', '5200')]
        creadas = 0
        for codigo, nombre, tipo, padre in nuevas:
            if codigo in cuentas:
                continue
            self._post(self.api, '/api/contabilidad/cuentas/', {
                'codigo': codigo, 'nombre': nombre, 'tipo': tipo, 'cuenta_padre': cuentas.get(padre),
            })
            creadas += 1
        self.resumen.append(f'Contabilidad: {creadas} subcuentas nuevas; los asientos se generaron con cada operación.')

    def _auditoria(self):
        saldo = Decimal(str(self._get(self.api, '/api/caja/saldo/')['saldo_total']))
        # Faltante de $150 en el arqueo.
        self._post(self.api, '/api/auditoria/cortes-caja/', {
            'monto_contado': str(saldo - Decimal('150.00')), 'observacion': 'Arqueo de cierre; faltan $150 sin justificar.',
        })
        p = self.productos
        matriz, norte = self.sucursales[0], self.sucursales[1]
        conteos = [
            (self.operadores[0], matriz, [('CUR-001', None, 0), ('CUR-002', None, 0), ('INS-001', None, -1)]),
            (self.operadores[1], norte, [('SOL-001', None, 0), ('HIG-001', None, 0), ('CUR-002', None, -2)]),
        ]
        for usuario, sucursal, lineas in conteos:
            stock = {fila['id']: Decimal(str(fila['stock_actual'])) for fila in self._stock(sucursal)}
            self._post(self._cliente(usuario), '/api/auditoria/conteos/', {
                'sucursal': sucursal, 'observacion': 'Conteo cíclico de anaquel',
                'detalles': [{'tipo_item': 'producto', 'item_id': p[sku],
                              'cantidad_contada': str(stock.get(p[sku], Decimal(0)) + diferencia)}
                             for sku, _, diferencia in lineas],
            })
        for tipo in ('caja', 'inventario'):
            self._post(self.api, '/api/auditoria/ejecuciones/ejecutar/', {'tipo': tipo})
        abiertas = self._get(self.api, '/api/auditoria/discrepancias/', {'estado': 'abierta'})
        abiertas = abiertas['results'] if isinstance(abiertas, dict) else abiertas
        if abiertas:
            self._post(self.api, f'/api/auditoria/discrepancias/{abiertas[0]["id"]}/justificar/', {
                'comentario': 'Diferencia revisada con el responsable del turno.',
            })
        self.resumen.append(f'Auditoría: 1 corte de caja, {len(conteos)} conteos físicos, 2 ejecuciones, '
                            f'{len(abiertas)} discrepancias (1 justificada).')

    def _stock(self, sucursal):
        filas = self._get(self.api, '/api/inventario/stock/', {'sucursal': sucursal, 'tipo': 'producto'})
        return filas['results'] if isinstance(filas, dict) else filas

    def _analitica(self):
        self._post(self.api, '/api/analitica/generaciones/generar/')
        self.resumen.append('Analítica: 1 generación de pronósticos (para historial largo usa `generar_historial_demo`).')

    def _asistente(self):
        conversaciones = 0
        for usuario, mensajes in [
            (self.admin, [{'texto': '¿cuánto vendimos hoy?'}, {'texto': 'cuál fue la ganancia este mes'},
                          {'nodo': 'consulta:ventas_top_productos:hoy'}, {'texto': '¿qué clima hace mañana?'}]),
            (self.operadores[0], [{'texto': 'cuántas ventas llevo hoy'}, {'nodo': 'tema:compras'},
                                  {'texto': 'cómo va la lana'}]),
        ]:
            cliente = self._cliente(usuario)
            conversacion = self._post(cliente, '/api/asistente/conversaciones/')['conversacion']
            for mensaje in mensajes:
                self._post(cliente, f'/api/asistente/conversaciones/{conversacion}/mensajes/', mensaje)
            conversaciones += 1
        self.resumen.append(f'Asistente: {conversaciones} conversaciones con 7 mensajes registrados.')

