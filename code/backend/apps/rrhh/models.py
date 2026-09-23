from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models


# Carpeta/URL propia para fotografías de empleado, separada de `MEDIA_ROOT`
# a propósito: `MEDIA_ROOT` guarda los XML/PDF de Facturación (017), que
# nunca deben quedar accesibles por una URL pública (ver nota en
# `config/settings.py` y `apps/facturacion/views.py` — su descarga siempre
# pasa por una acción autenticada, nunca por un archivo estático abierto).
# Las fotos de empleado son menos sensibles y sí se aceptan servir por una
# URL estática simple en desarrollo, pero en su propio storage para no
# arrastrar esa exposición a Facturación si algún día se activa en producción.
#
# Se define como función (no como instancia directa) a propósito: Django
# recomienda un callable para un storage que depende de `settings`, porque
# `makemigrations` congelaría la ruta absoluta resuelta en este entorno
# dentro de la migración si se pasara la instancia directamente.
def almacenamiento_fotos_empleado():
    return FileSystemStorage(
        location=str(settings.EMPLEADOS_FOTOS_ROOT),
        base_url=f'/{settings.EMPLEADOS_FOTOS_URL}',
    )

MOTIVOS_CAMBIO = [
    ('contratacion', 'Contratación'),
    ('ascenso', 'Ascenso'),
    ('transferencia', 'Transferencia'),
    ('despido', 'Despido'),
    ('renuncia', 'Renuncia'),
]

ESTADOS_SOLICITUD_NOMINA = [
    ('pendiente', 'Pendiente'),
    ('aprobado', 'Aprobado'),
    ('rechazado', 'Rechazado'),
]


class Departamento(models.Model):
    """Jerarquía de departamentos de la empresa — feature 008 · RRHH."""

    nombre_departamento = models.CharField(max_length=150)
    departamento_padre = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subdepartamentos',
    )
    # FK a `Posicion` vía referencia de cadena: ambos modelos se refieren
    # mutuamente (Posicion.departamento es obligatorio), así que Django
    # resuelve el ciclo generando la migración inicial en dos pasos
    # (CreateModel + AddField) automáticamente.
    posicion_manager = models.ForeignKey(
        'Posicion', on_delete=models.SET_NULL, null=True, blank=True, related_name='departamentos_dirigidos',
    )
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_departamento


class Posicion(models.Model):
    """Puesto dentro de un departamento, con su propia jerarquía interna
    (`reporta_a`) y el rango salarial que valida a `EmpleadoPosicion`.
    """

    titulo_posicion = models.CharField(max_length=150)
    departamento = models.ForeignKey(Departamento, on_delete=models.PROTECT, related_name='posiciones')
    reporta_a = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinadas',
    )
    salario_minimo = models.DecimalField(max_digits=12, decimal_places=2)
    salario_maximo = models.DecimalField(max_digits=12, decimal_places=2)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.titulo_posicion


class Empleado(models.Model):
    """Movido desde `apps.personas` (feature 008, antes `008 · Personas`).
    Global a la empresa: no tiene asociación a una sucursal específica.
    `puesto`/`fecha_contratacion`/`salario` ya no viven aquí — ahora son
    responsabilidad de `Posicion`/`EmpleadoPosicion`.
    """

    nombre_completo = models.CharField(max_length=150)
    curp = models.CharField(max_length=18, blank=True)
    rfc = models.CharField(max_length=13, blank=True)
    nss = models.CharField(max_length=11, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    fotografia = models.ImageField(
        upload_to='', storage=almacenamiento_fotos_empleado, null=True, blank=True,
    )
    cuenta_bancaria = models.CharField(max_length=20, blank=True)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_completo


class EmpleadoPosicion(models.Model):
    """Historial de asignaciones de un empleado a una posición.
    `fecha_termino=None` significa asignación vigente — a lo sumo una por
    empleado en la práctica (lo hace cumplir `EmpleadoViewSet` al desactivar,
    no una constraint de base de datos, para no bloquear correcciones
    manuales de datos históricos inconsistentes).
    """

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='asignaciones')
    posicion = models.ForeignKey(Posicion, on_delete=models.PROTECT, related_name='asignaciones')
    salario_asignado = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_inicio = models.DateField()
    fecha_termino = models.DateField(null=True, blank=True)
    motivo_cambio = models.CharField(max_length=20, choices=MOTIVOS_CAMBIO)

    class Meta:
        ordering = ['-fecha_inicio']

    def __str__(self):
        return f'{self.empleado} — {self.posicion}'

    def vigente(self):
        return self.fecha_termino is None


class ContactoEmergencia(models.Model):
    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='contactos_emergencia')
    nombre_contacto = models.CharField(max_length=150)
    telefono = models.CharField(max_length=30)
    parentesco = models.CharField(max_length=50)

    def __str__(self):
        return f'{self.nombre_contacto} ({self.parentesco}) — contacto de {self.empleado}'


class Dependiente(models.Model):
    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='dependientes')
    nombre_dependiente = models.CharField(max_length=150)
    parentesco = models.CharField(max_length=50)

    def __str__(self):
        return f'{self.nombre_dependiente} ({self.parentesco}) — dependiente de {self.empleado}'


class SolicitudNomina(models.Model):
    """Registro informativo de solicitud de pago de nómina. No genera
    movimientos de caja automáticos (ver `spec.md`, "Fuera de alcance") —
    aprobar/rechazar solo deja constancia de la decisión y quién la tomó.
    """

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name='solicitudes_nomina')
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    estado = models.CharField(max_length=10, choices=ESTADOS_SOLICITUD_NOMINA, default='pendiente')
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    resuelto_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_nomina_resueltas',
    )

    class Meta:
        ordering = ['-fecha_solicitud']

    def __str__(self):
        return f'Nómina de {self.empleado} ({self.periodo_inicio} — {self.periodo_fin})'
