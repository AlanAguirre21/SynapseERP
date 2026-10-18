import { useMemo, useState, type FormEvent } from 'react'

import type { Produccion as ProduccionApi, ProduccionFormulario, Receta, RecetaFormulario } from '../../api/produccion'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Icono } from '../../components/common/Icono'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useStock } from '../../hooks/useInventario'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import {
  useCrearProduccion,
  useProducciones,
  useProduccion,
} from '../../hooks/useProducciones'
import { useProductos } from '../../hooks/useProductos'
import {
  useCrearReceta,
  useDesactivarReceta,
  useEditarReceta,
  useReactivarReceta,
  useRecetas,
} from '../../hooks/useRecetas'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { formatearMoneda } from '../../utils/moneda'
import styles from './Produccion.module.css'

function extraerMensajeError(err: unknown, mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined

  if (typeof datos?.detail === 'string') return datos.detail

  for (const valor of Object.values(datos ?? {})) {
    if (typeof valor === 'string') return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
  }

  return mensajePorDefecto
}

// El backend solo admite producir unidades enteras de producto, así que la
// cantidad producida se muestra sin decimales ("2" en lugar de "2.00").
function formatearUnidades(valor: string | number): string {
  return Number(valor).toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

type Pestaña = 'producciones' | 'recetas'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'producciones', etiqueta: 'Producciones registradas' },
  { clave: 'recetas', etiqueta: 'Gestión de recetas' },
]

export function Produccion() {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [pestaña, setPestaña] = useState<Pestaña>('producciones')

  // La acción principal de cada pestaña vive en el encabezado de la página,
  // así que los modales que abre se controlan desde aquí.
  const [nuevaProduccionAbierta, setNuevaProduccionAbierta] = useState(false)
  const [modoReceta, setModoReceta] = useState<ModoFormulario | null>(null)

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Producción</h1>
          <p className="pageHint">Registra lotes de producción y administra la receta de cada producto.</p>
        </div>
        {pestaña === 'producciones' && (
          <BotonPrimario onClick={() => setNuevaProduccionAbierta(true)}>Nueva producción</BotonPrimario>
        )}
        {pestaña === 'recetas' && esAdmin && (
          <BotonPrimario onClick={() => setModoReceta({ tipo: 'nuevaReceta' })}>Agregar receta de producto</BotonPrimario>
        )}
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

      {pestaña === 'producciones' && <PestañaProducciones />}
      {pestaña === 'recetas' && (
        <PestañaRecetas esAdmin={esAdmin} modo={modoReceta} onCambiarModo={setModoReceta} />
      )}

      <NuevaProduccionModal abierto={nuevaProduccionAbierta} onCerrar={() => setNuevaProduccionAbierta(false)} />
    </div>
  )
}

// --- Producciones -----------------------------------------------------

function PestañaProducciones() {
  const { data: sucursales } = useSucursales()
  const { data: productos } = useProductos()

  const [sucursalFiltro, setSucursalFiltro] = useState<number | ''>('')
  const [productoFiltro, setProductoFiltro] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: producciones, isLoading } = useProducciones({
    sucursal: sucursalFiltro || undefined,
    producto: productoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const [idDetalle, setIdDetalle] = useState<number | null>(null)

  const hayFiltros = Boolean(sucursalFiltro || productoFiltro || fechaDesde || fechaHasta)

  function limpiarFiltros() {
    setSucursalFiltro('')
    setProductoFiltro('')
    setFechaDesde('')
    setFechaHasta('')
  }

  // Indicadores sobre la lista ya filtrada por el backend: cambian al filtrar.
  const resumen = useMemo(() => {
    const lista = producciones ?? []
    const unidades = lista.reduce((suma, p) => suma + Number(p.cantidad_producida), 0)
    const costo = lista.reduce((suma, p) => suma + Number(p.costo_total), 0)
    return { producciones: lista.length, unidades, costo, costoPorUnidad: unidades > 0 ? costo / unidades : null }
  }, [producciones])

  const columnas: ColumnaTabla<ProduccionApi>[] = [
    { clave: 'id', encabezado: 'Folio', render: (fila) => `#${fila.id}` },
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => formatearFecha(fila.fecha) },
    { clave: 'producto_nombre', encabezado: 'Producto' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal' },
    {
      clave: 'cantidad_producida',
      alineacion: 'derecha',
      encabezado: 'Cantidad producida',
      render: (fila) => formatearUnidades(fila.cantidad_producida),
    },
    {
      clave: 'costo_total',
      alineacion: 'derecha',
      encabezado: 'Costo total',
      render: (fila) => formatearMoneda(fila.costo_total),
    },
  ]

  return (
    <div className="tabPanel">
      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Producciones</span>
          <span className="statValue">{producciones ? resumen.producciones : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Unidades producidas</span>
          <span className="statValue">{producciones ? formatearUnidades(resumen.unidades) : '…'}</span>
        </div>
        <div className="statTile statTileProduction">
          <span className="statLabel">Costo de producción</span>
          <span className="statValue">{producciones ? formatearMoneda(resumen.costo) : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Costo promedio por unidad</span>
          <span className="statValue">
            {!producciones ? '…' : resumen.costoPorUnidad === null ? '—' : formatearMoneda(resumen.costoPorUnidad)}
          </span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
          Sucursal
          <select
            value={sucursalFiltro}
            onChange={(e) => setSucursalFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todas</option>
            {(sucursales ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_sucursal}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
          Producto
          <select
            value={productoFiltro}
            onChange={(e) => setProductoFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos</option>
            {(productos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_producto}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

        <label className="filterField">
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Cargando producciones…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={producciones ?? []}
          mensajeVacio={
            hayFiltros ? 'Ninguna producción coincide con los filtros.' : 'Todavía no hay producciones registradas.'
          }
          renderAcciones={(fila) => (
            <button type="button" className="actionLink" onClick={() => setIdDetalle(fila.id)}>
              Ver detalle
            </button>
          )}
        />
      )}

      <DetalleProduccionModal id={idDetalle} onCerrar={() => setIdDetalle(null)} />
    </div>
  )
}

function NuevaProduccionModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { data: productos } = useProductos()
  const { data: sucursales } = useSucursales()
  const crear = useCrearProduccion()

  const productosActivos = (productos ?? []).filter((p) => p.activo)
  const sucursalesActivas = (sucursales ?? []).filter((s) => s.activo)

  const [producto, setProducto] = useState<number | ''>('')
  const [sucursal, setSucursal] = useState<number | ''>('')
  const [cantidadProducida, setCantidadProducida] = useState('')
  const [error, setError] = useState('')

  const { data: receta } = useRecetas(producto || undefined)
  const { data: stockMateriaPrima } = useStock('materia_prima', sucursal || null)

  const recetaActiva = (receta ?? []).filter((r) => r.activo)
  const cantidadNumerica = Number(cantidadProducida) || 0

  const previa = recetaActiva.map((linea) => {
    const requerido = Number(linea.cantidad_requerida) * cantidadNumerica
    const stockItem = stockMateriaPrima?.find((item) => item.id === linea.materia_prima)
    const disponible = stockItem ? Number(stockItem.stock_actual) : 0
    return { linea, requerido, disponible, faltante: requerido - disponible, suficiente: disponible >= requerido }
  })

  const hayInsuficientes = previa.some((p) => !p.suficiente)

  function cerrarYLimpiar() {
    setProducto('')
    setSucursal('')
    setCantidadProducida('')
    setError('')
    onCerrar()
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError('')

    if (!producto || !sucursal) {
      setError('Selecciona producto y sucursal.')
      return
    }
    if (!cantidadProducida || cantidadNumerica <= 0) {
      setError('Ingresa la cantidad a producir.')
      return
    }
    if (!Number.isInteger(cantidadNumerica)) {
      setError('La cantidad debe ser un número entero — no se producen fracciones de producto.')
      return
    }
    if (recetaActiva.length === 0) {
      setError('Este producto no tiene una receta activa configurada.')
      return
    }
    if (hayInsuficientes) {
      setError('No hay stock suficiente de una o más materias primas para esta producción.')
      return
    }

    const datos: ProduccionFormulario = { producto, sucursal, cantidad_producida: cantidadProducida }

    try {
      await crear.mutateAsync(datos)
      cerrarYLimpiar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo registrar la producción. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Nueva producción" abierto={abierto} onCerrar={cerrarYLimpiar} ancho="amplio">
      <form className="form" onSubmit={alGuardar} noValidate>
        <div className="formGrid">
          <label className="field">
            Producto
            <select value={producto} onChange={(e) => setProducto(e.target.value ? Number(e.target.value) : '')}>
              <option value="" disabled>
                Selecciona un producto
              </option>
              {productosActivos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_producto}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Sucursal
            <select value={sucursal} onChange={(e) => setSucursal(e.target.value ? Number(e.target.value) : '')}>
              <option value="" disabled>
                Selecciona una sucursal
              </option>
              {sucursalesActivas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre_sucursal}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Cantidad a producir
            <input
              type="number"
              step="1"
              min="1"
              value={cantidadProducida}
              onChange={(e) => setCantidadProducida(e.target.value)}
            />
          </label>
        </div>

        <div className="fieldGroup">
          <h3 className="subtitle">Materia prima requerida</h3>

          {!producto || !sucursal ? (
            <p className="emptyState">Elige producto y sucursal para ver la materia prima que se consumirá.</p>
          ) : recetaActiva.length === 0 ? (
            <p className="notice">Este producto no tiene una receta activa configurada.</p>
          ) : (
            <div className="tableScroll">
              <table className="linesTable">
                <thead>
                  <tr>
                    <th>Materia prima</th>
                    <th className="numeric">Requerido</th>
                    <th className="numeric">Disponible</th>
                    <th className="numeric">Faltante</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.map(({ linea, requerido, disponible, faltante, suficiente }) => (
                    <tr key={linea.id}>
                      <td>{linea.materia_prima_nombre}</td>
                      <td className="numeric">{requerido.toFixed(2)}</td>
                      <td className="numeric">{disponible.toFixed(2)}</td>
                      <td className="numeric">{suficiente ? '—' : faltante.toFixed(2)}</td>
                      <td>
                        <span className={suficiente ? 'status statusSuccess' : 'status statusError'}>
                          {suficiente ? 'Suficiente' : 'Insuficiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}

        <div className="formActions">
          <BotonPrimario type="button" variante="secundario" onClick={cerrarYLimpiar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Confirmar producción'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}

function DetalleProduccionModal({ id, onCerrar }: { id: number | null; onCerrar: () => void }) {
  const { data: produccion, isLoading } = useProduccion(id)

  // Solo para mostrar: el costo real ya quedó congelado en cada línea al producir.
  const costoPorUnidad =
    produccion && Number(produccion.cantidad_producida) > 0
      ? Number(produccion.costo_total) / Number(produccion.cantidad_producida)
      : null

  return (
    <Modal
      titulo={id ? `Producción #${id}` : 'Producción'}
      tituloVisible="Detalle de producción"
      abierto={id !== null}
      onCerrar={onCerrar}
      ancho="amplio"
    >
      {isLoading || !produccion ? (
        <p>Cargando…</p>
      ) : (
        <article className={styles.modalDocument}>
          <header className="documentHeader documentHeaderProduction">
            <span className="documentEyebrow">Producción</span>
            <h3 className="documentTitle">Producción #{produccion.id}</h3>
            <p className="documentHint">Registrada el {formatearFecha(produccion.fecha)}</p>
          </header>

          <section className="documentSection">
            <h4 className="sectionTitle">Datos generales</h4>
            <dl className="factGrid factGridThree">
              <div>
                <dt>Producto</dt>
                <dd>{produccion.producto_nombre}</dd>
              </div>
              <div>
                <dt>Sucursal</dt>
                <dd>{produccion.sucursal_nombre}</dd>
              </div>
              <div>
                <dt>Registrada por</dt>
                <dd>{produccion.usuario_nombre}</dd>
              </div>
              <div>
                <dt>Cantidad producida</dt>
                <dd>{formatearUnidades(produccion.cantidad_producida)}</dd>
              </div>
            </dl>
          </section>

          <section className="documentSection">
            <h4 className="sectionTitle">Materia prima consumida</h4>
            <div className="tableScroll">
              <table className="linesTable">
                <thead>
                  <tr>
                    <th>Materia prima</th>
                    <th className="numeric">Cantidad</th>
                    <th className="numeric">Costo unitario</th>
                    <th className="numeric">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {produccion.detalles.map((detalle) => (
                    <tr key={detalle.id}>
                      <td>{detalle.materia_prima_nombre}</td>
                      <td className="numeric">{detalle.cantidad_consumida}</td>
                      <td className="numeric">{formatearMoneda(detalle.costo_unitario_momento)}</td>
                      <td className="numeric">{formatearMoneda(detalle.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="summary">
              <div className="summaryRow">
                <span>Materias primas</span>
                <span>{produccion.detalles.length}</span>
              </div>
              <div className="summaryRow">
                <span>Costo por unidad</span>
                <span>{costoPorUnidad === null ? '—' : formatearMoneda(costoPorUnidad)}</span>
              </div>
              <div className="summaryRow summaryTotal">
                <span>Costo total</span>
                <span data-testid="costo-total-produccion">{formatearMoneda(produccion.costo_total)}</span>
              </div>
            </div>
          </section>
        </article>
      )}
    </Modal>
  )
}

// --- Recetas --------------------------------------------------------------

const RECETA_VACIA: RecetaFormulario = { producto: 0, materia_prima: 0, cantidad_requerida: '' }

// La receta de un producto es el conjunto de sus líneas `Receta`; la vista
// las agrupa por producto para que cada uno aparezca una sola vez.
interface RecetaAgrupada {
  producto: number
  productoNombre: string
  lineas: Receta[]
  activa: boolean
}

// El mismo modal sirve para crear la receta de un producto (su primera
// línea), agregarle otra materia prima, o editar una línea existente. En los
// dos últimos casos el producto ya está fijado.
type ModoFormulario =
  | { tipo: 'nuevaReceta' }
  | { tipo: 'agregarLinea'; producto: number; productoNombre: string }
  | { tipo: 'editarLinea'; id: number; producto: number; productoNombre: string }

const TITULOS_FORMULARIO: Record<ModoFormulario['tipo'], string> = {
  nuevaReceta: 'Agregar receta de producto',
  agregarLinea: 'Agregar materia prima a la receta',
  editarLinea: 'Editar línea de receta',
}

function agruparPorProducto(recetas: Receta[]): RecetaAgrupada[] {
  const grupos = new Map<number, RecetaAgrupada>()

  for (const linea of recetas) {
    const grupo = grupos.get(linea.producto) ?? {
      producto: linea.producto,
      productoNombre: linea.producto_nombre,
      lineas: [],
      activa: false,
    }
    grupo.lineas.push(linea)
    grupo.activa = grupo.activa || linea.activo
    grupos.set(linea.producto, grupo)
  }

  return [...grupos.values()].sort((a, b) => a.productoNombre.localeCompare(b.productoNombre, 'es'))
}

function textoConteoMateriaPrima(cantidad: number): string {
  return cantidad === 1 ? '1 materia prima' : `${cantidad} materias primas`
}

function PestañaRecetas({
  esAdmin,
  modo,
  onCambiarModo,
}: {
  esAdmin: boolean
  modo: ModoFormulario | null
  onCambiarModo: (modo: ModoFormulario | null) => void
}) {
  const { data: recetas, isLoading } = useRecetas()
  const desactivar = useDesactivarReceta()
  const reactivar = useReactivarReceta()

  const grupos = useMemo(() => agruparPorProducto(recetas ?? []), [recetas])
  const recetasActivas = grupos.filter((g) => g.activa).length

  const [desplegados, setDesplegados] = useState<Set<number>>(() => new Set())
  const [aDesactivar, setADesactivar] = useState<{ id: number; etiqueta: string } | null>(null)
  const [aReactivar, setAReactivar] = useState<{ id: number; etiqueta: string } | null>(null)

  function alternarDesplegado(producto: number) {
    setDesplegados((actuales) => {
      const siguientes = new Set(actuales)
      if (siguientes.has(producto)) siguientes.delete(producto)
      else siguientes.add(producto)
      return siguientes
    })
  }

  async function confirmarDesactivar() {
    if (!aDesactivar) return
    await desactivar.mutateAsync(aDesactivar.id)
    setADesactivar(null)
  }

  async function confirmarReactivar() {
    if (!aReactivar) return
    await reactivar.mutateAsync(aReactivar.id)
    setAReactivar(null)
  }

  const columnasLineas: ColumnaTabla<Receta>[] = [
    { clave: 'materia_prima_nombre', encabezado: 'Materia prima' },
    { clave: 'cantidad_requerida', alineacion: 'derecha', encabezado: 'Cantidad requerida (por unidad)' },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
          {fila.activo ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  const renderAccionesLinea = (fila: Receta) => (
    <div className="rowActions">
      <button
        type="button"
        className="actionLink"
        onClick={() =>
          onCambiarModo({ tipo: 'editarLinea', id: fila.id, producto: fila.producto, productoNombre: fila.producto_nombre })
        }
      >
        Editar
      </button>
      {fila.activo ? (
        <button
          type="button"
          className="dangerActionLink"
          onClick={() => setADesactivar({ id: fila.id, etiqueta: `${fila.materia_prima_nombre} en ${fila.producto_nombre}` })}
        >
          Desactivar
        </button>
      ) : (
        <button
          type="button"
          className="actionLink"
          onClick={() => setAReactivar({ id: fila.id, etiqueta: `${fila.materia_prima_nombre} en ${fila.producto_nombre}` })}
        >
          Reactivar
        </button>
      )}
    </div>
  )

  return (
    <div className="tabPanel">
      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Productos con receta</span>
          <span className="statValue">{recetas ? grupos.length : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Recetas activas</span>
          <span className="statValue">{recetas ? recetasActivas : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Recetas inactivas</span>
          <span className="statValue">{recetas ? grupos.length - recetasActivas : '…'}</span>
        </div>
      </div>

      {isLoading ? (
        <p>Cargando recetas…</p>
      ) : grupos.length === 0 ? (
        <p className="emptyState">Todavía no hay recetas registradas.</p>
      ) : (
        <ul className={styles.recipeList}>
          {grupos.map((grupo) => {
            const desplegado = desplegados.has(grupo.producto)
            const idDetalle = `receta-producto-${grupo.producto}`

            return (
              <li key={grupo.producto} className={styles.recipeItem}>
                <div className={styles.recipeHeader}>
                  <button
                    type="button"
                    className={styles.recipeToggle}
                    aria-expanded={desplegado}
                    aria-controls={idDetalle}
                    onClick={() => alternarDesplegado(grupo.producto)}
                  >
                    <Icono
                      nombre="desplegar"
                      tamano={18}
                      className={desplegado ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
                    />
                    <span className={styles.recipeName}>{grupo.productoNombre}</span>
                    <span className={styles.recipeCount}>{textoConteoMateriaPrima(grupo.lineas.length)}</span>
                    <span className={grupo.activa ? 'status statusSuccess' : 'status statusNeutral'}>
                      {grupo.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </button>
                  {/* Hermano del botón de despliegue, no hijo: agregar no despliega ni contrae la fila. */}
                  {esAdmin && (
                    <button
                      type="button"
                      className={styles.addButton}
                      aria-label={`Agregar materia prima a ${grupo.productoNombre}`}
                      title="Agregar materia prima"
                      onClick={() =>
                        onCambiarModo({ tipo: 'agregarLinea', producto: grupo.producto, productoNombre: grupo.productoNombre })
                      }
                    >
                      <Icono nombre="mas" tamano={18} />
                    </button>
                  )}
                </div>

                {desplegado && (
                  <div id={idDetalle} className={styles.recipeDetail}>
                    <Tabla
                      columnas={columnasLineas}
                      datos={grupo.lineas}
                      mensajeVacio="Esta receta no tiene materias primas."
                      renderAcciones={esAdmin ? renderAccionesLinea : undefined}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Se monta solo mientras está abierto, así cada apertura arranca con el formulario limpio. */}
      {modo && (
        <ModalReceta
          modo={modo}
          recetas={recetas ?? []}
          onCerrar={() => onCambiarModo(null)}
          // Deja desplegado el producto para que se vea la línea recién agregada.
          onAgregada={(producto) => setDesplegados((actuales) => new Set(actuales).add(producto))}
        />
      )}

      <Modal titulo="Desactivar línea de receta" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres desactivar "{aDesactivar?.etiqueta}"? Dejará de consumirse en nuevas producciones,
          pero el historial ya registrado no cambia.
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar línea de receta" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className="confirmText">¿Confirmas que quieres reactivar "{aReactivar?.etiqueta}"?</p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setAReactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarReactivar} disabled={reactivar.isPending}>
            {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
          </BotonPrimario>
        </div>
      </Modal>
    </div>
  )
}

function valoresIniciales(modo: ModoFormulario, recetas: Receta[]): RecetaFormulario {
  if (modo.tipo === 'nuevaReceta') return RECETA_VACIA
  if (modo.tipo === 'agregarLinea') return { ...RECETA_VACIA, producto: modo.producto }

  const linea = recetas.find((r) => r.id === modo.id)
  return {
    producto: modo.producto,
    materia_prima: linea?.materia_prima ?? 0,
    cantidad_requerida: linea?.cantidad_requerida ?? '',
  }
}

function ModalReceta({
  modo,
  recetas,
  onCerrar,
  onAgregada,
}: {
  modo: ModoFormulario
  recetas: Receta[]
  onCerrar: () => void
  onAgregada: (producto: number) => void
}) {
  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()
  const crear = useCrearReceta()
  const editar = useEditarReceta()

  const [valores, setValores] = useState<RecetaFormulario>(() => valoresIniciales(modo, recetas))
  const [errorFormulario, setErrorFormulario] = useState('')

  // Solo productos que todavía no tienen ninguna línea de receta (activa o
  // inactiva): una receta existente se amplía con el botón "+" de su fila.
  const productosConReceta = new Set(recetas.map((r) => r.producto))
  const productosDisponibles = (productos ?? []).filter((p) => p.activo && !productosConReceta.has(p.id))

  // Al agregar o editar una línea se excluyen las materias primas que ya
  // forman parte de la receta de ese producto (salvo la de la propia línea).
  const materiaPrimaYaUsada = new Set(
    modo.tipo === 'nuevaReceta'
      ? []
      : recetas
          .filter((r) => r.producto === modo.producto && !(modo.tipo === 'editarLinea' && r.id === modo.id))
          .map((r) => r.materia_prima),
  )
  const materiaPrimaDisponible = (materiaPrima ?? []).filter((m) => m.activo && !materiaPrimaYaUsada.has(m.id))

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.producto || !valores.materia_prima || !valores.cantidad_requerida) {
      setErrorFormulario('Completa producto, materia prima y cantidad requerida.')
      return
    }

    try {
      if (modo.tipo === 'editarLinea') {
        await editar.mutateAsync({ id: modo.id, datos: valores })
      } else {
        await crear.mutateAsync(valores)
        onAgregada(valores.producto)
      }
      onCerrar()
    } catch (err) {
      setErrorFormulario(extraerMensajeError(err, 'No se pudo guardar la línea de receta. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo={TITULOS_FORMULARIO[modo.tipo]} abierto onCerrar={onCerrar}>
      <form className="form" onSubmit={alGuardar} noValidate>
        {modo.tipo === 'nuevaReceta' ? (
          <label className="field">
            Producto
            <select
              value={valores.producto || ''}
              onChange={(e) => setValores((v) => ({ ...v, producto: Number(e.target.value) }))}
            >
              <option value="" disabled>
                Selecciona un producto
              </option>
              {productosDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_producto}
                </option>
              ))}
            </select>
            {productosDisponibles.length === 0 && (
              <span className="fieldHint">Todos los productos activos ya tienen receta; amplíala con el botón "+".</span>
            )}
          </label>
        ) : (
          <label className="field">
            Producto
            <input type="text" value={modo.productoNombre} readOnly />
          </label>
        )}

        <label className="field">
          Materia prima
          <select
            value={valores.materia_prima || ''}
            onChange={(e) => setValores((v) => ({ ...v, materia_prima: Number(e.target.value) }))}
          >
            <option value="" disabled>
              Selecciona una materia prima
            </option>
            {materiaPrimaDisponible.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre_item}
              </option>
            ))}
          </select>
          {materiaPrimaDisponible.length === 0 && (
            <span className="fieldHint">No hay materias primas activas disponibles para esta receta.</span>
          )}
        </label>

        <label className="field">
          Cantidad requerida (por unidad producida)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={valores.cantidad_requerida}
            onChange={(e) => setValores((v) => ({ ...v, cantidad_requerida: e.target.value }))}
          />
        </label>

        {errorFormulario && (
          <p className="errorMessage" role="alert">
            {errorFormulario}
          </p>
        )}

        <div className="formActions">
          <BotonPrimario type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
            {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}
