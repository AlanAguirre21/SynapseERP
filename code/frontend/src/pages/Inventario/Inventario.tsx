import { useMemo, useState } from 'react'

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
import type { Sucursal } from '../../api/sucursales'
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

// Cantidad con signo, como en un kárdex: "+2.50" entra, "−2.50" sale (signo
// menos tipográfico, no guion).
function cantidadConSigno(movimiento: MovimientoInventario): string {
  return `${movimiento.tipo_movimiento === 'entrada' ? '+' : '−'}${movimiento.cantidad}`
}

type Pestaña = 'existencias' | 'movimientos'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'existencias', etiqueta: 'Existencias' },
  { clave: 'movimientos', etiqueta: 'Movimientos' },
]

const TIPOS_EXISTENCIAS: { clave: TipoItemInventario; etiqueta: string }[] = [
  { clave: 'producto', etiqueta: 'Productos' },
  { clave: 'materia_prima', etiqueta: 'Materia prima' },
]

// Se lee de `window.location` y no con `useSearchParams` para que la página
// siga funcionando sin enrutador (sus tests la renderizan así). Solo se usa
// como valor inicial: la URL no se sincroniza al cambiar de sucursal.
function leerSucursalInicial(): number | null {
  const valor = new URLSearchParams(window.location.search).get('sucursal')
  if (!valor || !/^\d+$/.test(valor)) return null
  const id = Number(valor)
  return id > 0 ? id : null
}

export function Inventario() {
  const { data: sucursales } = useSucursales()
  const sucursalesActivas = (sucursales ?? []).filter((s) => s.activo)
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'

  const [pestaña, setPestaña] = useState<Pestaña>('existencias')

  // Sucursal y tipo de existencias viven aquí, no en su pestaña: el traslado
  // los usa como valores iniciales aunque se abra desde "Movimientos".
  const [tipoStock, setTipoStock] = useState<TipoItemInventario>('producto')
  // `null` mientras el usuario no elige explícitamente: se usa la primera
  // sucursal activa como default sin necesitar un efecto para "sincronizar"
  // el estado una vez cargan las sucursales. El valor inicial puede venir de
  // `?sucursal=ID` (enlace "Ver inventario" de Sucursales); solo se respeta si
  // corresponde a una sucursal activa.
  const [sucursalStockElegida, setSucursalStockElegida] = useState<number | null>(leerSucursalInicial)
  const sucursalStock =
    (sucursalesActivas.some((s) => s.id === sucursalStockElegida) ? sucursalStockElegida : null) ??
    sucursalesActivas[0]?.id ??
    null

  const [trasladoAbierto, setTrasladoAbierto] = useState(false)

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Inventario</h1>
          <p className="pageHint">Consulta las existencias por sucursal y el historial de entradas y salidas.</p>
        </div>
        <BotonPrimario onClick={() => setTrasladoAbierto(true)}>Traslado</BotonPrimario>
      </div>

      <div className="tabs" role="tablist">
        {PESTAÑAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestaña === p.clave}
            className={pestaña === p.clave ? 'tab tabActive' : 'tab'}
            onClick={() => setPestaña(p.clave)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestaña === 'existencias' && (
        <PestañaExistencias
          esAdmin={esAdmin}
          sucursalesActivas={sucursalesActivas}
          sucursal={sucursalStock}
          onCambiarSucursal={setSucursalStockElegida}
          tipo={tipoStock}
          onCambiarTipo={setTipoStock}
        />
      )}
      {pestaña === 'movimientos' && <PestañaMovimientos sucursalesActivas={sucursalesActivas} />}

      {/* Se monta solo al abrirse: cerrar descarta el estado del formulario. */}
      {trasladoAbierto && (
        <ModalTraslado
          onCerrar={() => setTrasladoAbierto(false)}
          sucursalInicial={sucursalStock}
          tipoInicial={tipoStock}
        />
      )}
    </div>
  )
}

// --- Existencias -------------------------------------------------------------

type EstadoExistencia = 'agotado' | 'bajoMinimo' | 'enExistencia'

// Prioridad: sin existencia > bajo el mínimo > en existencia. "Agotado" se
// deriva aquí; el backend solo informa `stock_bajo`, que con mínimo 0 nunca
// marca un ítem en cero.
function estadoExistencia(item: StockItem): EstadoExistencia {
  if (Number(item.stock_actual) <= 0) return 'agotado'
  if (item.stock_bajo) return 'bajoMinimo'
  return 'enExistencia'
}

const ESTADOS_EXISTENCIA: Record<EstadoExistencia, { etiqueta: string; clase: string }> = {
  agotado: { etiqueta: 'Agotado', clase: 'status statusError' },
  bajoMinimo: { etiqueta: 'Bajo mínimo', clase: 'status statusWarning' },
  enExistencia: { etiqueta: 'En existencia', clase: 'status statusSuccess' },
}

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
        className="inputCompact numeric"
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

function PestañaExistencias({
  esAdmin,
  sucursalesActivas,
  sucursal,
  onCambiarSucursal,
  tipo,
  onCambiarTipo,
}: {
  esAdmin: boolean
  sucursalesActivas: Sucursal[]
  sucursal: number | null
  onCambiarSucursal: (sucursal: number | null) => void
  tipo: TipoItemInventario
  onCambiarTipo: (tipo: TipoItemInventario) => void
}) {
  const { data: stock, isLoading } = useStock(tipo, sucursal)

  // Mismo `estadoExistencia` que la tabla: indicadores y filas nunca discrepan.
  const conteo = useMemo(() => {
    const totales: Record<EstadoExistencia, number> = { agotado: 0, bajoMinimo: 0, enExistencia: 0 }
    for (const item of stock ?? []) totales[estadoExistencia(item)] += 1
    return totales
  }, [stock])

  const columnas: ColumnaTabla<StockItem>[] = [
    { clave: 'nombre', encabezado: 'Nombre' },
    { clave: 'stock_actual', alineacion: 'derecha', encabezado: 'Stock actual' },
    {
      clave: 'stock_minimo',
      alineacion: 'derecha',
      encabezado: 'Stock mínimo',
      render: (fila) =>
        esAdmin && sucursal !== null ? (
          // `key` incluye `stock_minimo` para remontar (resetear el input a
          // su nuevo valor) cuando cambia por otra vía — ej. refetch tras
          // invalidar la cache en otra pestaña — en vez de un efecto que
          // sincronice el estado local manualmente.
          <CeldaStockMinimoEditable
            key={`${fila.id}-${fila.stock_minimo}`}
            fila={fila}
            tipo={tipo}
            sucursalId={sucursal}
          />
        ) : (
          fila.stock_minimo
        ),
    },
    {
      clave: 'stock_bajo',
      encabezado: 'Estado',
      render: (fila) => {
        const estado = ESTADOS_EXISTENCIA[estadoExistencia(fila)]
        return <span className={estado.clase}>{estado.etiqueta}</span>
      },
    },
  ]

  const cifra = (valor: number) => (stock ? valor : '…')

  return (
    <div className="tabPanel">
      <div className="filters">
        <label className="filterField">
          Sucursal
          <select
            value={sucursal ?? ''}
            onChange={(e) => onCambiarSucursal(e.target.value ? Number(e.target.value) : null)}
          >
            {sucursalesActivas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_sucursal}
              </option>
            ))}
          </select>
        </label>

        <div className="filterField">
          <span>Tipo de ítem</span>
          <div className="segmented" role="tablist" aria-label="Tipo de ítem">
            {TIPOS_EXISTENCIAS.map((t) => (
              <button
                key={t.clave}
                type="button"
                role="tab"
                aria-selected={tipo === t.clave}
                className={tipo === t.clave ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
                onClick={() => onCambiarTipo(t.clave)}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Ítems</span>
          <span className="statValue">{cifra((stock ?? []).length)}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">En existencia</span>
          <span className="statValue">{cifra(conteo.enExistencia)}</span>
        </div>
        <div className={conteo.bajoMinimo > 0 ? 'statTile statTileWarning' : 'statTile'}>
          <span className="statLabel">Bajo mínimo</span>
          <span className="statValue">{cifra(conteo.bajoMinimo)}</span>
        </div>
        <div className={conteo.agotado > 0 ? 'statTile statTileDanger' : 'statTile'}>
          <span className="statLabel">Agotados</span>
          <span className="statValue">{cifra(conteo.agotado)}</span>
        </div>
      </div>

      {isLoading ? (
        <p>Cargando inventario…</p>
      ) : (
        <Tabla columnas={columnas} datos={stock ?? []} mensajeVacio="No hay ítems para mostrar en esta sucursal." />
      )}
    </div>
  )
}

// --- Movimientos -------------------------------------------------------------

type LimiteMovimientos = '5' | '10' | 'todos'

const ETIQUETAS_LIMITE: Record<LimiteMovimientos, string> = { '5': '5', '10': '10', todos: 'Todos' }

function PestañaMovimientos({ sucursalesActivas }: { sucursalesActivas: Sucursal[] }) {
  const [tipoItem, setTipoItem] = useState<TipoItemInventario | ''>('')
  const [item, setItem] = useState<number | ''>('')
  const [sucursal, setSucursal] = useState<number | ''>('')
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoInventario | ''>('')
  const [motivo, setMotivo] = useState<FiltroMotivoMovimientoInventario | ''>('')
  const [limite, setLimite] = useState<LimiteMovimientos>('10')

  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()

  const opcionesItem =
    tipoItem === 'producto'
      ? (productos ?? []).map((p) => ({ id: p.id, nombre: p.nombre_producto }))
      : tipoItem === 'materia_prima'
        ? (materiaPrima ?? []).map((m) => ({ id: m.id, nombre: m.nombre_item }))
        : []

  const { data: movimientos, isLoading } = useMovimientosInventario({
    tipo_item: tipoItem || undefined,
    item_id: item || undefined,
    sucursal: sucursal || undefined,
    tipo_movimiento: tipoMovimiento || undefined,
    motivo: motivo || undefined,
  })

  const hayFiltros = Boolean(tipoItem || item || sucursal || tipoMovimiento || motivo)

  function limpiarFiltros() {
    setTipoItem('')
    setItem('')
    setSucursal('')
    setTipoMovimiento('')
    setMotivo('')
  }

  const lista = useMemo(() => movimientos ?? [], [movimientos])
  const entradas = lista.filter((m) => m.tipo_movimiento === 'entrada').length
  // La API ya los entrega del más reciente al más antiguo; el límite solo recorta en pantalla.
  const visibles = limite === 'todos' ? lista : lista.slice(0, Number(limite))

  const columnas: ColumnaTabla<MovimientoInventario>[] = [
    {
      clave: 'fecha',
      encabezado: 'Fecha',
      render: (fila) => <span className="cellNoWrap">{formatearFecha(fila.fecha)}</span>,
    },
    { clave: 'item_nombre', encabezado: 'Ítem' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal' },
    {
      clave: 'tipo_movimiento',
      encabezado: 'Tipo',
      render: (fila) => (
        <span className={fila.tipo_movimiento === 'entrada' ? 'status statusSuccess' : 'status statusNeutral'}>
          {ETIQUETAS_TIPO_MOVIMIENTO[fila.tipo_movimiento]}
        </span>
      ),
    },
    { clave: 'cantidad', alineacion: 'derecha', encabezado: 'Cantidad', render: cantidadConSigno },
    { clave: 'stock_resultante', alineacion: 'derecha', encabezado: 'Existencia resultante' },
    { clave: 'motivo', encabezado: 'Motivo', render: (fila) => textoMotivo(fila) },
    { clave: 'usuario_nombre', encabezado: 'Usuario' },
  ]

  const cifra = (valor: number) => (movimientos ? valor : '…')

  return (
    <div className="tabPanel">
      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Movimientos</span>
          <span className="statValue">{cifra(lista.length)}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Entradas</span>
          <span className="statValue">{cifra(entradas)}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Salidas</span>
          <span className="statValue">{cifra(lista.length - entradas)}</span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
          Tipo de ítem
          <select
            value={tipoItem}
            onChange={(e) => {
              setTipoItem(e.target.value as TipoItemInventario | '')
              setItem('')
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
            value={item}
            onChange={(e) => setItem(e.target.value ? Number(e.target.value) : '')}
            disabled={!tipoItem}
          >
            <option value="">Todos</option>
            {opcionesItem.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
          Sucursal
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value ? Number(e.target.value) : '')}>
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
            value={tipoMovimiento}
            onChange={(e) => setTipoMovimiento(e.target.value as TipoMovimientoInventario | '')}
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
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as FiltroMotivoMovimientoInventario | '')}>
            <option value="">Todos</option>
            {OPCIONES_FILTRO_MOTIVO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </label>

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="sectionHeader">
        <span className="pageHint">
          {movimientos ? `Mostrando ${visibles.length} de ${lista.length}` : ''}
        </span>
        <div className="segmented" role="group" aria-label="Cantidad de movimientos a mostrar">
          {(['5', '10', 'todos'] as LimiteMovimientos[]).map((valor) => (
            <button
              key={valor}
              type="button"
              className={limite === valor ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
              aria-pressed={limite === valor}
              onClick={() => setLimite(valor)}
            >
              {ETIQUETAS_LIMITE[valor]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p>Cargando historial…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={visibles}
          mensajeVacio={
            hayFiltros
              ? 'Ningún movimiento coincide con los filtros.'
              : 'Todavía no hay movimientos de inventario registrados.'
          }
        />
      )}
    </div>
  )
}
