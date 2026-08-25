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
    desactivación por un admin) vive en la feature 008 · Personas, que
    también agrega la vinculación opcional con `Empleado`.

    Reutiliza `is_active` (heredado de `AbstractUser`) como el campo
    `activo` de este modelo en vez de agregar uno nuevo — `JWTAuthentication`
    ya rechaza a un usuario con `is_active=False` en cada petición
    autenticada (no solo en login), que es exactamente el comportamiento
    de "desactivación con efecto inmediato" que pide la feature 008.
    """

    email = models.EmailField('correo electrónico', unique=True)
    rol_usuario = models.CharField(max_length=20, choices=ROLES_USUARIO, default=ROL_OPERADOR)
    empleado = models.ForeignKey(
        'personas.Empleado', on_delete=models.SET_NULL, null=True, blank=True, related_name='usuarios',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def nombre_mostrado(self):
        return self.get_full_name() or self.username


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
