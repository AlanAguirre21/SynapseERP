import { useState } from 'react'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import type {
  FiltroMotivoMovimientoInventario,
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
import { ModalTraslado } from './ModalTraslado'

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
  traslado_salida: 'Traslado (salida)',
  traslado_entrada: 'Traslado (entrada)',
}

// Opciones del filtro de motivo: los dos motivos de traslado se agrupan en uno.
const OPCIONES_FILTRO_MOTIVO: { valor: FiltroMotivoMovimientoInventario; etiqueta: string }[] = [
  { valor: 'compra', etiqueta: 'Compra' },
  { valor: 'venta', etiqueta: 'Venta' },
  { valor: 'produccion_consumo', etiqueta: 'Consumo de producción' },
  { valor: 'produccion_entrada', etiqueta: 'Entrada de producción' },
  { valor: 'ajuste', etiqueta: 'Ajuste' },
  { valor: 'traslado', etiqueta: 'Traslado' },
]

function textoMotivo(movimiento: MovimientoInventario): string {
  if (movimiento.motivo === 'traslado_salida' || movimiento.motivo === 'traslado_entrada') {
    const sentido = movimiento.motivo === 'traslado_salida' ? 'salida' : 'entrada'
    const flecha = movimiento.motivo === 'traslado_salida' ? '→' : '←'
    const contraparte = movimiento.sucursal_contraparte ? ` ${flecha} ${movimiento.sucursal_contraparte}` : ''
    return `Traslado #${movimiento.referencia_id ?? '?'} (${sentido})${contraparte}`
  }
  return ETIQUETAS_MOTIVO[movimiento.motivo]
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
    <div className="cellStack">
      <input
        type="number"
        min={0}
        step={1}
        className="inputCompact"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        aria-label={`Stock mínimo de ${fila.nombre}`}
      />
      {error && <span className="fieldError">{error}</span>}
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
  const [trasladoAbierto, setTrasladoAbierto] = useState(false)

  const columnasStock: ColumnaTabla<StockItem>[] = [
    { clave: 'nombre', encabezado: 'Nombre' },
    { clave: 'stock_actual', alineacion: 'derecha', encabezado: 'Stock actual' },
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
        <span className={fila.stock_bajo ? 'status statusWarning' : 'status statusSuccess'}>
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
  const [motivoHistorial, setMotivoHistorial] = useState<FiltroMotivoMovimientoInventario | ''>('')

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
    motivo: motivoHistorial || undefined,
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
    { clave: 'cantidad', alineacion: 'derecha', encabezado: 'Cantidad' },
    { clave: 'motivo', encabezado: 'Motivo', render: (fila) => textoMotivo(fila) },
    { clave: 'usuario_nombre', encabezado: 'Usuario' },
  ]

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="pageTitle">Inventario</h1>
      </div>

      <div className="tabs" role="tablist">
        {PESTAÑAS_STOCK.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={tipoStock === p.clave}
            className={tipoStock === p.clave ? 'tab tabActive' : 'tab'}
            onClick={() => setTipoStock(p.clave)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="filterField">
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

        <div className="filtersEnd">
          <BotonPrimario onClick={() => setTrasladoAbierto(true)}>Traslado</BotonPrimario>
        </div>
      </div>

      {/* Se monta solo al abrirse: cerrar descarta el estado del formulario. */}
      {trasladoAbierto && (
        <ModalTraslado
          onCerrar={() => setTrasladoAbierto(false)}
          sucursalInicial={sucursalStock}
          tipoInicial={tipoStock}
        />
      )}

      {cargandoStock ? (
        <p>Cargando inventario…</p>
      ) : (
        <Tabla
          columnas={columnasStock}
          datos={stock ?? []}
          mensajeVacio="No hay ítems para mostrar en esta sucursal."
        />
      )}

      <h2 className="sectionTitle">Historial de movimientos</h2>

      <div className="filters">
        <label className="filterField">
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

        <label className="filterField">
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

        <label className="filterField">
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

        <label className="filterField">
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

        <label className="filterField">
          Motivo
          <select
            value={motivoHistorial}
            onChange={(e) => setMotivoHistorial(e.target.value as FiltroMotivoMovimientoInventario | '')}
          >
            <option value="">Todos</option>
            {OPCIONES_FILTRO_MOTIVO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
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
