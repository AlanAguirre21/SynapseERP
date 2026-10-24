import { useState, type FormEvent } from 'react'

import {
  ETIQUETAS_ESTADO_NOMINA,
  periodoQuincena,
  type EstadoSolicitudNomina,
  type FiltrosSolicitudesNomina,
  type Quincena,
  type ResultadoGenerarNomina,
  type SolicitudNomina,
} from '../../api/rrhh'
import { Avatar } from '../../components/common/Avatar'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useSaldoCaja } from '../../hooks/useMovimientosCaja'
import {
  useAprobarSolicitudNomina,
  useEditarMontoNomina,
  useGenerarNomina,
  usePagarSolicitudesNomina,
  useRechazarSolicitudNomina,
  useRevertirPagoNomina,
  useSolicitudesNomina,
} from '../../hooks/useSolicitudesNomina'
import { formatearMoneda } from '../../utils/moneda'
import { normalizarBusqueda } from '../../utils/texto'
import styles from './RRHH.module.css'

// Pestaña "Nóminas" de Recursos Humanos — `008 · RRHH`, "Actualización:
// nómina con pago en caja". Aprobar una solicitud la paga desde Caja; toda
// regla (saldo, todo o nada, estados) la valida el backend.

const CLASES_ESTADO: Record<EstadoSolicitudNomina, string> = {
  pendiente: 'status statusWarning',
  aprobado: 'status statusNeutral',
  pagado: 'status statusSuccess',
  rechazado: 'status statusError',
  revertido: 'status statusNeutral',
}

const FILTROS_ESTADO: { valor: EstadoSolicitudNomina | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'pagado', etiqueta: 'Pagadas' },
  { valor: 'rechazado', etiqueta: 'Rechazadas' },
  { valor: 'revertido', etiqueta: 'Revertidas' },
]

const TODOS_LOS_PERIODOS = 'todos'

interface PeriodoQuincena {
  anio: number
  mes: number
  quincena: Quincena
}

function quincenaDe(fecha: Date): PeriodoQuincena {
  return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1, quincena: fecha.getDate() <= 15 ? 1 : 2 }
}

function clavePeriodo({ anio, mes, quincena }: PeriodoQuincena): string {
  return `${anio}-${mes}-${quincena}`
}

function leerClave(clave: string): PeriodoQuincena {
  const [anio, mes, quincena] = clave.split('-').map(Number)
  return { anio: anio ?? 0, mes: mes ?? 1, quincena: quincena === 2 ? 2 : 1 }
}

function desplazar(periodo: PeriodoQuincena, quincenas: number): PeriodoQuincena {
  const indice = periodo.anio * 24 + (periodo.mes - 1) * 2 + (periodo.quincena - 1) + quincenas
  return { anio: Math.floor(indice / 24), mes: Math.floor((indice % 24) / 2) + 1, quincena: ((indice % 2) + 1) as Quincena }
}

function nombreMes(mes: number): string {
  return new Date(2000, mes - 1, 1).toLocaleString('es-MX', { month: 'long' })
}

function etiquetaPeriodo({ anio, mes, quincena }: PeriodoQuincena): string {
  return `${quincena === 1 ? '1.ª' : '2.ª'} quincena de ${nombreMes(mes)} ${anio}`
}

// `AAAA-MM-DD` -> `DD/MM/AAAA`, sin pasar por `Date` (evita el corrimiento de zona horaria).
function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

function textoPeriodo(solicitud: Pick<SolicitudNomina, 'periodo_inicio' | 'periodo_fin'>): string {
  return `${fechaCorta(solicitud.periodo_inicio)} – ${fechaCorta(solicitud.periodo_fin)}`
}

function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// Saldo con signo antes del símbolo, como en Caja: -5 -> "−$5.00".
function formatearSaldo(valor: number): string {
  return valor < 0 ? `−${formatearMoneda(-valor)}` : formatearMoneda(valor)
}

function sumar(solicitudes: SolicitudNomina[]): number {
  return solicitudes.reduce((total, s) => total + Number(s.monto), 0)
}

function mensajeDeError(err: unknown, porDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined
  if (typeof datos?.detail === 'string') return datos.detail
  for (const valor of Object.values(datos ?? {})) {
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
  }
  return porDefecto
}

export function PestanaNominas() {
  const [actual] = useState(() => quincenaDe(new Date()))
  // Del más reciente al más antiguo: la siguiente quincena (para generarla
  // por adelantado), la actual y las diez anteriores.
  const opcionesPeriodo = Array.from({ length: 12 }, (_, i) => desplazar(actual, 1 - i))

  const [periodo, setPeriodo] = useState(clavePeriodo(actual))
  const [estado, setEstado] = useState<EstadoSolicitudNomina | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())

  const [generarAbierto, setGenerarAbierto] = useState(false)
  const [aPagar, setAPagar] = useState<SolicitudNomina[] | null>(null)
  const [aRechazar, setARechazar] = useState<SolicitudNomina | null>(null)
  const [aRevertir, setARevertir] = useState<SolicitudNomina | null>(null)
  const [aEditar, setAEditar] = useState<SolicitudNomina | null>(null)

  const filtros: FiltrosSolicitudesNomina = { estado: estado || undefined }
  if (periodo !== TODOS_LOS_PERIODOS) {
    const { anio, mes, quincena } = leerClave(periodo)
    const { inicio, fin } = periodoQuincena(anio, mes, quincena)
    filtros.periodo_inicio = inicio
    filtros.periodo_fin = fin
  }
  const { data: solicitudes, isLoading } = useSolicitudesNomina(filtros)
  const { data: saldos } = useSaldoCaja()
  const saldoCaja = saldos ? Number(saldos.saldo_total) : null

  const lista = solicitudes ?? []
  const termino = normalizarBusqueda(busqueda.trim())
  const filtradas = termino ? lista.filter((s) => normalizarBusqueda(s.empleado_nombre).includes(termino)) : lista
  const hayFiltros = periodo !== clavePeriodo(actual) || estado !== '' || busqueda.trim() !== ''

  const pendientes = filtradas.filter((s) => s.estado === 'pendiente')
  const pagadas = filtradas.filter((s) => s.estado === 'pagado')
  const seleccionadas = pendientes.filter((s) => seleccion.has(s.id))
  const todasSeleccionadas = pendientes.length > 0 && seleccionadas.length === pendientes.length

  function limpiarFiltros() {
    setPeriodo(clavePeriodo(actual))
    setEstado('')
    setBusqueda('')
  }

  function alternarSeleccion(id: number) {
    setSeleccion((previa) => {
      const nueva = new Set(previa)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })
  }

  function alternarTodas() {
    setSeleccion(todasSeleccionadas ? new Set() : new Set(pendientes.map((s) => s.id)))
  }

  function alternarDetalle(id: number) {
    setExpandidas((previa) => {
      const nueva = new Set(previa)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })
  }

  const columnas: ColumnaTabla<SolicitudNomina>[] = [
    {
      clave: 'id',
      encabezado: (
        <input
          type="checkbox"
          checked={todasSeleccionadas}
          onChange={alternarTodas}
          disabled={pendientes.length === 0}
          aria-label="Seleccionar todas las pendientes"
        />
      ),
      render: (fila) =>
        fila.estado === 'pendiente' ? (
          <input
            type="checkbox"
            checked={seleccion.has(fila.id)}
            onChange={() => alternarSeleccion(fila.id)}
            aria-label={`Seleccionar nómina de ${fila.empleado_nombre}`}
          />
        ) : null,
    },
    {
      clave: 'empleado_nombre',
      encabezado: 'Empleado',
      render: (fila) => (
        <span className={styles.directoryName}>
          <Avatar nombre={fila.empleado_nombre} foto={fila.empleado_foto} />
          {fila.empleado_nombre}
        </span>
      ),
    },
    { clave: 'posicion_nombre', encabezado: 'Posición', render: (fila) => fila.posicion_nombre ?? '—' },
    {
      clave: 'periodo_inicio',
      encabezado: 'Periodo',
      render: (fila) => <span className="cellNoWrap">{textoPeriodo(fila)}</span>,
    },
    { clave: 'monto', encabezado: 'Monto', alineacion: 'derecha', render: (fila) => formatearMoneda(fila.monto) },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={CLASES_ESTADO[fila.estado]}>{ETIQUETAS_ESTADO_NOMINA[fila.estado]}</span>,
    },
  ]

  function renderAcciones(fila: SolicitudNomina) {
    if (fila.estado === 'pendiente') {
      return (
        <div className="rowActions cellNoWrap">
          <button type="button" className="actionLink" onClick={() => setAEditar(fila)}>
            Editar monto
          </button>
          <button type="button" className="actionLink" onClick={() => setAPagar([fila])}>
            Aprobar y pagar
          </button>
          <button type="button" className="dangerActionLink" onClick={() => setARechazar(fila)}>
            Rechazar
          </button>
        </div>
      )
    }
    return (
      <div className="rowActions cellNoWrap">
        <button
          type="button"
          className="actionLink"
          onClick={() => alternarDetalle(fila.id)}
          aria-expanded={expandidas.has(fila.id)}
        >
          {expandidas.has(fila.id) ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
        {fila.estado === 'pagado' && (
          <button type="button" className="dangerActionLink" onClick={() => setARevertir(fila)}>
            Revertir pago
          </button>
        )}
      </div>
    )
  }

  function renderDetalle(fila: SolicitudNomina) {
    if (!expandidas.has(fila.id)) return null
    const accion =
      fila.estado === 'rechazado' ? 'Rechazada' : fila.estado === 'aprobado' ? 'Aprobada' : 'Pagada'
    return (
      <dl className="factGrid factGridThree">
        <div>
          <dt>{accion} por</dt>
          <dd>{fila.resuelto_por_nombre ?? '—'}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{fechaHora(fila.fecha_resolucion)}</dd>
        </div>
        <div>
          <dt>Movimiento de caja</dt>
          <dd>{fila.movimiento_pago ? `#${fila.movimiento_pago}` : 'Sin pago en caja'}</dd>
        </div>
        {fila.estado === 'revertido' && (
          <>
            <div>
              <dt>Revertida por</dt>
              <dd>{fila.revertido_por_nombre ?? '—'}</dd>
            </div>
            <div>
              <dt>Fecha del reverso</dt>
              <dd>{fechaHora(fila.fecha_reverso)}</dd>
            </div>
            <div>
              <dt>Motivo del reverso</dt>
              <dd>{fila.motivo_reverso || '—'}</dd>
            </div>
          </>
        )}
      </dl>
    )
  }

  const mensajeVacio =
    lista.length === 0 && !estado
      ? 'Todavía no hay solicitudes de nómina para este periodo. Usa "Generar nómina" para crearlas.'
      : 'Ninguna solicitud de nómina coincide con los filtros.'

  return (
    <div className="tabPanel">
      <div className="sectionHeader">
        <h2 className="sectionTitle">Nóminas</h2>
        <BotonPrimario onClick={() => setGenerarAbierto(true)}>Generar nómina</BotonPrimario>
      </div>

      <div className="statRow">
        <div className={pendientes.length > 0 ? 'statTile statTileWarning' : 'statTile'}>
          <span className="statLabel">Pendientes</span>
          <span className="statValue">{pendientes.length}</span>
          <span className="fieldHint">{formatearMoneda(sumar(pendientes))}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Pagado</span>
          <span className="statValue">{formatearMoneda(sumar(pagadas))}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Saldo de caja</span>
          <span className="statValue">{saldoCaja === null ? '—' : formatearMoneda(saldoCaja)}</span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
          Periodo
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {opcionesPeriodo.map((p) => (
              <option key={clavePeriodo(p)} value={clavePeriodo(p)}>
                {etiquetaPeriodo(p)}
              </option>
            ))}
            <option value={TODOS_LOS_PERIODOS}>Todos los periodos</option>
          </select>
        </label>
        <label className="filterField">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoSolicitudNomina | '')}>
            {FILTROS_ESTADO.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="filterField">
          Buscar
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre del empleado"
          />
        </label>
        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      {seleccionadas.length > 0 && (
        <div className={styles.selectionBar} role="region" aria-label="Selección de nóminas">
          <span>{`${seleccionadas.length} seleccionadas · total ${formatearMoneda(sumar(seleccionadas))}`}</span>
          <BotonPrimario onClick={() => setAPagar(seleccionadas)}>Aprobar y pagar seleccionadas</BotonPrimario>
        </div>
      )}

      {isLoading ? (
        <p>Cargando nóminas…</p>
      ) : (
        <>
          <span className="pageHint">{`Mostrando ${filtradas.length} de ${lista.length}`}</span>
          <Tabla
            columnas={columnas}
            datos={filtradas}
            mensajeVacio={mensajeVacio}
            renderAcciones={renderAcciones}
            renderExpandido={renderDetalle}
          />
        </>
      )}

      <ModalGenerarNomina
        abierto={generarAbierto}
        periodoInicial={actual}
        onCerrar={() => setGenerarAbierto(false)}
        onGenerada={(p) => setPeriodo(clavePeriodo(p))}
      />
      <ModalPagar
        solicitudes={aPagar}
        saldoCaja={saldoCaja}
        onCerrar={() => setAPagar(null)}
        onPagadas={() => setSeleccion(new Set())}
      />
      <ModalRechazar solicitud={aRechazar} onCerrar={() => setARechazar(null)} />
      <ModalRevertir solicitud={aRevertir} onCerrar={() => setARevertir(null)} />
      <ModalEditarMonto solicitud={aEditar} onCerrar={() => setAEditar(null)} />
    </div>
  )
}

// --- Generar nómina -------------------------------------------------------------

function ModalGenerarNomina({
  abierto,
  periodoInicial,
  onCerrar,
  onGenerada,
}: {
  abierto: boolean
  periodoInicial: PeriodoQuincena
  onCerrar: () => void
  onGenerada: (periodo: PeriodoQuincena) => void
}) {
  const generar = useGenerarNomina()
  const [periodo, setPeriodo] = useState(periodoInicial)
  const [resultado, setResultado] = useState<ResultadoGenerarNomina | null>(null)
  const [error, setError] = useState('')
  const { inicio, fin } = periodoQuincena(periodo.anio, periodo.mes, periodo.quincena)

  function cerrar() {
    setResultado(null)
    setError('')
    onCerrar()
  }

  async function alGenerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')
    try {
      setResultado(await generar.mutateAsync(periodo))
      onGenerada(periodo)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo generar la nómina. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Generar nómina" abierto={abierto} onCerrar={cerrar}>
      {resultado ? (
        <div className="form">
          <p className="successMessage" role="status">
            {resultado.creadas.length === 1
              ? 'Se creó 1 solicitud pendiente.'
              : `Se crearon ${resultado.creadas.length} solicitudes pendientes.`}
          </p>
          {resultado.omitidas.length > 0 && (
            <>
              <h3 className="subtitle">{`Se omitieron ${resultado.omitidas.length}`}</h3>
              <ul className={styles.skippedList}>
                {resultado.omitidas.map((o) => (
                  <li key={o.empleado}>
                    <strong>{o.empleado_nombre}</strong> — {o.motivo}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="formActions">
            <BotonPrimario onClick={cerrar}>Cerrar</BotonPrimario>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={alGenerar} noValidate>
          <p className="confirmText">
            Se creará una solicitud pendiente por cada empleado activo con posición vigente, por la mitad de su salario
            mensual asignado. Los importes se pueden ajustar antes de pagar.
          </p>
          <div className="formGrid">
            <label className="field">
              Mes
              <select value={periodo.mes} onChange={(e) => setPeriodo((p) => ({ ...p, mes: Number(e.target.value) }))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                  <option key={mes} value={mes}>
                    {nombreMes(mes)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Año
              <input
                type="number"
                min={2000}
                max={2100}
                value={periodo.anio}
                onChange={(e) => setPeriodo((p) => ({ ...p, anio: Number(e.target.value) }))}
              />
            </label>
            <label className="field formGridFull">
              Quincena
              <select
                value={periodo.quincena}
                onChange={(e) => setPeriodo((p) => ({ ...p, quincena: Number(e.target.value) as Quincena }))}
              >
                <option value={1}>1.ª quincena (del 1 al 15)</option>
                <option value={2}>2.ª quincena (del 16 al fin de mes)</option>
              </select>
            </label>
          </div>
          <p className="fieldHint">{`Periodo: ${textoPeriodo({ periodo_inicio: inicio, periodo_fin: fin })}`}</p>
          {error && (
            <p className="errorMessage" role="alert">
              {error}
            </p>
          )}
          <div className="formActions">
            <BotonPrimario type="button" variante="secundario" onClick={cerrar}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={generar.isPending}>
              {generar.isPending ? 'Generando…' : 'Generar'}
            </BotonPrimario>
          </div>
        </form>
      )}
    </Modal>
  )
}

// --- Aprobar y pagar (una o varias) ----------------------------------------------------

function ModalPagar({
  solicitudes,
  saldoCaja,
  onCerrar,
  onPagadas,
}: {
  solicitudes: SolicitudNomina[] | null
  saldoCaja: number | null
  onCerrar: () => void
  onPagadas: () => void
}) {
  const aprobar = useAprobarSolicitudNomina()
  const pagarLote = usePagarSolicitudesNomina()
  const [error, setError] = useState('')
  const enProceso = aprobar.isPending || pagarLote.isPending

  if (!solicitudes) return null
  const total = sumar(solicitudes)
  const unica = solicitudes.length === 1 ? solicitudes[0] : undefined
  const saldoDespues = saldoCaja === null ? null : saldoCaja - total

  function cerrar() {
    setError('')
    onCerrar()
  }

  async function confirmar() {
    if (!solicitudes) return
    setError('')
    try {
      if (unica) await aprobar.mutateAsync(unica.id)
      else await pagarLote.mutateAsync(solicitudes.map((s) => s.id))
      onPagadas()
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo registrar el pago. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo={unica ? 'Aprobar y pagar nómina' : 'Aprobar y pagar nóminas'} abierto onCerrar={cerrar}>
      <div className="form">
        <dl className="factGrid">
          {unica ? (
            <>
              <div>
                <dt>Empleado</dt>
                <dd>{unica.empleado_nombre}</dd>
              </div>
              <div>
                <dt>Periodo</dt>
                <dd>{textoPeriodo(unica)}</dd>
              </div>
            </>
          ) : (
            <div>
              <dt>Solicitudes</dt>
              <dd>{solicitudes.length}</dd>
            </div>
          )}
          <div>
            <dt>{unica ? 'Monto' : 'Total'}</dt>
            <dd>{formatearMoneda(total)}</dd>
          </div>
          <div>
            <dt>Saldo de caja disponible</dt>
            <dd>{saldoCaja === null ? '—' : formatearMoneda(saldoCaja)}</dd>
          </div>
          <div>
            <dt>Saldo después del pago</dt>
            <dd>{saldoDespues === null ? '—' : formatearSaldo(saldoDespues)}</dd>
          </div>
        </dl>
        <p className="confirmText">
          {unica
            ? 'Se registrará un retiro de caja por este monto (motivo "Nómina") y la solicitud quedará pagada.'
            : 'Se registrará un retiro de caja por cada solicitud (motivo "Nómina"). Si el saldo no alcanza para el total, no se pagará ninguna.'}
        </p>
        {saldoDespues !== null && saldoDespues < 0 && (
          <p className="fieldWarning">El pago supera el saldo disponible; el sistema lo rechazará.</p>
        )}
        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={cerrar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmar} disabled={enProceso}>
            {enProceso ? 'Pagando…' : 'Confirmar pago'}
          </BotonPrimario>
        </div>
      </div>
    </Modal>
  )
}

// --- Rechazar, revertir, editar monto ----------------------------------------------------

function ModalRechazar({ solicitud, onCerrar }: { solicitud: SolicitudNomina | null; onCerrar: () => void }) {
  const rechazar = useRechazarSolicitudNomina()
  const [error, setError] = useState('')
  if (!solicitud) return null

  function cerrar() {
    setError('')
    onCerrar()
  }

  async function confirmar() {
    if (!solicitud) return
    try {
      await rechazar.mutateAsync(solicitud.id)
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo rechazar la solicitud. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Rechazar nómina" abierto onCerrar={cerrar}>
      <p className="confirmText">
        ¿Confirmas que quieres rechazar la nómina de {solicitud.empleado_nombre} ({textoPeriodo(solicitud)}) por{' '}
        {formatearMoneda(solicitud.monto)}? No se registrará ningún movimiento de caja.
      </p>
      {error && (
        <p className="errorMessage" role="alert">
          {error}
        </p>
      )}
      <div className="formActions">
        <BotonPrimario variante="secundario" onClick={cerrar}>
          Cancelar
        </BotonPrimario>
        <BotonPrimario variante="peligro" onClick={confirmar} disabled={rechazar.isPending}>
          {rechazar.isPending ? 'Rechazando…' : 'Rechazar'}
        </BotonPrimario>
      </div>
    </Modal>
  )
}

function ModalRevertir({ solicitud, onCerrar }: { solicitud: SolicitudNomina | null; onCerrar: () => void }) {
  const revertir = useRevertirPagoNomina()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  if (!solicitud) return null

  function cerrar() {
    setMotivo('')
    setError('')
    onCerrar()
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!solicitud) return
    if (!motivo.trim()) {
      setError('Indica el motivo del reverso.')
      return
    }
    try {
      await revertir.mutateAsync({ id: solicitud.id, motivo: motivo.trim() })
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo revertir el pago. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Revertir pago de nómina" abierto onCerrar={cerrar}>
      <form className="form" onSubmit={confirmar} noValidate>
        <p className="confirmText">
          Se registrará en caja un ingreso por {formatearMoneda(solicitud.monto)} que compensa el pago de la nómina de{' '}
          {solicitud.empleado_nombre} ({textoPeriodo(solicitud)}). El retiro original se conserva en el historial.
        </p>
        <label className="field">
          Motivo del reverso
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} required />
        </label>
        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}
        <div className="formActions">
          <BotonPrimario type="button" variante="secundario" onClick={cerrar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" variante="peligro" disabled={revertir.isPending}>
            {revertir.isPending ? 'Revirtiendo…' : 'Revertir pago'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}

function ModalEditarMonto({ solicitud, onCerrar }: { solicitud: SolicitudNomina | null; onCerrar: () => void }) {
  const editar = useEditarMontoNomina()
  const [monto, setMonto] = useState<string | null>(null)
  const [error, setError] = useState('')
  if (!solicitud) return null
  const valor = monto ?? solicitud.monto

  function cerrar() {
    setMonto(null)
    setError('')
    onCerrar()
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!solicitud) return
    if (!(Number(valor) > 0)) {
      setError('El monto debe ser mayor que cero.')
      return
    }
    try {
      await editar.mutateAsync({ id: solicitud.id, monto: valor })
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar el monto. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Editar monto de nómina" abierto onCerrar={cerrar}>
      <form className="form" onSubmit={guardar} noValidate>
        <p className="confirmText">
          {solicitud.empleado_nombre} · {textoPeriodo(solicitud)}
        </p>
        <label className="field">
          Monto a pagar
          <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setMonto(e.target.value)} />
        </label>
        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}
        <div className="formActions">
          <BotonPrimario type="button" variante="secundario" onClick={cerrar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" disabled={editar.isPending}>
            {editar.isPending ? 'Guardando…' : 'Guardar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}
