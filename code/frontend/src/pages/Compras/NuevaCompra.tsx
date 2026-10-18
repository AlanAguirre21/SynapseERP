import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import type { CompraFormulario } from '../../api/compras'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { useCrearCompra } from '../../hooks/useCompras'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useProductos } from '../../hooks/useProductos'
import { useProveedores } from '../../hooks/useProveedores'
import { useSucursales } from '../../hooks/useSucursales'

type TipoLinea = 'producto' | 'materia_prima'

interface LineaLocal {
  clave: string
  tipo: TipoLinea
  itemId: number
  itemNombre: string
  cantidad: string
  costoUnitario: string
}

function subtotalDe(linea: LineaLocal): number {
  return Number(linea.cantidad) * Number(linea.costoUnitario)
}

function extraerMensajeError(err: unknown, mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined

  if (typeof datos?.detail === 'string') return datos.detail
  if (Array.isArray(datos) && typeof datos[0] === 'string') return datos[0]

  for (const valor of Object.values(datos ?? {})) {
    if (typeof valor === 'string') return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
  }

  return mensajePorDefecto
}

export function NuevaCompra() {
  const navigate = useNavigate()
  const { data: proveedores } = useProveedores()
  const { data: sucursales } = useSucursales()
  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()
  const crear = useCrearCompra()

  const proveedoresActivos = (proveedores ?? []).filter((p) => p.activo)
  const sucursalesActivas = (sucursales ?? []).filter((s) => s.activo)
  const productosActivos = (productos ?? []).filter((p) => p.activo)
  const materiaPrimaActiva = (materiaPrima ?? []).filter((m) => m.activo)

  const [proveedor, setProveedor] = useState<number | ''>('')
  const [sucursal, setSucursal] = useState<number | ''>('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [lineas, setLineas] = useState<LineaLocal[]>([])
  const [errorFormulario, setErrorFormulario] = useState('')

  const [tipoNuevaLinea, setTipoNuevaLinea] = useState<TipoLinea>('producto')
  const [itemNuevaLinea, setItemNuevaLinea] = useState<number | ''>('')
  const [cantidadNuevaLinea, setCantidadNuevaLinea] = useState('')
  const [costoNuevaLinea, setCostoNuevaLinea] = useState('')

  const opcionesItemNuevaLinea =
    tipoNuevaLinea === 'producto'
      ? productosActivos.map((p) => ({ id: p.id, nombre: p.nombre_producto }))
      : materiaPrimaActiva.map((m) => ({ id: m.id, nombre: m.nombre_item }))

  function agregarLinea() {
    if (!itemNuevaLinea || !cantidadNuevaLinea || !costoNuevaLinea) {
      setErrorFormulario('Completa ítem, cantidad y costo unitario antes de agregar la línea.')
      return
    }
    if (Number(cantidadNuevaLinea) <= 0 || Number(costoNuevaLinea) < 0) {
      setErrorFormulario('La cantidad debe ser mayor a 0 y el costo unitario no puede ser negativo.')
      return
    }

    const item = opcionesItemNuevaLinea.find((o) => o.id === itemNuevaLinea)
    if (!item) return

    setErrorFormulario('')
    setLineas((actual) => [
      ...actual,
      {
        clave: `${tipoNuevaLinea}-${itemNuevaLinea}-${Date.now()}`,
        tipo: tipoNuevaLinea,
        itemId: itemNuevaLinea,
        itemNombre: item.nombre,
        cantidad: cantidadNuevaLinea,
        costoUnitario: costoNuevaLinea,
      },
    ])
    setItemNuevaLinea('')
    setCantidadNuevaLinea('')
    setCostoNuevaLinea('')
  }

  function quitarLinea(clave: string) {
    setLineas((actual) => actual.filter((l) => l.clave !== clave))
  }

  const total = lineas.reduce((acumulado, linea) => acumulado + subtotalDe(linea), 0)

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!proveedor || !sucursal) {
      setErrorFormulario('Selecciona proveedor y sucursal destino.')
      return
    }
    if (lineas.length === 0) {
      setErrorFormulario('Agrega al menos una línea de producto o materia prima.')
      return
    }

    const datos: CompraFormulario = {
      proveedor,
      sucursal,
      fecha_entrega: fechaEntrega || null,
      detalles_producto: lineas
        .filter((l) => l.tipo === 'producto')
        .map((l) => ({ producto: l.itemId, cantidad: l.cantidad, costo_unitario: l.costoUnitario })),
      detalles_materia_prima: lineas
        .filter((l) => l.tipo === 'materia_prima')
        .map((l) => ({ materia_prima: l.itemId, cantidad: l.cantidad, costo_unitario: l.costoUnitario })),
    }

    try {
      const compra = await crear.mutateAsync(datos)
      navigate(`/compras/${compra.id}`)
    } catch (err) {
      setErrorFormulario(extraerMensajeError(err, 'No se pudo registrar la compra. Intenta de nuevo.'))
    }
  }


  return (
    <div className="documentPage">
      <form className="document" onSubmit={alGuardar} noValidate>
        <header className="documentHeader documentHeaderPurchase">
          <span className="documentEyebrow">Compras</span>
          <h1 className="documentTitle">Nueva compra</h1>
          <p className="documentHint">
            Elige proveedor y sucursal destino, agrega las líneas y revisa el total antes de guardar.
          </p>
        </header>

        <section className="step">
          <span className="stepNumber" aria-hidden="true">
            1
          </span>
          <h2 className="stepTitle">Datos de la compra</h2>

          <div className="stepContent">
            <div className="fieldRow">
              <label className="field">
                Proveedor
                <select value={proveedor} onChange={(e) => setProveedor(e.target.value ? Number(e.target.value) : '')}>
                  <option value="" disabled>
                    Selecciona un proveedor
                  </option>
                  {proveedoresActivos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre_proveedor}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Sucursal destino
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
                Fecha de entrega estimada (opcional)
                <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
              </label>
            </div>
          </div>
        </section>

        <section className="step">
          <span className="stepNumber" aria-hidden="true">
            2
          </span>
          <h2 className="stepTitle">Líneas de la compra</h2>

          <div className="stepContent">
            <div className="addLineRow">
              <label className="field">
                Tipo
                <select
                  value={tipoNuevaLinea}
                  onChange={(e) => {
                    setTipoNuevaLinea(e.target.value as TipoLinea)
                    setItemNuevaLinea('')
                  }}
                >
                  <option value="producto">Producto</option>
                  <option value="materia_prima">Materia prima</option>
                </select>
              </label>

              <label className="field">
                Ítem
                <select
                  value={itemNuevaLinea}
                  onChange={(e) => setItemNuevaLinea(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Selecciona un ítem</option>
                  {opcionesItemNuevaLinea.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Cantidad
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={cantidadNuevaLinea}
                  onChange={(e) => setCantidadNuevaLinea(e.target.value)}
                />
              </label>

              <label className="field">
                Costo unitario
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costoNuevaLinea}
                  onChange={(e) => setCostoNuevaLinea(e.target.value)}
                />
              </label>

              <BotonPrimario type="button" variante="secundario" onClick={agregarLinea}>
                Agregar línea
              </BotonPrimario>
            </div>

            {lineas.length === 0 ? (
              <div className="placeholderBox">
                <span className="placeholderTitle">Todavía no hay líneas</span>
                <span>Elige un ítem, su cantidad y su costo unitario para agregar la primera línea.</span>
              </div>
            ) : (
              <div className="tableScroll">
                <table className="linesTable">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Ítem</th>
                      <th className="numeric">Cantidad</th>
                      <th className="numeric">Costo unitario</th>
                      <th className="numeric">Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((linea) => (
                      <tr key={linea.clave}>
                        <td>{linea.tipo === 'producto' ? 'Producto' : 'Materia prima'}</td>
                        <td>{linea.itemNombre}</td>
                        <td className="numeric">{linea.cantidad}</td>
                        <td className="numeric">{linea.costoUnitario}</td>
                        <td className="numeric">{subtotalDe(linea).toFixed(2)}</td>
                        <td className="numeric">
                          <button
                            type="button"
                            className="dangerActionLink"
                            onClick={() => quitarLinea(linea.clave)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="step">
          <span className="stepNumber" aria-hidden="true">
            3
          </span>
          <h2 className="stepTitle">Total</h2>

          <div className="stepContent">
            <div className="summary">
              <div className="summaryRow">
                <span>Líneas</span>
                <span>{lineas.length}</span>
              </div>
              <div className="summaryRow summaryTotal">
                <span>Total</span>
                <span data-testid="total-compra">{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="documentFooter">
          {errorFormulario && (
            <p className="errorMessage" role="alert">
              {errorFormulario}
            </p>
          )}

          <div className="formActions">
            <BotonPrimario type="button" variante="secundario" onClick={() => navigate('/compras')}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending}>
              {crear.isPending ? 'Guardando…' : 'Guardar compra'}
            </BotonPrimario>
          </div>
        </footer>
      </form>
    </div>
  )
}
