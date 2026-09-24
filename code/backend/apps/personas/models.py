# App vaciada por las features 008 · RRHH y 009 · Terceros:
# - `Empleado` se movió a `apps.rrhh` (008).
# - `Cliente`, `DatosFiscalesCliente`, `Proveedor` se movieron a
#   `apps.terceros` (009), sin cambios de campos.
#
# La app sigue registrada en `INSTALLED_APPS` únicamente para que el grafo
# de migraciones siga resolviendo las dependencias históricas que otras
# apps ya declararon contra `('personas', '0001_initial')`
# (`usuarios.migrations.0003_usuario_empleado`,
# `ventas.migrations.0001_initial`, `compras.migrations.0001_initial`,
# `catalogo.migrations.0003_materiaprima_proveedor_principal`) — no tiene
# modelos, vistas, serializers ni rutas propias.
