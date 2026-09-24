from rest_framework.exceptions import ValidationError

from .models import Sucursal


def validar_nombre_disponible(nombre, ubicacion, excluir_pk=None):
    """Aplica la regla de nombre duplicado de sucursales (ver `spec.md` de
    la feature 006): se permite reutilizar un `nombre_sucursal` únicamente
    si ninguna sucursal ACTIVA lo tiene, y ninguna sucursal (activa o
    inactiva) con ese nombre comparte la misma `ubicacion_sucursal` (dos
    ubicaciones vacías cuentan como coincidencia).

    Bloquea las filas candidatas con `select_for_update()` para evitar que
    dos registros/reactivaciones simultáneos con el mismo nombre pasen la
    validación a la vez. Debe llamarse dentro de un `transaction.atomic()`.
    """

    candidatas_qs = Sucursal.objects.select_for_update().filter(nombre_sucursal=nombre)
    if excluir_pk is not None:
        candidatas_qs = candidatas_qs.exclude(pk=excluir_pk)

    candidatas = list(candidatas_qs)

    if any(candidata.activo for candidata in candidatas):
        raise ValidationError(
            {'nombre_sucursal': ['Ya existe una sucursal activa con este nombre.']},
        )

    if any(candidata.ubicacion_sucursal == ubicacion for candidata in candidatas):
        raise ValidationError(
            {'nombre_sucursal': ['Ya existe una sucursal con este nombre y esta ubicación.']},
        )
