from django.db import models


class Cliente(models.Model):
    """CRUD sin restricción de rol — feature 008 · Personas. Los datos
    fiscales viven en `DatosFiscalesCliente` (tabla separada) porque la
    mayoría de los clientes no va a requerir factura.
    """

    nombre_cliente = models.CharField(max_length=150)
    telefono = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.CharField(max_length=255, blank=True)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_cliente


class DatosFiscalesCliente(models.Model):
    """Datos fiscales de un cliente (1:1). Obligatorios únicamente si
    `requiere_factura=True` — la validación de completitud vive en
    `ClienteSerializer`, no aquí, para dar un mensaje de error agrupado.
    """

    cliente = models.OneToOneField(Cliente, on_delete=models.CASCADE, related_name='datos_fiscales')
    rfc = models.CharField(max_length=13, blank=True)
    razon_social = models.CharField(max_length=255, blank=True)
    codigo_postal_fiscal = models.CharField(max_length=5, blank=True)
    regimen_fiscal = models.CharField(max_length=3, blank=True)
    uso_cfdi_default = models.CharField(max_length=4, blank=True)
    requiere_factura = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'datos fiscales de clientes'

    def __str__(self):
        return f'Datos fiscales de {self.cliente}'


class Proveedor(models.Model):
    """CRUD sin restricción de rol — feature 008 · Personas."""

    nombre_proveedor = models.CharField(max_length=150)
    rfc = models.CharField(max_length=13, blank=True)
    contacto_nombre = models.CharField(max_length=150, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.CharField(max_length=255, blank=True)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_proveedor


class Empleado(models.Model):
    """CRUD solo admin, lectura para operador — feature 008 · Personas.
    Global a la empresa: no tiene asociación a una sucursal específica.
    """

    nombre_completo = models.CharField(max_length=150)
    puesto = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    fecha_contratacion = models.DateField(null=True, blank=True)
    salario = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_completo
