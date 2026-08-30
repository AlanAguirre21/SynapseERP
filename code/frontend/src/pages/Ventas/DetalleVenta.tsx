import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ETIQUETAS_ESTADO_FACTURA, FORMAS_PAGO, METODOS_PAGO, USOS_CFDI, type MetodoPago } from '../../api/facturacion'
import { obtenerTicketVenta, type EstadoVenta } from '../../api/ventas'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useClientes } from '../../hooks/useClientes'
import { useFacturaDeVenta, useGenerarFactura } from '../../hooks/useFacturas'
import { useProductos } from '../../hooks/useProductos'
import { useCancelarVenta, useEntregarVenta, useVenta } from '../../hooks/useVentas'
import styles from './DetalleVenta.module.css'

const ETIQUETAS_ESTADO: Record<EstadoVenta, string> = {
  pendiente: 'Pendiente',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
}

function claseEstado(estado: EstadoVenta) {
  if (estado === 'entregada') return styles.estadoEntregada
  if (estado === 'cancelada') return styles.estadoCancelada
  return styles.estadoPendiente
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
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Venta #{venta.id}</h1>
        <BotonPrimario variante="secundario" onClick={() => navigate('/ventas')}>
          Volver al listado
        </BotonPrimario>
      </div>

      <div className={styles.datosGenerales}>
        <span className={styles.etiqueta}>Cliente</span>
        <span>{venta.cliente_nombre}</span>

        <span className={styles.etiqueta}>Sucursal</span>
        <span>{venta.sucursal_nombre}</span>

        <span className={styles.etiqueta}>Fecha</span>
        <span>{new Date(venta.fecha).toLocaleString('es-MX')}</span>

        <span className={styles.etiqueta}>Fecha de entrega</span>
        <span>{venta.fecha_entrega ?? '—'}</span>

        <span className={styles.etiqueta}>Entregada el</span>
        <span>{venta.fecha_entrega_real ? new Date(venta.fecha_entrega_real).toLocaleString('es-MX') : '—'}</span>

        <span className={styles.etiqueta}>Registrada por</span>
        <span>{venta.usuario_nombre}</span>

        <span className={styles.etiqueta}>Estado</span>
        <span className={claseEstado(venta.estado)}>{ETIQUETAS_ESTADO[venta.estado]}</span>
      </div>

      <table className={styles.tablaLineas}>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Precio unitario</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venta.detalles.map((linea) => (
            <tr key={linea.id}>
              <td>{nombreProducto(linea.producto)}</td>
              <td>{linea.cantidad}</td>
              <td>{linea.precio_unitario}</td>
              <td>{linea.subtotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.total}>
        <span>Total:</span>
        <span data-testid="total-venta">{venta.total}</span>
      </div>

      {errorAccion && (
        <p className={styles.error} role="alert">
          {errorAccion}
        </p>
      )}

      <div className={styles.acciones}>
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

      <Modal titulo="Marcar como entregada" abierto={confirmarEntregar} onCerrar={() => setConfirmarEntregar(false)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres marcar la venta #{venta.id} como entregada? El stock y el ingreso de caja ya se
          registraron al crear la venta — esto solo actualiza el estado y la fecha de entrega real.
        </p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setConfirmarEntregar(false)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarAccionEntregar} disabled={entregar.isPending}>
            {entregar.isPending ? 'Guardando…' : 'Confirmar entrega'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Cancelar venta" abierto={confirmarCancelar} onCerrar={() => setConfirmarCancelar(false)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres cancelar la venta #{venta.id}? Se revertirá el stock descontado y el ingreso de
          caja registrados al crearla, mediante movimientos inversos.
        </p>
        <div className={styles.accionesFormulario}>
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
        <div className={styles.formularioFactura}>
          <label className={styles.campo}>
            Uso de CFDI
            <select value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value)}>
              {USOS_CFDI.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
            Forma de pago
            <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
              {FORMAS_PAGO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
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
            <p className={styles.error} role="alert">
              {errorFactura}
            </p>
          )}

          <div className={styles.accionesFormulario}>
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
