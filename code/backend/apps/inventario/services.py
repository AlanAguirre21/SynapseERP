"""Únicas funciones autorizadas para mutar `InventarioSucursalProducto`/
`MateriaPrima` y para insertar `MovimientoInventario` — la constitución
designa a esta app como dueña exclusiva de esas tablas (`tech-stack.md`:
"ningún otro app escribe a stock directo"), así que `apps/compras` y
`apps/ventas` llaman a estas funciones en vez de manipular los modelos
por su cuenta.
"""

from .models import (
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
)


def bloquear_inventario_producto(sucursal, producto):
    """Obtiene (creándola si no existe) la fila de inventario de este
    producto en esta sucursal, y la bloquea con `select_for_update()`
    dentro de la transacción activa. `get_or_create()` ya maneja
    internamente el `IntegrityError` de una creación concurrente gracias al
    `unique_together` del modelo — no hace falta un `try/except` manual.
    """

    InventarioSucursalProducto.objects.get_or_create(sucursal=sucursal, producto=producto)
    return InventarioSucursalProducto.objects.select_for_update().get(sucursal=sucursal, producto=producto)


def bloquear_inventario_materia_prima(sucursal, materia_prima):
    InventarioSucursalMateriaPrima.objects.get_or_create(sucursal=sucursal, materia_prima=materia_prima)
    return InventarioSucursalMateriaPrima.objects.select_for_update().get(
        sucursal=sucursal, materia_prima=materia_prima,
    )


def registrar_movimiento_inventario(*, sucursal, tipo_item, item_id, tipo_movimiento, cantidad, motivo,
                                     referencia_id, stock_resultante, usuario):
    return MovimientoInventario.objects.create(
        sucursal=sucursal, tipo_item=tipo_item, item_id=item_id, tipo_movimiento=tipo_movimiento,
        cantidad=cantidad, motivo=motivo, referencia_id=referencia_id, stock_resultante=stock_resultante,
        usuario=usuario,
    )
