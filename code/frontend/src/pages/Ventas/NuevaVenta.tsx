import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import type { VentaFormulario } from '../../api/ventas'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { useClientes } from '../../hooks/useClientes'
import { useStock } from '../../hooks/useInventario'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { useCrearVenta } from '../../hooks/useVentas'
import styles from './NuevaVenta.module.css'

interface LineaLocal {
  clave: string
  productoId: number
  productoNombre: string
  precioUnitario: string
  cantidad: string
}

function subtotalDe(linea: LineaLocal): number {
  return Number(linea.cantidad) * Number(linea.precioUnitario)
}

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

export function NuevaVenta() {
  const navigate = useNavigate()
  const { data: clientes } = useClientes()
  const { data: sucursales } = useSucursales()
  const { data: productos } = useProductos()
  const crear = useCrearVenta()

  const clientesActivos = (clientes ?? []).filter((c) => c.activo)
  const sucursalesActivas = (sucursales ?? []).filter((s) => s.activo)
  const productosActivos = (productos ?? []).filter((p) => p.activo)

  const [cliente, setCliente] = useState<number | ''>('')
  const [sucursal, setSucursal] = useState<number | ''>('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [lineas, setLineas] = useState<LineaLocal[]>([])
  const [errorFormulario, setErrorFormulario] = useState('')

  const [productoNuevaLinea, setProductoNuevaLinea] = useState<number | ''>('')
  const [cantidadNuevaLinea, setCantidadNuevaLinea] = useState('')

  const { data: stock } = useStock('producto', sucursal || null)

  const stockDelProductoSeleccionado = stock?.find((item) => item.id === productoNuevaLinea)
  const cantidadYaEnLineas = lineas
    .filter((l) => l.productoId === productoNuevaLinea)
    .reduce((acumulado, l) => acumulado + Number(l.cantidad), 0)
  const disponible = stockDelProductoSeleccionado
    ? Number(stockDelProductoSeleccionado.stock_actual) - cantidadYaEnLineas
    : null

  function agregarLinea() {
    if (!sucursal) {
      setErrorFormulario('Selecciona primero la sucursal.')
      return
    }
    if (!productoNuevaLinea || !cantidadNuevaLinea) {
      setErrorFormulario('Selecciona un producto y una cantidad antes de agregar la línea.')
      return
    }
    if (Number(cantidadNuevaLinea) <= 0) {
      setErrorFormulario('La cantidad debe ser mayor a 0.')
      return
    }
    if (disponible !== null && Number(cantidadNuevaLinea) > disponible) {
      setErrorFormulario(`Stock insuficiente: solo hay ${disponible} disponible en esta sucursal.`)
      return
    }

    const producto = productosActivos.find((p) => p.id === productoNuevaLinea)
    if (!producto) return

    setErrorFormulario('')
    setLineas((actual) => [
      ...actual,
      {
        clave: `${productoNuevaLinea}-${Date.now()}`,
        productoId: productoNuevaLinea,
        productoNombre: producto.nombre_producto,
        precioUnitario: producto.precio_venta,
        cantidad: cantidadNuevaLinea,
      },
    ])
    setProductoNuevaLinea('')
    setCantidadNuevaLinea('')
  }

  function quitarLinea(clave: string) {
    setLineas((actual) => actual.filter((l) => l.clave !== clave))
  }

  const total = lineas.reduce((acumulado, linea) => acumulado + subtotalDe(linea), 0)

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!sucursal) {
      setErrorFormulario('Selecciona la sucursal.')
      return
    }
    if (lineas.length === 0) {
      setErrorFormulario('Agrega al menos una línea de producto.')
      return
    }

    const datos: VentaFormulario = {
      cliente: cliente || null,
      sucursal,
      fecha_entrega: fechaEntrega || null,
      detalles: lineas.map((l) => ({ producto: l.productoId, cantidad: l.cantidad })),
    }

    try {
      const venta = await crear.mutateAsync(datos)
      navigate(`/ventas/${venta.id}`)
    } catch (err) {
      setErrorFormulario(extraerMensajeError(err, 'No se pudo registrar la venta. Intenta de nuevo.'))
    }
  }

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>Nueva venta</h1>

      <form className={styles.formulario} onSubmit={alGuardar} noValidate>
        <div className={styles.filaCampos}>
          <label className={styles.campo}>
            Cliente (opcional)
            <select value={cliente} onChange={(e) => setCliente(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Sin cliente</option>
              {clientesActivos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_cliente}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
            Sucursal
            <select
              value={sucursal}
              onChange={(e) => {
                setSucursal(e.target.value ? Number(e.target.value) : '')
                setLineas([])
              }}
            >
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
            Fecha de entrega (opcional)
            <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </label>
        </div>

        <div className={styles.seccionLineas}>
          <h2 className={styles.tituloSeccion}>Líneas de la venta</h2>

          <div className={styles.filaAgregarLinea}>
            <label className={styles.campo}>
              Producto
              <select
                value={productoNuevaLinea}
                onChange={(e) => setProductoNuevaLinea(e.target.value ? Number(e.target.value) : '')}
                disabled={!sucursal}
              >
                <option value="">Selecciona un producto</option>
                {productosActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_producto}
                  </option>
                ))}
              </select>
              {disponible !== null && (
                <span className={disponible <= 0 ? styles.disponibleInsuficiente : styles.disponible}>
                  Disponible: {disponible}
                </span>
              )}
            </label>

            <label className={styles.campo}>
              Cantidad
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={cantidadNuevaLinea}
                onChange={(e) => setCantidadNuevaLinea(e.target.value)}
                disabled={!sucursal}
              />
            </label>
            <div className={styles.campoBoton}>
              <span className={styles.etiquetaInvisible}>{'\u00A0'}</span>
              <BotonPrimario type="button" variante="secundario" onClick={agregarLinea} disabled={!sucursal}>
                Agregar línea
              </BotonPrimario>
            </div>
          </div>

          {lineas.length > 0 && (
            <table className={styles.tablaLineas}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea) => (
                  <tr key={linea.clave}>
                    <td>{linea.productoNombre}</td>
                    <td>{linea.cantidad}</td>
                    <td>{linea.precioUnitario}</td>
                    <td>{subtotalDe(linea).toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.enlaceAccionPeligro}
                        onClick={() => quitarLinea(linea.clave)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={styles.total}>
            <span>Total:</span>
            <span data-testid="total-venta">{total.toFixed(2)}</span>
          </div>
        </div>

        {errorFormulario && (
          <p className={styles.error} role="alert">
            {errorFormulario}
          </p>
        )}

        <div className={styles.accionesFormulario}>
          <BotonPrimario type="button" variante="secundario" onClick={() => navigate('/ventas')}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Guardar venta'}
          </BotonPrimario>
        </div>
      </form>
    </div>
  )
}
