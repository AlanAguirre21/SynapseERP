import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  ETIQUETAS_ESTADO_FACTURA,
  FORMAS_PAGO,
  METODOS_PAGO,
  MOTIVOS_CANCELACION,
  USOS_CFDI,
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
import { formatearMoneda } from '../../utils/moneda'

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
  if (estado === 'timbrada') return 'status statusSuccess'
  if (estado === 'cancelada') return 'status statusError'
  if (estado === 'error') return 'status statusError'
  if (estado === 'pendiente_cancelacion') return 'status statusWarning'
  return 'status statusWarning'
}

// Código del SAT con su descripción ("G03 — Gastos en general"); un código
// que no esté en el catálogo del frontend se muestra tal cual.
function describirCodigo(catalogo: { valor: string; etiqueta: string }[], codigo: string): string {
  return catalogo.find((opcion) => opcion.valor === codigo)?.etiqueta ?? (codigo || '—')
}

// Las fechas de pago llegan como "AAAA-MM-DD"; `new Date()` las tomaría como
// medianoche UTC y en México se mostrarían como el día anterior.
function formatearFechaSimple(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  if (!anio || !mes || !dia) return fecha
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX')
}

function formatearFechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

// El portapapeles solo existe en contextos seguros (HTTPS o localhost): sin
// él, el botón no se muestra.
function BotonCopiarFolio({ folio }: { folio: string }) {
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(folio)
      setCopiado(true)
      window.clearTimeout(temporizador.current)
      temporizador.current = window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: no hay nada útil que mostrar, se ignora.
    }
  }

  if (!navigator.clipboard) return null

  return (
    <button type="button" className="actionLink" onClick={copiar} aria-label="Copiar folio fiscal">
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
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
  const esPpd = factura.metodo_pago === 'PPD'
  const serieFolio = factura.serie && factura.folio_interno ? `${factura.serie}-${factura.folio_interno}` : null

  // Solo para mostrar: cuentan los complementos timbrados; los que fallaron
  // no amparan ningún pago. El backend sigue validando cada pago.
  const total = Number(factura.venta_total)
  const pagado = (complementos ?? [])
    .filter((c) => c.estado === 'timbrada')
    .reduce((suma, c) => suma + Number(c.monto_pagado), 0)
  const saldo = Math.max(total - pagado, 0)

  const columnasComplementos: ColumnaTabla<ComplementoPago>[] = [
    {
      clave: 'fecha_pago',
      encabezado: 'Fecha de pago',
      render: (fila) => <span className="cellNoWrap">{formatearFechaSimple(fila.fecha_pago)}</span>,
    },
    {
      clave: 'monto_pagado',
      alineacion: 'derecha',
      encabezado: 'Monto',
      render: (fila) => formatearMoneda(fila.monto_pagado),
    },
    { clave: 'folio_fiscal_rep', encabezado: 'Folio fiscal REP', render: (fila) => fila.folio_fiscal_rep || '—' },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) =>
        fila.estado === 'timbrada' ? (
          <span className="status statusSuccess">Timbrado</span>
        ) : (
          <span className="status statusError">Error</span>
        ),
    },
  ]

  return (
    <div className="documentPage">
      <div className="documentToolbar">
        <BotonPrimario variante="secundario" onClick={() => navigate('/facturacion')}>
          Volver al listado
        </BotonPrimario>
      </div>

      <article className="document">
        <header className="documentHeader documentHeaderSale">
          <div className="documentHeaderRow">
            <div className="documentHeaderText">
              <span className="documentEyebrow">Facturación</span>
              <h1 className="documentTitle">Factura #{factura.id}</h1>
              <p className="documentHint">
                {serieFolio ? `Serie y folio ${serieFolio} · ` : ''}Generada el {formatearFechaHora(factura.fecha_creacion)}
              </p>
            </div>
            <span className={claseEstado(factura.estado)}>{ETIQUETAS_ESTADO_FACTURA[factura.estado]}</span>
          </div>
        </header>

        {factura.estado === 'error' && (
          <section className="documentSection">
            <p className="errorMessage" role="alert">
              El PAC rechazó el timbrado: {factura.mensaje_error || 'sin detalle.'} Vuelve a la venta de origen para
              reintentar.
            </p>
          </section>
        )}

        {factura.estado === 'pendiente_cancelacion' && (
          <section className="documentSection">
            <p className="notice" role="status">
              Cancelación solicitada (motivo {factura.motivo_cancelacion}) — en espera de que el receptor la acepte o
              de que venza el plazo de 72 horas que exige el SAT
              {factura.fecha_solicitud_cancelacion
                ? ` (desde ${new Date(factura.fecha_solicitud_cancelacion).toLocaleString('es-MX')})`
                : ''}
              .
            </p>
          </section>
        )}

        <section className="documentSection">
          <h2 className="sectionTitle">Datos fiscales</h2>
          <dl className="factGrid factGridThree">
            <div>
              <dt>Cliente</dt>
              <dd>{factura.cliente_nombre}</dd>
            </div>
            <div>
              <dt>Venta</dt>
              <dd>
                <button type="button" className="actionLink" onClick={() => navigate(`/ventas/${factura.venta}`)}>
                  Venta #{factura.venta}
                </button>
              </dd>
            </div>
            <div>
              <dt>Timbrada el</dt>
              <dd>{factura.fecha_timbrado ? formatearFechaHora(factura.fecha_timbrado) : '—'}</dd>
            </div>
            <div>
              <dt>Uso de CFDI</dt>
              <dd>{describirCodigo(USOS_CFDI, factura.uso_cfdi)}</dd>
            </div>
            <div>
              <dt>Forma de pago</dt>
              <dd>{describirCodigo(FORMAS_PAGO, factura.forma_pago)}</dd>
            </div>
            <div>
              <dt>Método de pago</dt>
              <dd>{describirCodigo(METODOS_PAGO, factura.metodo_pago)}</dd>
            </div>
            <div className="factGridFull">
              <dt>Folio fiscal (UUID)</dt>
              {/* Texto en línea, no flex: el UUID se parte en sus guiones en pantallas angostas. */}
              <dd>
                {factura.folio_fiscal ? (
                  <>
                    {factura.folio_fiscal} <BotonCopiarFolio folio={factura.folio_fiscal} />
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>

          <div className="summary">
            {esPpd ? (
              <>
                <div className="summaryRow">
                  <span>Total</span>
                  <span>{formatearMoneda(total)}</span>
                </div>
                <div className="summaryRow">
                  <span>Pagado</span>
                  <span data-testid="pagado-factura">{formatearMoneda(pagado)}</span>
                </div>
                <div className="summaryRow summaryTotal">
                  <span>Saldo pendiente</span>
                  <span data-testid="saldo-factura">{formatearMoneda(saldo)}</span>
                </div>
              </>
            ) : (
              <div className="summaryRow summaryTotal">
                <span>Total</span>
                <span data-testid="total-factura">{formatearMoneda(total)}</span>
              </div>
            )}
          </div>
        </section>

        {esPpd && (
          <section className="documentSection">
            <div className="sectionHeader">
              <h2 className="sectionTitle">Complementos de pago</h2>
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

        <footer className="documentFooter">
          {errorAccion && (
            <p className="errorMessage" role="alert">
              {errorAccion}
            </p>
          )}

          <div className="pageActions">
            <BotonPrimario
              variante="secundario"
              onClick={alDescargarXml}
              disabled={!tieneArchivos || descargarXml.isPending}
            >
              Descargar XML
            </BotonPrimario>
            <BotonPrimario
              variante="secundario"
              onClick={alDescargarPdf}
              disabled={!tieneArchivos || descargarPdf.isPending}
            >
              Descargar PDF
            </BotonPrimario>
            {factura.estado === 'timbrada' && (
              <BotonPrimario variante="peligro" onClick={() => setConfirmarCancelar(true)}>
                Cancelar factura
              </BotonPrimario>
            )}
          </div>
        </footer>
      </article>

      <Modal titulo="Cancelar factura" abierto={confirmarCancelar} onCerrar={() => setConfirmarCancelar(false)}>
        <p className="confirmText">
          Selecciona el motivo de cancelación exigido por el SAT. La factura quedará "pendiente de cancelación"
          hasta que el receptor la acepte o venza el plazo de 72 horas.
        </p>

        <label className="field">
          Motivo de cancelación
          <select value={motivoCancelacion} onChange={(e) => setMotivoCancelacion(e.target.value as MotivoCancelacion)}>
            {MOTIVOS_CANCELACION.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </label>

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
        titulo="Registrar complemento de pago"
        abierto={formularioComplementoAbierto}
        onCerrar={() => setFormularioComplementoAbierto(false)}
      >
        <form className="form" onSubmit={alGuardarComplemento} noValidate>
          <label className="field">
            Monto pagado
            <input
              type="number" step="0.01" min="0" value={montoPagado}
              onChange={(e) => setMontoPagado(e.target.value)} required
            />
          </label>

          <label className="field">
            Fecha de pago
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
          </label>

          {errorComplemento && (
            <p className="errorMessage" role="alert">
              {errorComplemento}
            </p>
          )}

          <div className="formActions">
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
