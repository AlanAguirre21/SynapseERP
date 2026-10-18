import os
import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.utils import timezone

from core.permissions import ROL_ADMIN, ROL_OPERADOR


class AlmacenamientoFotosUsuario(FileSystemStorage):
    """Storage de las fotografías de perfil (017 / 010), en su propia carpeta
    y URL, igual que las fotos de empleado de 008 (ver nota en
    `config/settings.py`). Lee la carpeta de `settings` en cada acceso en vez
    de congelarla al cargar el modelo, para que los tests puedan apuntarla a
    una carpeta temporal y no escriban en la carpeta real de desarrollo.
    """

    @property
    def base_location(self):
        return str(settings.USUARIOS_FOTOS_ROOT)

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    @property
    def base_url(self):
        return f'/{settings.USUARIOS_FOTOS_URL}'


# Función (no instancia) por la misma razón que en RRHH: `makemigrations`
# no debe congelar nada dependiente del entorno dentro de la migración.
def almacenamiento_fotos_usuario():
    return AlmacenamientoFotosUsuario()


def ruta_foto_usuario(instance, filename):
    """Nombre aleatorio: no expone el nombre original del archivo ni permite
    que una subida sobrescriba la fotografía de otra cuenta."""
    extension = os.path.splitext(filename)[1].lower()
    return f'{uuid.uuid4().hex}{extension}'

ROLES_USUARIO = [
    (ROL_ADMIN, 'Administrador'),
    (ROL_OPERADOR, 'Operador'),
]


class Usuario(AbstractUser):
    """Modelo de usuario autenticado. El CRUD completo (alta/edición/
    desactivación por un admin) vive en la feature 010 · Usuarios.

    Reutiliza `is_active` (heredado de `AbstractUser`) como el campo
    `activo` de este modelo en vez de agregar uno nuevo — `JWTAuthentication`
    ya rechaza a un usuario con `is_active=False` en cada petición
    autenticada (no solo en login), que es exactamente el comportamiento
    de "desactivación con efecto inmediato" que pide la feature 010.
    """

    email = models.EmailField('correo electrónico', unique=True)
    rol_usuario = models.CharField(max_length=20, choices=ROLES_USUARIO, default=ROL_OPERADOR)
    # OneToOne (antes ForeignKey, convertido por 010 · Usuarios): un empleado
    # no debería tener dos cuentas de acceso simultáneas. `related_name`
    # singular (`usuario`, antes `usuarios`) refleja la cardinalidad nueva y
    # simplifica el selector del formulario de alta (`Empleado.objects.
    # filter(activo=True, usuario__isnull=True)`).
    empleado = models.OneToOneField(
        'rrhh.Empleado', on_delete=models.SET_NULL, null=True, blank=True, related_name='usuario',
    )
    # Fotografía de perfil (017 · Información de Usuario / 010 · Usuarios).
    # Independiente de `Empleado.fotografia`: cambiarla nunca toca datos de RRHH.
    foto_usuario = models.ImageField(
        upload_to=ruta_foto_usuario, storage=almacenamiento_fotos_usuario, null=True, blank=True,
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def nombre_mostrado(self):
        return self.get_full_name() or self.username


TIPOS_REGISTRO_ACCESO = [
    ('exitoso', 'Inicio de sesión exitoso'),
    ('cierre_sesion', 'Cierre de sesión'),
    ('fallido', 'Intento fallido'),
]


class RegistroAcceso(models.Model):
    """Historial de accesos — feature 010 · Usuarios. Insert-only, mismo
    patrón que `MovimientosCaja`/`MovimientosInventario`: ningún ViewSet
    expone `UPDATE`/`DELETE` sobre esta tabla.

    `usuario` es nulo únicamente cuando `tipo='fallido'` contra un correo
    que no existe en el sistema (`email_intentado` guarda ese correo) — se
    almacena por trazabilidad, pero al no tener `usuario` no aparece en el
    historial de accesos de nadie (esos endpoints solo listan
    `usuario.registros_acceso`), cumpliendo la nota de "Fuera de alcance"
    del spec sin necesitar un filtro adicional.
    """

    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, null=True, blank=True, related_name='registros_acceso',
    )
    tipo = models.CharField(max_length=20, choices=TIPOS_REGISTRO_ACCESO)
    email_intentado = models.CharField(max_length=254, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado_en']


class CodigoRecuperacion(models.Model):
    """Código de 6 dígitos para el flujo de 'Recuperar contraseña'.

    `verificado` distingue "el código de 6 dígitos fue ingresado
    correctamente" de `usado`, que la feature 005 · Cambiar contraseña
    marcará al completar el cambio real — así un código verificado sigue
    siendo la prueba válida de autorización hasta que se consume del todo.
    """

    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='codigos_recuperacion',
    )
    codigo = models.CharField(max_length=6)
    expira_en = models.DateTimeField()
    verificado = models.BooleanField(default=False)
    usado = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    def vigente(self):
        return not self.usado and timezone.now() < self.expira_en
