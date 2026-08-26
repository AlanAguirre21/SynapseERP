from django.db import models


class DatosFiscalesEmpresa(models.Model):
    """Fila única (singleton) con los datos fiscales de la empresa — el
    sistema sirve a una sola empresa, sin necesidad de una tabla de
    configuraciones múltiples (ver `plan.md` de la feature 016).
    `save()` fuerza `pk=1` para garantizar que nunca exista más de una fila;
    `cargar()` es el único punto de acceso que usan las vistas.
    """

    rfc = models.CharField('RFC', max_length=13, blank=True)
    razon_social = models.CharField(max_length=255, blank=True)
    regimen_fiscal = models.CharField(max_length=10, blank=True)
    codigo_postal_fiscal = models.CharField(max_length=5, blank=True)

    class Meta:
        verbose_name_plural = 'datos fiscales de la empresa'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def cargar(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def esta_completa(self):
        return bool(self.rfc and self.razon_social and self.regimen_fiscal and self.codigo_postal_fiscal)

    def __str__(self):
        return self.razon_social or 'Datos fiscales de la empresa'


class ConfiguracionPAC(models.Model):
    """Fila única (singleton) con la conexión al Proveedor Autorizado de
    Certificación (PAC) que usará `017 · Facturación` para timbrar.

    `api_key_cifrada` guarda la credencial cifrada con Fernet
    (`apps.configuracion_fiscal.crypto`) — nunca se expone en texto plano
    vía API, ni siquiera al rol admin (mismo principio que las contraseñas
    de usuario en `008`); solo se descifra internamente cuando `017`
    necesite llamar al PAC. `configuracion_extra` guarda credenciales
    adicionales específicas del proveedor elegido (algunos PACs piden
    usuario/contraseña además de la API key) sin necesitar una migración
    nueva si cambia el PAC contratado — ver `plan.md`, sección Riesgos.
    """

    proveedor = models.CharField(max_length=100, blank=True)
    api_key_cifrada = models.TextField(blank=True)
    api_endpoint = models.CharField(max_length=255, blank=True)
    configuracion_extra = models.JSONField(default=dict, blank=True)
    activo = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'configuración del PAC'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def cargar(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def esta_completa(self):
        return bool(self.proveedor and self.api_endpoint and self.api_key_cifrada)

    def __str__(self):
        return self.proveedor or 'Configuración del PAC'


class SerieFolio(models.Model):
    """Catálogo de series de facturación. El incremento real de
    `folio_actual` al timbrar una factura ocurre en `017 · Facturación`;
    aquí solo se define y gestiona el catálogo (alta/edición/desactivación)
    — mismo patrón reutilizable de `activo` que
    Sucursal/Categoria/Producto/MateriaPrima: nunca se borra físicamente
    vía API, solo se desactiva, sin importar si ya tiene folios usados.
    """

    serie = models.CharField(max_length=10, unique=True)
    folio_actual = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'series de folio'
        ordering = ['serie']

    def __str__(self):
        return self.serie
