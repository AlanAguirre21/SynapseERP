import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import type { EstadoCompra } from '../../api/compras'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useCancelarCompra, useCompra, useRecibirCompra } from '../../hooks/useCompras'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useProductos } from '../../hooks/useProductos'
import styles from './DetalleCompra.module.css'

const ETIQUETAS_ESTADO: Record<EstadoCompra, string> = {
  pendiente: 'Pendiente',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

function claseEstado(estado: EstadoCompra) {
  if (estado === 'recibida') return styles.estadoRecibida
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
  if (!compra) return <p>No se encontró la compra.</p>

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Compra #{compra.id}</h1>
        <BotonPrimario variante="secundario" onClick={() => navigate('/compras')}>
          Volver al listado
        </BotonPrimario>
      </div>

      <div className={styles.datosGenerales}>
        <span className={styles.etiqueta}>Proveedor</span>
        <span>{compra.proveedor_nombre}</span>

        <span className={styles.etiqueta}>Sucursal destino</span>
        <span>{compra.sucursal_nombre}</span>

        <span className={styles.etiqueta}>Fecha</span>
        <span>{new Date(compra.fecha).toLocaleString('es-MX')}</span>

        <span className={styles.etiqueta}>Fecha de entrega estimada</span>
        <span>{compra.fecha_entrega ?? '—'}</span>

        <span className={styles.etiqueta}>Registrada por</span>
        <span>{compra.usuario_nombre}</span>

        <span className={styles.etiqueta}>Estado</span>
        <span className={claseEstado(compra.estado)}>{ETIQUETAS_ESTADO[compra.estado]}</span>
      </div>

      <table className={styles.tablaLineas}>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Ítem</th>
            <th>Cantidad</th>
            <th>Costo unitario</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {compra.detalles_producto.map((linea) => (
            <tr key={`producto-${linea.id}`}>
              <td>Producto</td>
              <td>{nombreProducto(linea.producto)}</td>
              <td>{linea.cantidad}</td>
              <td>{linea.costo_unitario}</td>
              <td>{linea.subtotal}</td>
            </tr>
          ))}
          {compra.detalles_materia_prima.map((linea) => (
            <tr key={`materia-prima-${linea.id}`}>
              <td>Materia prima</td>
              <td>{nombreMateriaPrima(linea.materia_prima)}</td>
              <td>{linea.cantidad}</td>
              <td>{linea.costo_unitario}</td>
              <td>{linea.subtotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.total}>
        <span>Total:</span>
        <span data-testid="total-compra">{compra.total}</span>
      </div>

      {errorAccion && (
        <p className={styles.error} role="alert">
          {errorAccion}
        </p>
      )}

      <div className={styles.acciones}>
        {compra.estado === 'pendiente' && (
          <BotonPrimario onClick={() => setConfirmarRecibir(true)}>Marcar como recibida</BotonPrimario>
        )}
        {compra.estado !== 'cancelada' && (
          <BotonPrimario variante="peligro" onClick={() => setConfirmarCancelar(true)}>
            Cancelar compra
          </BotonPrimario>
        )}
      </div>

      <Modal titulo="Marcar como recibida" abierto={confirmarRecibir} onCerrar={() => setConfirmarRecibir(false)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres marcar la compra #{compra.id} como recibida? Esto aumentará el stock de sus líneas
          en {compra.sucursal_nombre} y registrará el movimiento de entrada correspondiente.
        </p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setConfirmarRecibir(false)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarAccionRecibir} disabled={recibir.isPending}>
            {recibir.isPending ? 'Guardando…' : 'Confirmar recepción'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Cancelar compra" abierto={confirmarCancelar} onCerrar={() => setConfirmarCancelar(false)}>
        <p className={styles.textoConfirmacion}>
          {compra.estado === 'recibida'
            ? `¿Confirmas que quieres cancelar la compra #${compra.id}? Como ya fue recibida, se generará un movimiento de salida inverso por cada línea para revertir el stock.`
            : `¿Confirmas que quieres cancelar la compra #${compra.id}?`}
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
    </div>
  )
}
