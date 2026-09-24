from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from core.permissions import ROL_ADMIN, ROL_OPERADOR

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
