import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ETIQUETAS_ESTADO_COMPRA, type EstadoCompra } from '../../api/compras'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useCancelarCompra, useCompra, useRecibirCompra } from '../../hooks/useCompras'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useProductos } from '../../hooks/useProductos'

function claseEstado(estado: EstadoCompra) {
  if (estado === 'recibida') return 'status statusSuccess'
  if (estado === 'cancelada') return 'status statusError'
  return 'status statusWarning'
}

function extraerMensajeError(err: unknown, mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined

  if (typeof datos?.detail === 'string') return datos.detail
  return mensajePorDefecto
}

export function DetalleCompra() {
  const { id } = useParams<{ id: string }>()
  const idCompra = Number(id)
  const navigate = useNavigate()

  const { data: compra, isLoading } = useCompra(idCompra)
  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()
  const recibir = useRecibirCompra()
  const cancelar = useCancelarCompra()

  const [confirmarRecibir, setConfirmarRecibir] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const nombreProducto = (id: number) =>
    (productos ?? []).find((p) => p.id === id)?.nombre_producto ?? `Producto #${id}`
  const nombreMateriaPrima = (id: number) =>
    (materiaPrima ?? []).find((m) => m.id === id)?.nombre_item ?? `Materia prima #${id}`

  async function confirmarAccionRecibir() {
    setErrorAccion('')
    try {
      await recibir.mutateAsync(idCompra)
      setConfirmarRecibir(false)
    } catch (err) {
      setErrorAccion(extraerMensajeError(err, 'No se pudo marcar la compra como recibida.'))
    }
  }

  async function confirmarAccionCancelar() {
    setErrorAccion('')
    try {
      await cancelar.mutateAsync(idCompra)
      setConfirmarCancelar(false)
    } catch (err) {
      setErrorAccion(extraerMensajeError(err, 'No se pudo cancelar la compra.'))
    }
  }

  if (isLoading) return <p>Cargando compra…</p>
  if (!compra) {
    return (
      <div className="documentPage">
        <div className="documentToolbar">
          <BotonPrimario variante="secundario" onClick={() => navigate('/compras')}>
            Volver al listado
          </BotonPrimario>
        </div>
        <div className="placeholderBox">
          <span className="placeholderTitle">No se encontró la compra.</span>
          <span>Puede que no exista o que no tengas acceso a ella.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="documentPage">
      <div className="documentToolbar">
        <BotonPrimario variante="secundario" onClick={() => navigate('/compras')}>
          Volver al listado
        </BotonPrimario>
      </div>

      <article className="document">
        <header className="documentHeader documentHeaderPurchase">
          <div className="documentHeaderRow">
            <div className="documentHeaderText">
              <span className="documentEyebrow">Compras</span>
              <h1 className="documentTitle">Compra #{compra.id}</h1>
              <p className="documentHint">Registrada el {new Date(compra.fecha).toLocaleString('es-MX')}</p>
            </div>
            <span className={claseEstado(compra.estado)}>{ETIQUETAS_ESTADO_COMPRA[compra.estado]}</span>
          </div>
        </header>

        <section className="documentSection">
          <h2 className="sectionTitle">Datos generales</h2>
          <dl className="factGrid factGridThree">
            <div>
              <dt>Proveedor</dt>
              <dd>{compra.proveedor_nombre}</dd>
            </div>
            <div>
              <dt>Sucursal destino</dt>
              <dd>{compra.sucursal_nombre}</dd>
            </div>
            <div>
              <dt>Registrada por</dt>
              <dd>{compra.usuario_nombre}</dd>
            </div>
            <div>
              <dt>Fecha de entrega estimada</dt>
              <dd>{compra.fecha_entrega ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="documentSection">
          <h2 className="sectionTitle">Líneas de la compra</h2>
          <div className="tableScroll">
            <table className="linesTable">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ítem</th>
                  <th className="numeric">Cantidad</th>
                  <th className="numeric">Costo unitario</th>
                  <th className="numeric">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {compra.detalles_producto.map((linea) => (
                  <tr key={`producto-${linea.id}`}>
                    <td>Producto</td>
                    <td>{nombreProducto(linea.producto)}</td>
                    <td className="numeric">{linea.cantidad}</td>
                    <td className="numeric">{linea.costo_unitario}</td>
                    <td className="numeric">{linea.subtotal}</td>
                  </tr>
                ))}
                {compra.detalles_materia_prima.map((linea) => (
                  <tr key={`materia-prima-${linea.id}`}>
                    <td>Materia prima</td>
                    <td>{nombreMateriaPrima(linea.materia_prima)}</td>
                    <td className="numeric">{linea.cantidad}</td>
                    <td className="numeric">{linea.costo_unitario}</td>
                    <td className="numeric">{linea.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="summary">
            <div className="summaryRow">
              <span>Líneas</span>
              <span>{compra.detalles_producto.length + compra.detalles_materia_prima.length}</span>
            </div>
            <div className="summaryRow summaryTotal">
              <span>Total</span>
              <span data-testid="total-compra">{compra.total}</span>
            </div>
          </div>
        </section>

        <footer className="documentFooter">
          {errorAccion && (
            <p className="errorMessage" role="alert">
              {errorAccion}
            </p>
          )}

          <div className="pageActions">
            {compra.estado === 'pendiente' && (
              <BotonPrimario onClick={() => setConfirmarRecibir(true)}>Marcar como recibida</BotonPrimario>
            )}
            {compra.estado !== 'cancelada' && (
              <BotonPrimario variante="peligro" onClick={() => setConfirmarCancelar(true)}>
                Cancelar compra
              </BotonPrimario>
            )}
          </div>
        </footer>
      </article>

      <Modal titulo="Marcar como recibida" abierto={confirmarRecibir} onCerrar={() => setConfirmarRecibir(false)}>
        <p className="confirmText">
          ¿Confirmas que quieres marcar la compra #{compra.id} como recibida?
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setConfirmarRecibir(false)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarAccionRecibir} disabled={recibir.isPending}>
            {recibir.isPending ? 'Guardando…' : 'Confirmar recepción'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Cancelar compra" abierto={confirmarCancelar} onCerrar={() => setConfirmarCancelar(false)}>
        <p className="confirmText">
          {compra.estado === 'recibida'
            ? `¿Confirmas que quieres cancelar la compra #${compra.id}? Como ya fue recibida, se generará un movimiento de salida inverso por cada línea para revertir el stock.`
            : `¿Confirmas que quieres cancelar la compra #${compra.id}?`}
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setConfirmarCancelar(false)}>
            Volver
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarAccionCancelar} disabled={cancelar.isPending}>
            {cancelar.isPending ? 'Cancelando…' : 'Confirmar cancelación'}
          </BotonPrimario>
        </div>
      </Modal>
    </div>
  )
}
