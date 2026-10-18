import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ETIQUETAS_ESTADO_FACTURA, FORMAS_PAGO, METODOS_PAGO, USOS_CFDI, type MetodoPago } from '../../api/facturacion'
import { ETIQUETAS_ESTADO_VENTA, obtenerTicketVenta, type EstadoVenta } from '../../api/ventas'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useClientes } from '../../hooks/useClientes'
import { useFacturaDeVenta, useGenerarFactura } from '../../hooks/useFacturas'
import { useProductos } from '../../hooks/useProductos'
import { useCancelarVenta, useEntregarVenta, useVenta } from '../../hooks/useVentas'

function claseEstado(estado: EstadoVenta) {
  if (estado === 'entregada') return 'status statusSuccess'
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

export function DetalleVenta() {
  const { id } = useParams<{ id: string }>()
  const idVenta = Number(id)
  const navigate = useNavigate()

  const { data: venta, isLoading } = useVenta(idVenta)
  const { data: productos } = useProductos()
  const { data: clientes } = useClientes()
  const entregar = useEntregarVenta()
  const cancelar = useCancelarVenta()
  const { data: factura } = useFacturaDeVenta(idVenta)
  const generarFactura = useGenerarFactura()

  const [confirmarEntregar, setConfirmarEntregar] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const [generandoTicket, setGenerandoTicket] = useState(false)

  const [modalFacturaAbierto, setModalFacturaAbierto] = useState(false)
  const [usoCfdi, setUsoCfdi] = useState('')
  const [formaPago, setFormaPago] = useState('03')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('PUE')
  const [errorFactura, setErrorFactura] = useState('')

  const nombreProducto = (id: number) =>
    (productos ?? []).find((p) => p.id === id)?.nombre_producto ?? `Producto #${id}`

  const subtotalProductos = (venta?.detalles ?? []).reduce((acumulado, linea) => acumulado + Number(linea.subtotal), 0)

  const clienteDeLaVenta = venta?.cliente ? (clientes ?? []).find((c) => c.id === venta.cliente) : undefined
  const datosFiscales = clienteDeLaVenta?.datos_fiscales
  const tieneFiscalesCompletos = Boolean(
    datosFiscales?.rfc && datosFiscales.razon_social && datosFiscales.codigo_postal_fiscal && datosFiscales.regimen_fiscal,
  )

  // Una factura "vigente" (cualquier estado salvo `error`) bloquea un
  // nuevo intento — un intento con `error` sí se puede reintentar,
  // reutilizando la misma fila en el backend (ver `FacturaViewSet.create`).
  const facturaVigente = factura && factura.estado !== 'error' ? factura : undefined
  const puedeGenerarFactura = tieneFiscalesCompletos && venta?.estado !== 'cancelada' && !facturaVigente

  function abrirModalFactura() {
    setErrorFactura('')
    setUsoCfdi(datosFiscales?.uso_cfdi_default || USOS_CFDI[0]!.valor)
    setFormaPago('03')
    setMetodoPago('PUE')
    setModalFacturaAbierto(true)
  }

  async function confirmarGenerarFactura() {
    setErrorFactura('')
    try {
      const nueva = await generarFactura.mutateAsync({
        venta: idVenta, uso_cfdi: usoCfdi, forma_pago: formaPago, metodo_pago: metodoPago,
      })
      setModalFacturaAbierto(false)
      navigate(`/facturacion/${nueva.id}`)
    } catch (err) {
      setErrorFactura(extraerMensajeError(err, 'No se pudo generar la factura.'))
    }
  }

  async function confirmarAccionEntregar() {
    setErrorAccion('')
    try {
      await entregar.mutateAsync(idVenta)
      setConfirmarEntregar(false)
    } catch (err) {
      setErrorAccion(extraerMensajeError(err, 'No se pudo marcar la venta como entregada.'))
    }
  }

  async function confirmarAccionCancelar() {
    setErrorAccion('')
    try {
      await cancelar.mutateAsync(idVenta)
      setConfirmarCancelar(false)
    } catch (err) {
      setErrorAccion(extraerMensajeError(err, 'No se pudo cancelar la venta.'))
    }
  }

  async function verTicket() {
    setErrorAccion('')
    setGenerandoTicket(true)
    try {
      const blob = await obtenerTicketVenta(idVenta)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      setErrorAccion('No se pudo generar el ticket en PDF.')
    } finally {
      setGenerandoTicket(false)
    }
  }

  if (isLoading) return <p>Cargando venta…</p>
  if (!venta) return <p>No se encontró la venta.</p>

  return (
    <div className="documentPage">
      <div className="documentToolbar">
        <BotonPrimario variante="secundario" onClick={() => navigate('/ventas')}>
          Volver al listado
        </BotonPrimario>
      </div>

      <article className="document">
        <header className="documentHeader documentHeaderSale">
          <div className="documentHeaderRow">
            <div className="documentHeaderText">
              <span className="documentEyebrow">Ventas</span>
              <h1 className="documentTitle">Venta #{venta.id}</h1>
              <p className="documentHint">Registrada el {new Date(venta.fecha).toLocaleString('es-MX')}</p>
            </div>
            <span className={claseEstado(venta.estado)}>{ETIQUETAS_ESTADO_VENTA[venta.estado]}</span>
          </div>
        </header>

        <section className="documentSection">
          <h2 className="sectionTitle">Datos generales</h2>
          <dl className="factGrid factGridThree">
            <div>
              <dt>Cliente</dt>
              <dd>{venta.cliente_nombre}</dd>
            </div>
            <div>
              <dt>Sucursal</dt>
              <dd>{venta.sucursal_nombre}</dd>
            </div>
            <div>
              <dt>Registrada por</dt>
              <dd>{venta.usuario_nombre}</dd>
            </div>
            <div>
              <dt>Fecha de entrega</dt>
              <dd>{venta.fecha_entrega ?? '—'}</dd>
            </div>
            <div>
              <dt>Entregada el</dt>
              <dd>{venta.fecha_entrega_real ? new Date(venta.fecha_entrega_real).toLocaleString('es-MX') : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="documentSection">
          <h2 className="sectionTitle">Productos</h2>
          <div className="tableScroll">
            <table className="linesTable">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="numeric">Cantidad</th>
                  <th className="numeric">Precio unitario</th>
                  <th className="numeric">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {venta.detalles.map((linea) => (
                  <tr key={linea.id}>
                    <td>{nombreProducto(linea.producto)}</td>
                    <td className="numeric">{linea.cantidad}</td>
                    <td className="numeric">{linea.precio_unitario}</td>
                    <td className="numeric">{linea.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="summary">
            <div className="summaryRow">
              <span>Subtotal</span>
              <span data-testid="subtotal-venta">{subtotalProductos.toFixed(2)}</span>
            </div>
            <div className="summaryRow">
              <span>Gastos de envío</span>
              <span data-testid="gasto-envio-venta">{venta.gasto_envio}</span>
            </div>
            <div className="summaryRow summaryTotal">
              <span>Total</span>
              <span data-testid="total-venta">{venta.total}</span>
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
            <BotonPrimario variante="secundario" onClick={verTicket} disabled={generandoTicket}>
              {generandoTicket ? 'Generando…' : 'Imprimir / descargar ticket'}
            </BotonPrimario>

            {facturaVigente ? (
              <BotonPrimario variante="secundario" onClick={() => navigate(`/facturacion/${facturaVigente.id}`)}>
                Ver factura ({ETIQUETAS_ESTADO_FACTURA[facturaVigente.estado]})
              </BotonPrimario>
            ) : (
              <span title={puedeGenerarFactura ? undefined : 'El cliente no tiene datos fiscales completos'}>
                <BotonPrimario variante="secundario" onClick={abrirModalFactura} disabled={!puedeGenerarFactura}>
                  {factura?.estado === 'error' ? 'Reintentar factura' : 'Generar factura'}
                </BotonPrimario>
              </span>
            )}

            {venta.estado === 'pendiente' && (
              <BotonPrimario onClick={() => setConfirmarEntregar(true)}>Marcar como entregada</BotonPrimario>
            )}
            {venta.estado !== 'cancelada' && (
              <BotonPrimario variante="peligro" onClick={() => setConfirmarCancelar(true)}>
                Cancelar venta
              </BotonPrimario>
            )}
          </div>
        </footer>
      </article>

      <Modal titulo="Marcar como entregada" abierto={confirmarEntregar} onCerrar={() => setConfirmarEntregar(false)}>
        <p className="confirmText">
          ¿Confirmas que quieres marcar la venta #{venta.id} como entregada? El stock y el ingreso de caja ya se
          registraron al crear la venta — esto actualiza el estado y la fecha de entrega real
          {Number(venta.gasto_envio) > 0
            ? ', y retira de caja el saldo adicional por costo de envío.'
            : '.'}
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setConfirmarEntregar(false)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarAccionEntregar} disabled={entregar.isPending}>
            {entregar.isPending ? 'Guardando…' : 'Confirmar entrega'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Cancelar venta" abierto={confirmarCancelar} onCerrar={() => setConfirmarCancelar(false)}>
        <p className="confirmText">
          ¿Confirmas que quieres cancelar la venta #{venta.id}? Se revertirá el stock descontado y el ingreso de
          caja registrados al crearla, mediante movimientos inversos.
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

      <Modal
        titulo={factura?.estado === 'error' ? 'Reintentar factura' : 'Generar factura'}
        abierto={modalFacturaAbierto}
        onCerrar={() => setModalFacturaAbierto(false)}
      >
        <div className="form">
          <label className="field">
            Uso de CFDI
            <select value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value)}>
              {USOS_CFDI.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Forma de pago
            <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
              {FORMAS_PAGO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Método de pago
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}>
              {METODOS_PAGO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>

          {errorFactura && (
            <p className="errorMessage" role="alert">
              {errorFactura}
            </p>
          )}

          <div className="formActions">
            <BotonPrimario variante="secundario" onClick={() => setModalFacturaAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario onClick={confirmarGenerarFactura} disabled={generarFactura.isPending}>
              {generarFactura.isPending ? 'Generando…' : 'Generar factura'}
            </BotonPrimario>
          </div>
        </div>
      </Modal>
    </div>
  )
}
