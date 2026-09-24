from django.conf import settings
from django.db import models


class Sucursal(models.Model):
    """Modelo mínimo — el CRUD completo (views/serializers/permisos) se
    implementa en la feature 006 · Sucursales. Aquí solo lo necesario para
    que Inventario (009) y el endpoint de alertas de la feature 001 puedan
    referenciarlo por FK.
    """

    nombre_sucursal = models.CharField(max_length=150)
    ubicacion_sucursal = models.CharField(max_length=255, blank=True)
    telefono_sucursal = models.CharField(max_length=30, blank=True)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_sucursal


class HistorialEstadoSucursal(models.Model):
    """Registro INSERT-only de cada cambio de `activo` en una sucursal, para
    auditoría — igual que MovimientosCaja/MovimientosInventario, nunca se
    edita ni se elimina. No se expone ningún endpoint de consulta todavía
    (ver `spec.md` de la feature 006, sección "Fuera de alcance").
    """

    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE, related_name='historial_estado')
    estado_anterior = models.BooleanField()
    estado_nuevo = models.BooleanField()
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    fecha = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.sucursal} — {self.estado_anterior} → {self.estado_nuevo} ({self.fecha})'
