import { useState } from 'react'

import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import type {
  MotivoMovimientoInventario,
  MovimientoInventario,
  StockItem,
  TipoItemInventario,
  TipoMovimientoInventario,
} from '../../api/inventario'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useMovimientosInventario } from '../../hooks/useMovimientosInventario'
import { useProductos } from '../../hooks/useProductos'
import { useEditarStockMinimo, useStock } from '../../hooks/useInventario'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import styles from './Inventario.module.css'

const ETIQUETAS_TIPO_ITEM: Record<TipoItemInventario, string> = {
  producto: 'Producto',
  materia_prima: 'Materia prima',
}

const ETIQUETAS_TIPO_MOVIMIENTO: Record<TipoMovimientoInventario, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
}

const ETIQUETAS_MOTIVO: Record<MotivoMovimientoInventario, string> = {
  compra: 'Compra',
  venta: 'Venta',
  produccion_consumo: 'Consumo de producción',
  produccion_entrada: 'Entrada de producción',
  ajuste: 'Ajuste',
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

const PESTAÑAS_STOCK: { clave: TipoItemInventario; etiqueta: string }[] = [
  { clave: 'producto', etiqueta: 'Inventario de productos' },
  { clave: 'materia_prima', etiqueta: 'Inventario de materia prima' },
]

interface ErrorEditarStockMinimo {
  stock_minimo?: string[]
  detail?: string
}

function CeldaStockMinimoEditable({
  fila,
  tipo,
  sucursalId,
}: {
  fila: StockItem
  tipo: TipoItemInventario
  sucursalId: number
}) {
  const [valor, setValor] = useState(fila.stock_minimo)
  const [error, setError] = useState('')
  const editar = useEditarStockMinimo()

  async function guardar() {
    setError('')
    if (valor === fila.stock_minimo || valor.trim() === '') {
      setValor(fila.stock_minimo)
      return
    }

    try {
      await editar.mutateAsync({ tipo, sucursal: sucursalId, item_id: fila.id, stock_minimo: valor })
    } catch (err) {
      setValor(fila.stock_minimo)
      const datos =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: ErrorEditarStockMinimo } }).response?.data
          : undefined
      setError(datos?.stock_minimo?.[0] ?? datos?.detail ?? 'No se pudo guardar el stock mínimo.')
    }
  }

  return (
    <div className={styles.celdaStockMinimo}>
      <input
        type="number"
        min={0}
        step={1}
        className={styles.inputStockMinimo}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        aria-label={`Stock mínimo de ${fila.nombre}`}
      />
      {error && <span className={styles.errorStockMinimo}>{error}</span>}
    </div>
  )
}

export function Inventario() {
  const { data: sucursales } = useSucursales()
  const sucursalesActivas = (sucursales ?? []).filter((s) => s.activo)
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'

  const [tipoStock, setTipoStock] = useState<TipoItemInventario>('producto')
  // `null` mientras el usuario no elige explícitamente: se usa la primera
  // sucursal activa como default sin necesitar un efecto para "sincronizar"
  // el estado una vez cargan las sucursales.
  const [sucursalStockElegida, setSucursalStockElegida] = useState<number | null>(null)
  const sucursalStock = sucursalStockElegida ?? sucursalesActivas[0]?.id ?? null

  const { data: stock, isLoading: cargandoStock } = useStock(tipoStock, sucursalStock)

  const columnasStock: ColumnaTabla<StockItem>[] = [
    { clave: 'nombre', encabezado: 'Nombre' },
    { clave: 'stock_actual', encabezado: 'Stock actual' },
    {
      clave: 'stock_minimo',
      encabezado: 'Stock mínimo',
      render: (fila) =>
        esAdmin && sucursalStock !== null ? (
          // `key` incluye `stock_minimo` para remontar (resetear el input a
          // su nuevo valor) cuando cambia por otra vía — ej. refetch tras
          // invalidar la cache en otra pestaña — en vez de un efecto que
          // sincronice el estado local manualmente.
          <CeldaStockMinimoEditable
            key={`${fila.id}-${fila.stock_minimo}`}
            fila={fila}
            tipo={tipoStock}
            sucursalId={sucursalStock}
          />
        ) : (
          fila.stock_minimo
        ),
    },
    {
      clave: 'stock_bajo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.stock_bajo ? styles.estadoAlerta : styles.estadoNormal}>
          {fila.stock_bajo ? 'Bajo mínimo' : 'OK'}
        </span>
      ),
    },
  ]

  // --- Historial de movimientos --------------------------------------

  const [tipoItemHistorial, setTipoItemHistorial] = useState<TipoItemInventario | ''>('')
  const [itemHistorial, setItemHistorial] = useState<number | ''>('')
  const [sucursalHistorial, setSucursalHistorial] = useState<number | ''>('')
  const [tipoMovimientoHistorial, setTipoMovimientoHistorial] = useState<TipoMovimientoInventario | ''>('')

  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()

  const opcionesItem =
    tipoItemHistorial === 'producto'
      ? (productos ?? []).map((p) => ({ id: p.id, nombre: p.nombre_producto }))
      : tipoItemHistorial === 'materia_prima'
        ? (materiaPrima ?? []).map((m) => ({ id: m.id, nombre: m.nombre_item }))
        : []

  const { data: movimientos, isLoading: cargandoMovimientos } = useMovimientosInventario({
    tipo_item: tipoItemHistorial || undefined,
    item_id: itemHistorial || undefined,
    sucursal: sucursalHistorial || undefined,
    tipo_movimiento: tipoMovimientoHistorial || undefined,
  })

  const columnasMovimientos: ColumnaTabla<MovimientoInventario>[] = [
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => formatearFecha(fila.fecha) },
    { clave: 'item_nombre', encabezado: 'Ítem' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal' },
    {
      clave: 'tipo_movimiento',
      encabezado: 'Tipo',
      render: (fila) => ETIQUETAS_TIPO_MOVIMIENTO[fila.tipo_movimiento],
    },
    { clave: 'cantidad', encabezado: 'Cantidad' },
    { clave: 'motivo', encabezado: 'Motivo', render: (fila) => ETIQUETAS_MOTIVO[fila.motivo] },
    { clave: 'usuario_nombre', encabezado: 'Usuario' },
  ]

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Inventario</h1>
      </div>

      <div className={styles.pestañas} role="tablist">
        {PESTAÑAS_STOCK.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={tipoStock === p.clave}
            className={tipoStock === p.clave ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
            onClick={() => setTipoStock(p.clave)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
          Sucursal
          <select
            value={sucursalStock ?? ''}
            onChange={(e) => setSucursalStockElegida(e.target.value ? Number(e.target.value) : null)}
          >
            {sucursalesActivas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_sucursal}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargandoStock ? (
        <p>Cargando inventario…</p>
      ) : (
        <Tabla
          columnas={columnasStock}
          datos={stock ?? []}
          mensajeVacio="No hay ítems para mostrar en esta sucursal."
        />
      )}

      <h2 className={styles.tituloSeccion}>Historial de movimientos</h2>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
          Tipo de ítem
          <select
            value={tipoItemHistorial}
            onChange={(e) => {
              setTipoItemHistorial(e.target.value as TipoItemInventario | '')
              setItemHistorial('')
            }}
          >
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_TIPO_ITEM) as TipoItemInventario[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETAS_TIPO_ITEM[tipo]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campoFiltro}>
          Ítem
          <select
            value={itemHistorial}
            onChange={(e) => setItemHistorial(e.target.value ? Number(e.target.value) : '')}
            disabled={!tipoItemHistorial}
          >
            <option value="">Todos</option>
            {opcionesItem.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campoFiltro}>
          Sucursal
          <select
            value={sucursalHistorial}
            onChange={(e) => setSucursalHistorial(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todas</option>
            {sucursalesActivas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_sucursal}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campoFiltro}>
          Tipo de movimiento
          <select
            value={tipoMovimientoHistorial}
            onChange={(e) => setTipoMovimientoHistorial(e.target.value as TipoMovimientoInventario | '')}
          >
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_TIPO_MOVIMIENTO) as TipoMovimientoInventario[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETAS_TIPO_MOVIMIENTO[tipo]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargandoMovimientos ? (
        <p>Cargando historial…</p>
      ) : (
        <Tabla
          columnas={columnasMovimientos}
          datos={movimientos ?? []}
          mensajeVacio="No hay movimientos de inventario para los filtros seleccionados."
        />
      )}
    </div>
  )
}
