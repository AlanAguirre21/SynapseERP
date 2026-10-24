from rest_framework.permissions import SAFE_METHODS, BasePermission

ROL_ADMIN = 'admin'
ROL_OPERADOR = 'operador'


<<<<<<< HEAD
=======
def es_admin(usuario):
    """El admin ve los registros de todos; el operador solo los que él
    registró (ventas, compras y las facturas de sus ventas — `013`, `012`,
    `019` y `016`, "Actualización: el operador solo ve sus propios …")."""
    return bool(usuario and usuario.is_authenticated and usuario.rol_usuario == ROL_ADMIN)


>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
class EsAdmin(BasePermission):
    """Permite el acceso únicamente a usuarios autenticados con rol admin."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.rol_usuario == ROL_ADMIN
        )


class LecturaParaTodosEscrituraSoloAdmin(BasePermission):
    """Métodos seguros (GET/HEAD/OPTIONS) para cualquier usuario autenticado;
    escritura únicamente para rol admin. Patrón estándar para ViewSets de
    catálogo (Sucursales, Productos, etc.) según tech-stack.md."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.rol_usuario == ROL_ADMIN
