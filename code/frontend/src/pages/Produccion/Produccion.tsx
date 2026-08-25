import { useState, type FormEvent } from 'react'

import type { Produccion as ProduccionApi, ProduccionFormulario, RecetaFormulario } from '../../api/produccion'
import { BotonPrimario } from '../../components/common/BotonPrimario'
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

type Pestaña = 'producciones' | 'recetas'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'producciones', etiqueta: 'Producciones registradas' },
  { clave: 'recetas', etiqueta: 'Gestión de recetas' },
]

export function Produccion() {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [pestaña, setPestaña] = useState<Pestaña>('producciones')

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Producción</h1>
      </div>

      <div className={styles.pestañas} role="tablist">
        {PESTAÑAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestaña === p.clave}
            className={pestaña === p.clave ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
            onClick={() => setPestaña(p.clave)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestaña === 'producciones' && <PestañaProducciones />}
      {pestaña === 'recetas' && <PestañaRecetas esAdmin={esAdmin} />}
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

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [idDetalle, setIdDetalle] = useState<number | null>(null)

  const columnas: ColumnaTabla<ProduccionApi>[] = [
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => new Date(fila.fecha).toLocaleString('es-MX') },
    { clave: 'producto_nombre', encabezado: 'Producto' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal' },
    { clave: 'cantidad_producida', encabezado: 'Cantidad producida' },
    { clave: 'costo_total', encabezado: 'Costo total' },
  ]

  return (
    <div>
      <div className={styles.encabezado}>
        <span />
        <BotonPrimario onClick={() => setFormularioAbierto(true)}>Nueva producción</BotonPrimario>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
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

        <label className={styles.campoFiltro}>
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

        <label className={styles.campoFiltro}>
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

        <label className={styles.campoFiltro}>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
      </div>

      {isLoading ? (
        <p>Cargando producciones…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={producciones ?? []}
          mensajeVacio="Todavía no hay producciones registradas."
          renderAcciones={(fila) => (
            <button type="button" className={styles.enlaceAccion} onClick={() => setIdDetalle(fila.id)}>
              Ver detalle
            </button>
          )}
        />
      )}

      <NuevaProduccionModal abierto={formularioAbierto} onCerrar={() => setFormularioAbierto(false)} />
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
    return { linea, requerido, disponible, suficiente: disponible >= requerido }
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
    <Modal titulo="Nueva producción" abierto={abierto} onCerrar={cerrarYLimpiar}>
      <form className={styles.formulario} onSubmit={alGuardar} noValidate>
        <label className={styles.campo}>
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

        <label className={styles.campo}>
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

        <label className={styles.campo}>
          Cantidad a producir
          <input
            type="number"
            step="1"
            min="1"
            value={cantidadProducida}
            onChange={(e) => setCantidadProducida(e.target.value)}
          />
        </label>

        {producto && sucursal && (
          <div className={styles.seccionPrevia}>
            <h3 className={styles.tituloPrevia}>Materia prima requerida</h3>

            {recetaActiva.length === 0 ? (
              <p className={styles.aviso}>Este producto no tiene una receta activa configurada.</p>
            ) : (
              <table className={styles.tablaPrevia}>
                <thead>
                  <tr>
                    <th>Materia prima</th>
                    <th>Requerido</th>
                    <th>Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.map(({ linea, requerido, disponible, suficiente }) => (
                    <tr key={linea.id}>
                      <td>{linea.materia_prima_nombre}</td>
                      <td>{requerido.toFixed(2)}</td>
                      <td className={suficiente ? styles.disponibleSuficiente : styles.disponibleInsuficiente}>
                        {disponible.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.accionesFormulario}>
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
  const { data: produccion, isLoading } = useProduccion(id ?? 0)

  return (
    <Modal titulo={id ? `Producción #${id}` : 'Producción'} abierto={id !== null} onCerrar={onCerrar}>
      {isLoading || !produccion ? (
        <p>Cargando…</p>
      ) : (
        <>
          <div className={styles.datosGenerales}>
            <span className={styles.etiqueta}>Producto</span>
            <span>{produccion.producto_nombre}</span>

            <span className={styles.etiqueta}>Sucursal</span>
            <span>{produccion.sucursal_nombre}</span>

            <span className={styles.etiqueta}>Fecha</span>
            <span>{new Date(produccion.fecha).toLocaleString('es-MX')}</span>

            <span className={styles.etiqueta}>Registrada por</span>
            <span>{produccion.usuario_nombre}</span>

            <span className={styles.etiqueta}>Cantidad producida</span>
            <span>{produccion.cantidad_producida}</span>

            <span className={styles.etiqueta}>Costo total</span>
            <span>{produccion.costo_total}</span>
          </div>

          <table className={styles.tablaPrevia}>
            <thead>
              <tr>
                <th>Materia prima consumida</th>
                <th>Cantidad</th>
                <th>Costo unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {produccion.detalles.map((detalle) => (
                <tr key={detalle.id}>
                  <td>{detalle.materia_prima_nombre}</td>
                  <td>{detalle.cantidad_consumida}</td>
                  <td>{detalle.costo_unitario_momento}</td>
                  <td>{detalle.subtotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  )
}

// --- Recetas --------------------------------------------------------------

const RECETA_VACIA: RecetaFormulario = { producto: 0, materia_prima: 0, cantidad_requerida: '' }

function PestañaRecetas({ esAdmin }: { esAdmin: boolean }) {
  const { data: recetas, isLoading } = useRecetas()
  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()
  const crear = useCrearReceta()
  const editar = useEditarReceta()
  const desactivar = useDesactivarReceta()
  const reactivar = useReactivarReceta()

  const productosActivos = (productos ?? []).filter((p) => p.activo)
  const materiaPrimaActiva = (materiaPrima ?? []).filter((m) => m.activo)

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<{ id: number } | null>(null)
  const [valores, setValores] = useState<RecetaFormulario>(RECETA_VACIA)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<{ id: number; etiqueta: string } | null>(null)
  const [aReactivar, setAReactivar] = useState<{ id: number; etiqueta: string } | null>(null)

  function abrirCrear() {
    setEnEdicion(null)
    setValores(RECETA_VACIA)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(receta: NonNullable<typeof recetas>[number]) {
    setEnEdicion({ id: receta.id })
    setValores({
      producto: receta.producto,
      materia_prima: receta.materia_prima,
      cantidad_requerida: receta.cantidad_requerida,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.producto || !valores.materia_prima || !valores.cantidad_requerida) {
      setErrorFormulario('Completa producto, materia prima y cantidad requerida.')
      return
    }

    try {
      if (enEdicion) {
        await editar.mutateAsync({ id: enEdicion.id, datos: valores })
      } else {
        await crear.mutateAsync(valores)
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(extraerMensajeError(err, 'No se pudo guardar la línea de receta. Intenta de nuevo.'))
    }
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

  const columnas: ColumnaTabla<NonNullable<typeof recetas>[number]>[] = [
    { clave: 'producto_nombre', encabezado: 'Producto' },
    { clave: 'materia_prima_nombre', encabezado: 'Materia prima' },
    { clave: 'cantidad_requerida', encabezado: 'Cantidad requerida' },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
          {fila.activo ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  return (
    <div>
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nueva línea de receta</BotonPrimario>
        </div>
      )}

      {isLoading ? (
        <p>Cargando recetas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={recetas ?? []}
          mensajeVacio="Todavía no hay recetas registradas."
          renderAcciones={
            esAdmin
              ? (fila) => (
                  <div className={styles.acciones}>
                    <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                      Editar
                    </button>
                    {fila.activo ? (
                      <button
                        type="button"
                        className={styles.enlaceAccionPeligro}
                        onClick={() =>
                          setADesactivar({ id: fila.id, etiqueta: `${fila.materia_prima_nombre} en ${fila.producto_nombre}` })
                        }
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.enlaceAccion}
                        onClick={() =>
                          setAReactivar({ id: fila.id, etiqueta: `${fila.materia_prima_nombre} en ${fila.producto_nombre}` })
                        }
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                )
              : undefined
          }
        />
      )}

      <Modal
        titulo={enEdicion ? 'Editar línea de receta' : 'Nueva línea de receta'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Producto
            <select
              value={valores.producto || ''}
              onChange={(e) => setValores((v) => ({ ...v, producto: Number(e.target.value) }))}
            >
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

          <label className={styles.campo}>
            Materia prima
            <select
              value={valores.materia_prima || ''}
              onChange={(e) => setValores((v) => ({ ...v, materia_prima: Number(e.target.value) }))}
            >
              <option value="" disabled>
                Selecciona una materia prima
              </option>
              {materiaPrimaActiva.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre_item}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
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
            <p className={styles.error} role="alert">
              {errorFormulario}
            </p>
          )}

          <div className={styles.accionesFormulario}>
            <BotonPrimario type="button" variante="secundario" onClick={() => setFormularioAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
              {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>

      <Modal titulo="Desactivar línea de receta" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar "{aDesactivar?.etiqueta}"? Dejará de consumirse en nuevas producciones,
          pero el historial ya registrado no cambia.
        </p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar línea de receta" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>¿Confirmas que quieres reactivar "{aReactivar?.etiqueta}"?</p>
        <div className={styles.accionesFormulario}>
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
