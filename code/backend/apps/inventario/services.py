"""Únicas funciones autorizadas para mutar `InventarioSucursalProducto`/
`MateriaPrima` y para insertar `MovimientoInventario` — la constitución
designa a esta app como dueña exclusiva de esas tablas (`tech-stack.md`:
"ningún otro app escribe a stock directo"), así que `apps/compras` y
`apps/ventas` llaman a estas funciones en vez de manipular los modelos
por su cuenta.
"""

from rest_framework.exceptions import ValidationError

from .models import (
    DetalleTraslado,
    InventarioSucursalMateriaPrima,
    InventarioSucursalProducto,
    MovimientoInventario,
    Traslado,
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


def _nombre_item(tipo_item, item):
    return item.nombre_producto if tipo_item == MovimientoInventario.TIPO_PRODUCTO else item.nombre_item


def _bloquear_inventario(tipo_item, sucursal, item):
    if tipo_item == MovimientoInventario.TIPO_PRODUCTO:
        return bloquear_inventario_producto(sucursal, item)
    return bloquear_inventario_materia_prima(sucursal, item)


def ajustar_stock(*, sucursal, tipo_item, item, diferencia, referencia_id, usuario):
    """Aplica un ajuste de stock por `diferencia` (positiva = entrada,
    negativa = salida) con su `MovimientoInventario` motivo `ajuste`. Lo usa
    la aprobación de discrepancias de conteo físico (`022 · Auditoría
    automatizada`). Debe llamarse dentro de `transaction.atomic()`.

    Rechaza una salida mayor al stock actual: el stock nunca queda negativo.
    """

    if diferencia == 0:
        raise ValidationError({'detail': 'Un ajuste de stock necesita una diferencia distinta de cero.'})

    inventario = _bloquear_inventario(tipo_item, sucursal, item)
    cantidad = abs(diferencia)
    if diferencia < 0 and inventario.stock_actual < cantidad:
        raise ValidationError({
            'detail': f'No se puede retirar {cantidad} de "{_nombre_item(tipo_item, item)}" en '
                      f'{sucursal.nombre_sucursal}: el stock actual es {inventario.stock_actual}.',
        })

    inventario.stock_actual += diferencia
    inventario.save(update_fields=['stock_actual'])
    return registrar_movimiento_inventario(
        sucursal=sucursal, tipo_item=tipo_item, item_id=item.pk,
        tipo_movimiento=MovimientoInventario.ENTRADA if diferencia > 0 else MovimientoInventario.SALIDA,
        cantidad=cantidad, motivo=MovimientoInventario.MOTIVO_AJUSTE, referencia_id=referencia_id,
        stock_resultante=inventario.stock_actual, usuario=usuario,
    )


def trasladar_stock(*, sucursal_origen, sucursal_destino, lineas, usuario):
    """Registra un `Traslado` con sus líneas y mueve el stock de origen a
    destino. Debe llamarse dentro de `transaction.atomic()`.

    `lineas` es una lista de `(tipo_item, item, cantidad)` ya validada por
    `TrasladoSerializer` (ítems activos, sin repetidos, cantidad > 0).

    Todo-o-nada: se bloquean y validan TODAS las líneas antes de escribir
    nada. El bloqueo sigue un orden global fijo (productos antes que
    materia prima, luego `item_id`, luego `sucursal_id` ascendente) para
    evitar deadlocks entre traslados simultáneos que comparten ítems — ej.
    A→B y B→A, que de otro modo bloquearían las mismas filas en orden
    inverso.
    """

    orden_tipo = {MovimientoInventario.TIPO_PRODUCTO: 0, MovimientoInventario.TIPO_MATERIA_PRIMA: 1}
    lineas_ordenadas = sorted(lineas, key=lambda linea: (orden_tipo[linea[0]], linea[1].pk))
    sucursales_en_orden = sorted([sucursal_origen, sucursal_destino], key=lambda sucursal: sucursal.pk)

    bloqueadas = []
    faltantes = []
    for tipo_item, item, cantidad in lineas_ordenadas:
        inventarios = {
            sucursal.pk: _bloquear_inventario(tipo_item, sucursal, item) for sucursal in sucursales_en_orden
        }
        inventario_origen = inventarios[sucursal_origen.pk]
        inventario_destino = inventarios[sucursal_destino.pk]
        bloqueadas.append((tipo_item, item, cantidad, inventario_origen, inventario_destino))
        if inventario_origen.stock_actual < cantidad:
            faltantes.append(
                f'"{_nombre_item(tipo_item, item)}" (disponible: {inventario_origen.stock_actual}, '
                f'solicitado: {cantidad})',
            )

    if faltantes:
        raise ValidationError({
            'detail': f'Stock insuficiente en {sucursal_origen.nombre_sucursal} de: {"; ".join(faltantes)}.',
        })

    traslado = Traslado.objects.create(
        sucursal_origen=sucursal_origen, sucursal_destino=sucursal_destino, usuario=usuario,
    )
    # Se conserva el orden de captura del usuario en el detalle (no el
    # orden de bloqueo), para que el resumen se lea como se registró.
    DetalleTraslado.objects.bulk_create([
        DetalleTraslado(traslado=traslado, tipo_item=tipo_item, item_id=item.pk, cantidad=cantidad)
        for tipo_item, item, cantidad in lineas
    ])

    for tipo_item, item, cantidad, inventario_origen, inventario_destino in bloqueadas:
        inventario_origen.stock_actual -= cantidad
        inventario_origen.save(update_fields=['stock_actual'])
        inventario_destino.stock_actual += cantidad
        inventario_destino.save(update_fields=['stock_actual'])

        registrar_movimiento_inventario(
            sucursal=sucursal_origen, tipo_item=tipo_item, item_id=item.pk,
            tipo_movimiento=MovimientoInventario.SALIDA, cantidad=cantidad,
            motivo=MovimientoInventario.MOTIVO_TRASLADO_SALIDA, referencia_id=traslado.pk,
            stock_resultante=inventario_origen.stock_actual, usuario=usuario,
        )
        registrar_movimiento_inventario(
            sucursal=sucursal_destino, tipo_item=tipo_item, item_id=item.pk,
            tipo_movimiento=MovimientoInventario.ENTRADA, cantidad=cantidad,
            motivo=MovimientoInventario.MOTIVO_TRASLADO_ENTRADA, referencia_id=traslado.pk,
            stock_resultante=inventario_destino.stock_actual, usuario=usuario,
        )

    return traslado
