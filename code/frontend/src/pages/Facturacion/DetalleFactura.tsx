import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  ETIQUETAS_ESTADO_FACTURA,
  MOTIVOS_CANCELACION,
  type ComplementoPago,
  type EstadoFactura,
  type MotivoCancelacion,
} from '../../api/facturacion'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import {
  useCancelarFactura,
  useComplementosPago,
  useDescargarPdfFactura,
  useDescargarXmlFactura,
  useFactura,
  useRegistrarComplementoPago,
} from '../../hooks/useFacturas'
import styles from './DetalleFactura.module.css'

function extraerMensajeError(err: unknown, mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined

  if (typeof datos?.detail === 'string') return datos.detail
  return mensajePorDefecto
}

function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}

function claseEstado(estado: EstadoFactura) {
  if (estado === 'timbrada') return styles.estadoTimbrada
  if (estado === 'cancelada') return styles.estadoCancelada
  if (estado === 'error') return styles.estadoError
  if (estado === 'pendiente_cancelacion') return styles.estadoPendienteCancelacion
  return styles.estadoPendiente
}

export function DetalleFactura() {
  const { id } = useParams<{ id: string }>()
  const idFactura = Number(id)
  const navigate = useNavigate()

  const { data: factura, isLoading } = useFactura(idFactura)
  const { data: complementos } = useComplementosPago(idFactura)
  const cancelar = useCancelarFactura()
  const descargarXml = useDescargarXmlFactura()
  const descargarPdf = useDescargarPdfFactura()
  const registrarComplemento = useRegistrarComplementoPago()

  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState<MotivoCancelacion>('02')
  const [errorAccion, setErrorAccion] = useState('')

  const [formularioComplementoAbierto, setFormularioComplementoAbierto] = useState(false)
  const [montoPagado, setMontoPagado] = useState('')
  const [fechaPago, setFechaPago] = useState('')
  const [errorComplemento, setErrorComplemento] = useState('')

  async function confirmarAccionCancelar() {
    setErrorAccion('')
    try {
      await cancelar.mutateAsync({ id: idFactura, motivo: motivoCancelacion })
      setConfirmarCancelar(false)
    } catch (err) {
      setErrorAccion(extraerMensajeError(err, 'No se pudo cancelar la factura.'))
    }
  }

  async function alDescargarXml() {
    const blob = await descargarXml.mutateAsync(idFactura)
    descargarBlob(blob, `factura-${idFactura}.xml`)
  }

  async function alDescargarPdf() {
    const blob = await descargarPdf.mutateAsync(idFactura)
    descargarBlob(blob, `factura-${idFactura}.pdf`)
  }

  function abrirFormularioComplemento() {
    setErrorComplemento('')
    setMontoPagado('')
    setFechaPago('')
    setFormularioComplementoAbierto(true)
  }

  async function alGuardarComplemento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorComplemento('')
    try {
      await registrarComplemento.mutateAsync({ factura: idFactura, monto_pagado: montoPagado, fecha_pago: fechaPago })
      setFormularioComplementoAbierto(false)
    } catch (err) {
      setErrorComplemento(extraerMensajeError(err, 'No se pudo registrar el complemento de pago.'))
    }
  }

  if (isLoading) return <p>Cargando factura…</p>
  if (!factura) return <p>No se encontró la factura.</p>

  const tieneArchivos = Boolean(factura.folio_fiscal)

  const columnasComplementos: ColumnaTabla<ComplementoPago>[] = [
    { clave: 'fecha_pago', encabezado: 'Fecha de pago' },
    { clave: 'monto_pagado', encabezado: 'Monto' },
    { clave: 'folio_fiscal_rep', encabezado: 'Folio fiscal REP', render: (fila) => fila.folio_fiscal_rep || '—' },
    { clave: 'estado', encabezado: 'Estado', render: (fila) => (fila.estado === 'timbrada' ? 'Timbrado' : 'Error') },
  ]

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Factura #{factura.id}</h1>
        <BotonPrimario variante="secundario" onClick={() => navigate('/facturacion')}>
          Volver al listado
        </BotonPrimario>
      </div>

      <div className={styles.datosGenerales}>
        <span className={styles.etiqueta}>Cliente</span>
        <span>{factura.cliente_nombre}</span>

        <span className={styles.etiqueta}>Venta</span>
        <span>
          <button type="button" className={styles.enlaceAccion} onClick={() => navigate(`/ventas/${factura.venta}`)}>
            Venta #{factura.venta}
          </button>
        </span>

        <span className={styles.etiqueta}>Folio fiscal</span>
        <span>{factura.folio_fiscal || '—'}</span>

        <span className={styles.etiqueta}>Serie / folio</span>
        <span>{factura.serie && factura.folio_interno ? `${factura.serie}-${factura.folio_interno}` : '—'}</span>

        <span className={styles.etiqueta}>Uso de CFDI</span>
        <span>{factura.uso_cfdi}</span>

        <span className={styles.etiqueta}>Forma de pago</span>
        <span>{factura.forma_pago}</span>

        <span className={styles.etiqueta}>Método de pago</span>
        <span>{factura.metodo_pago}</span>

        <span className={styles.etiqueta}>Total</span>
        <span>{factura.venta_total}</span>

        <span className={styles.etiqueta}>Generada el</span>
        <span>{new Date(factura.fecha_creacion).toLocaleString('es-MX')}</span>

        <span className={styles.etiqueta}>Timbrada el</span>
        <span>{factura.fecha_timbrado ? new Date(factura.fecha_timbrado).toLocaleString('es-MX') : '—'}</span>

        <span className={styles.etiqueta}>Estado</span>
        <span className={claseEstado(factura.estado)}>{ETIQUETAS_ESTADO_FACTURA[factura.estado]}</span>
      </div>

      {factura.estado === 'error' && (
        <p className={styles.error} role="alert">
          El PAC rechazó el timbrado: {factura.mensaje_error || 'sin detalle.'} Vuelve a la venta de origen para
          reintentar.
        </p>
      )}

      {factura.estado === 'pendiente_cancelacion' && (
        <p className={styles.aviso} role="status">
          Cancelación solicitada (motivo {factura.motivo_cancelacion}) — en espera de que el receptor la acepte o de
          que venza el plazo de 72 horas que exige el SAT
          {factura.fecha_solicitud_cancelacion
            ? ` (desde ${new Date(factura.fecha_solicitud_cancelacion).toLocaleString('es-MX')})`
            : ''}
          .
        </p>
      )}

      {errorAccion && (
        <p className={styles.error} role="alert">
          {errorAccion}
        </p>
      )}

      <div className={styles.acciones}>
        <BotonPrimario variante="secundario" onClick={alDescargarXml} disabled={!tieneArchivos || descargarXml.isPending}>
          Descargar XML
        </BotonPrimario>
        <BotonPrimario variante="secundario" onClick={alDescargarPdf} disabled={!tieneArchivos || descargarPdf.isPending}>
          Descargar PDF
        </BotonPrimario>
        {factura.estado === 'timbrada' && (
          <BotonPrimario variante="peligro" onClick={() => setConfirmarCancelar(true)}>
            Cancelar factura
          </BotonPrimario>
        )}
      </div>

      {factura.metodo_pago === 'PPD' && (
        <section className={styles.seccion}>
          <div className={styles.encabezadoSeccion}>
            <h2 className={styles.subtitulo}>Complementos de pago</h2>
            <BotonPrimario onClick={abrirFormularioComplemento} disabled={factura.estado !== 'timbrada'}>
              Registrar pago
            </BotonPrimario>
          </div>

          <Tabla
            columnas={columnasComplementos}
            datos={complementos ?? []}
            mensajeVacio="Todavía no hay complementos de pago registrados."
          />
        </section>
      )}

      <Modal titulo="Cancelar factura" abierto={confirmarCancelar} onCerrar={() => setConfirmarCancelar(false)}>
        <p className={styles.textoConfirmacion}>
          Selecciona el motivo de cancelación exigido por el SAT. La factura quedará "pendiente de cancelación"
          hasta que el receptor la acepte o venza el plazo de 72 horas.
        </p>

        <label className={styles.campo}>
          Motivo de cancelación
          <select value={motivoCancelacion} onChange={(e) => setMotivoCancelacion(e.target.value as MotivoCancelacion)}>
            {MOTIVOS_CANCELACION.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </label>

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
        titulo="Registrar complemento de pago"
        abierto={formularioComplementoAbierto}
        onCerrar={() => setFormularioComplementoAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardarComplemento} noValidate>
          <label className={styles.campo}>
            Monto pagado
            <input
              type="number" step="0.01" min="0" value={montoPagado}
              onChange={(e) => setMontoPagado(e.target.value)} required
            />
          </label>

          <label className={styles.campo}>
            Fecha de pago
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
          </label>

          {errorComplemento && (
            <p className={styles.error} role="alert">
              {errorComplemento}
            </p>
          )}

          <div className={styles.accionesFormulario}>
            <BotonPrimario type="button" variante="secundario" onClick={() => setFormularioComplementoAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={registrarComplemento.isPending}>
              {registrarComplemento.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>
    </div>
  )
}
