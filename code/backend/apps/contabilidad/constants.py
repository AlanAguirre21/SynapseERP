"""Códigos de las cuentas contables base precargadas por la migración de
datos (`migrations/0002_cuentas_base.py`) — feature `018 · Contabilidad`.
`services/generador_asientos.py` postea siempre a estos códigos, nunca a
un nombre de cuenta en texto libre, para no depender de que el admin no
haya renombrado una cuenta.

`CODIGOS_CUENTAS_SISTEMA` son las cuentas que la generación automática de
asientos referencia en tiempo de ejecución — `CuentaContableViewSet` las
protege contra desactivación, para que un admin no pueda romper el
registro automático de Ventas/Compras/Caja sin darse cuenta.
"""

CODIGO_ACTIVO = '1000'
CODIGO_CAJA = '1100'
CODIGO_CLIENTES = '1200'
CODIGO_INVENTARIO = '1300'
CODIGO_PASIVO = '2000'
CODIGO_PROVEEDORES = '2100'
CODIGO_CAPITAL = '3000'
CODIGO_INGRESOS = '4000'
CODIGO_VENTAS = '4100'
CODIGO_EGRESOS = '5000'
CODIGO_COSTO_VENTAS = '5100'
CODIGO_GASTOS_GENERALES = '5200'

CODIGOS_CUENTAS_SISTEMA = frozenset({
    CODIGO_CAJA, CODIGO_INVENTARIO, CODIGO_PROVEEDORES, CODIGO_CAPITAL,
    CODIGO_VENTAS, CODIGO_COSTO_VENTAS, CODIGO_GASTOS_GENERALES,
})
