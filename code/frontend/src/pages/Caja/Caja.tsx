<<<<<<< HEAD
import { useState, type FormEvent } from 'react'
=======
import { useMemo, useState, type FormEvent } from 'react'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import { Link, Navigate } from 'react-router-dom'

import type {
  MotivoMovimientoCaja,
  MovimientoCaja as MovimientoCajaApi,
  MovimientoCajaFormulario,
<<<<<<< HEAD
=======
  SaldosCaja,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  TipoMovimientoCaja,
} from '../../api/caja'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useCrearMovimientoCaja, useMovimientosCaja, useSaldoCaja } from '../../hooks/useMovimientosCaja'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
<<<<<<< HEAD
=======
import { formatearMoneda } from '../../utils/moneda'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import styles from './Caja.module.css'

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

const ETIQUETAS_TIPO: Record<TipoMovimientoCaja, string> = {
  ingreso: 'Ingreso',
  retiro: 'Retiro',
}

const ETIQUETAS_MOTIVO: Record<MotivoMovimientoCaja, string> = {
  venta: 'Venta',
  ajuste: 'Ajuste',
  manual: 'Manual',
  compra: 'Compra',
  envio: 'Envío',
<<<<<<< HEAD
}

function formatearMoneda(valor: string) {
  return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

=======
  nomina: 'Nómina',
}

// Monto con signo, como en un libro de caja: "+$45.00" entra, "−$2,000.00"
// sale (signo menos tipográfico, no guion).
function montoConSigno(movimiento: MovimientoCajaApi): string {
  return `${movimiento.tipo_movimiento === 'ingreso' ? '+' : '−'}${formatearMoneda(movimiento.monto)}`
}

// Flujo neto del periodo: con signo explícito también cuando es positivo.
function formatearFlujo(valor: number): string {
  if (valor > 0) return `+${formatearMoneda(valor)}`
  if (valor < 0) return `−${formatearMoneda(-valor)}`
  return formatearMoneda(0)
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

type LimiteMovimientos = '5' | '10' | 'todos'

const ETIQUETAS_LIMITE: Record<LimiteMovimientos, string> = { '5': '5', '10': '10', todos: 'Todos' }

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
export function Caja() {
  const { data: usuario, isLoading: usuarioCargando } = useUsuarioActual()

  // Caja es exclusiva de admin: la barra lateral ya oculta el enlace para
  // operador, pero esto bloquea también el acceso directo por URL — el
  // backend rechaza los endpoints igual, esto es solo para no mostrar la
  // pantalla ni de forma transitoria.
  if (usuarioCargando) {
    return <p>Cargando…</p>
  }

  if (usuario?.rol !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <CajaContenido />
}

function CajaContenido() {
  const { data: saldo, isLoading: saldoCargando } = useSaldoCaja()

  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimientoCaja | ''>('')
  const [motivoFiltro, setMotivoFiltro] = useState<MotivoMovimientoCaja | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
<<<<<<< HEAD
=======
  const [limite, setLimite] = useState<LimiteMovimientos>('10')
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

  const { data: movimientos, isLoading } = useMovimientosCaja({
    tipo_movimiento: tipoFiltro || undefined,
    motivo: motivoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const [formularioAbierto, setFormularioAbierto] = useState(false)

<<<<<<< HEAD
  const columnas: ColumnaTabla<MovimientoCajaApi>[] = [
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => new Date(fila.fecha).toLocaleString('es-MX') },
=======
  const hayFiltros = Boolean(tipoFiltro || motivoFiltro || fechaDesde || fechaHasta)

  function limpiarFiltros() {
    setTipoFiltro('')
    setMotivoFiltro('')
    setFechaDesde('')
    setFechaHasta('')
  }

  // Resumen del periodo sobre la lista ya filtrada por el backend.
  const periodo = useMemo(() => {
    const lista = movimientos ?? []
    const suma = (tipo: TipoMovimientoCaja) =>
      lista.filter((m) => m.tipo_movimiento === tipo).reduce((total, m) => total + Number(m.monto), 0)
    const ingresos = suma('ingreso')
    const retiros = suma('retiro')
    return { movimientos: lista.length, ingresos, retiros, flujo: ingresos - retiros }
  }, [movimientos])

  const lista = movimientos ?? []
  // La API ya los entrega del más reciente al más antiguo; el límite solo recorta en pantalla.
  const visibles = limite === 'todos' ? lista : lista.slice(0, Number(limite))

  const columnas: ColumnaTabla<MovimientoCajaApi>[] = [
    {
      clave: 'fecha',
      encabezado: 'Fecha',
      render: (fila) => <span className="cellNoWrap">{formatearFecha(fila.fecha)}</span>,
    },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    {
      clave: 'tipo_movimiento',
      encabezado: 'Tipo',
      render: (fila) => (
<<<<<<< HEAD
        <span className={fila.tipo_movimiento === 'ingreso' ? styles.badgeIngreso : styles.badgeRetiro}>
=======
        <span className={fila.tipo_movimiento === 'ingreso' ? 'status statusSuccess' : 'status statusNeutral'}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          {ETIQUETAS_TIPO[fila.tipo_movimiento]}
        </span>
      ),
    },
<<<<<<< HEAD
    { clave: 'monto', encabezado: 'Monto', render: (fila) => formatearMoneda(fila.monto) },
=======
    {
      clave: 'monto',
      alineacion: 'derecha',
      encabezado: 'Monto',
      render: (fila) => <span className="cellNoWrap">{montoConSigno(fila)}</span>,
    },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    {
      clave: 'motivo',
      encabezado: 'Motivo',
      render: (fila) => (
<<<<<<< HEAD
        <div>
          <span className={styles.badgeMotivo}>{ETIQUETAS_MOTIVO[fila.motivo]}</span>
          {fila.motivo === 'venta' && fila.referencia_id && (
            <Link to={`/ventas/${fila.referencia_id}`} className={styles.enlaceReferencia}>
=======
        <div className={styles.reasonCell}>
          <span className="status statusNeutral">{ETIQUETAS_MOTIVO[fila.motivo]}</span>
          {fila.motivo === 'venta' && fila.referencia_id && (
            <Link to={`/ventas/${fila.referencia_id}`} className={styles.referenceLink}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              Ver venta #{fila.referencia_id}
            </Link>
          )}
          {fila.motivo === 'compra' && fila.referencia_id && (
<<<<<<< HEAD
            <Link to={`/compras/${fila.referencia_id}`} className={styles.enlaceReferencia}>
              Ver compra #{fila.referencia_id}
            </Link>
          )}
=======
            <Link to={`/compras/${fila.referencia_id}`} className={styles.referenceLink}>
              Ver compra #{fila.referencia_id}
            </Link>
          )}
          {fila.motivo === 'nomina' && fila.referencia_id && (
            <Link to="/rrhh?pestana=nominas" className={styles.referenceLink}>
              Ver nómina #{fila.referencia_id}
            </Link>
          )}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        </div>
      ),
    },
    { clave: 'observacion', encabezado: 'Descripción' },
    { clave: 'usuario_nombre', encabezado: 'Usuario' },
    {
      clave: 'saldo_resultante',
<<<<<<< HEAD
      encabezado: 'Saldo resultante',
      render: (fila) => <span className={styles.saldoResultante}>{formatearMoneda(fila.saldo_resultante)}</span>,
    },
  ]

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Caja</h1>
        <BotonPrimario onClick={() => setFormularioAbierto(true)}>Registrar movimiento</BotonPrimario>
      </div>

      <div className={styles.saldosFila}>
        <div className={`${styles.tarjetaSaldo} ${styles.saldoActual}`}>
          <span className={styles.saldoEtiqueta}>Saldo actual de la caja</span>
          <span className={styles.saldoMonto}>
            {saldoCargando || !saldo ? '…' : formatearMoneda(saldo.saldo_actual)}
          </span>
        </div>

        <span className={styles.operador} aria-hidden="true">+</span>

        <div className={`${styles.tarjetaSaldo} ${styles.saldoAdicional}`}>
          <span className={styles.saldoEtiqueta}>Saldo adicional (Costo de envíos)</span>
          <span className={styles.saldoMonto}>
            {saldoCargando || !saldo ? '…' : formatearMoneda(saldo.saldo_adicional)}
          </span>
        </div>

        <span className={styles.operador} aria-hidden="true">=</span>

        <div className={`${styles.tarjetaSaldo} ${styles.saldoTotal}`}>
          <span className={styles.saldoEtiqueta}>Saldo de la caja</span>
          <span className={styles.saldoMonto}>
            {saldoCargando || !saldo ? '…' : formatearMoneda(saldo.saldo_total)}
          </span>
        </div>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
=======
      alineacion: 'derecha',
      encabezado: 'Saldo resultante',
      render: (fila) => <span className={styles.resultingBalance}>{formatearMoneda(fila.saldo_resultante)}</span>,
    },
  ]

  const cifraSaldo = (valor: keyof SaldosCaja) => (saldoCargando || !saldo ? '…' : formatearMoneda(saldo[valor]))
  const cifraPeriodo = (texto: string | number) => (movimientos ? texto : '…')

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Caja</h1>
          <p className="pageHint">Consulta el efectivo disponible y registra ingresos y retiros manuales.</p>
        </div>
        <BotonPrimario onClick={() => setFormularioAbierto(true)}>Registrar movimiento</BotonPrimario>
      </div>

      <section className={styles.balancePanel} aria-label="Saldo de la caja">
        <div className={styles.balanceMain}>
          <span className={styles.balanceLabel}>Saldo de la caja</span>
          <span className={styles.balanceFigure}>{cifraSaldo('saldo_total')}</span>
          <p className={styles.balanceHint}>Efectivo disponible, incluido el dinero de envíos todavía no entregado.</p>
        </div>

        <div className={styles.balanceBreakdown}>
          <div className={styles.balanceItem}>
            <span>Saldo actual de la caja</span>
            <span className={styles.balanceItemAmount}>{cifraSaldo('saldo_actual')}</span>
          </div>
          <div className={styles.balanceItem}>
            <span>Saldo adicional (Costo de envíos)</span>
            <span className={styles.balanceItemAmount}>{cifraSaldo('saldo_adicional')}</span>
          </div>
        </div>
      </section>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Movimientos</span>
          <span className="statValue">{cifraPeriodo(periodo.movimientos)}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Ingresos</span>
          <span className="statValue">{cifraPeriodo(formatearMoneda(periodo.ingresos))}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Retiros</span>
          <span className="statValue">{cifraPeriodo(formatearMoneda(periodo.retiros))}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Flujo neto</span>
          <span className="statValue">{cifraPeriodo(formatearFlujo(periodo.flujo))}</span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Tipo
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as TipoMovimientoCaja | '')}
          >
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_TIPO) as TipoMovimientoCaja[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETAS_TIPO[tipo]}
              </option>
            ))}
          </select>
        </label>

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
=======
        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Motivo
          <select
            value={motivoFiltro}
            onChange={(e) => setMotivoFiltro(e.target.value as MotivoMovimientoCaja | '')}
          >
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_MOTIVO) as MotivoMovimientoCaja[]).map((motivo) => (
              <option key={motivo} value={motivo}>
                {ETIQUETAS_MOTIVO[motivo]}
              </option>
            ))}
          </select>
        </label>

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
=======
        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
=======
        <label className="filterField">
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="sectionHeader">
        <span className="pageHint">{movimientos ? `Mostrando ${visibles.length} de ${lista.length}` : ''}</span>
        <div className="segmented" role="group" aria-label="Cantidad de movimientos a mostrar">
          {(['5', '10', 'todos'] as LimiteMovimientos[]).map((valor) => (
            <button
              key={valor}
              type="button"
              className={limite === valor ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
              aria-pressed={limite === valor}
              onClick={() => setLimite(valor)}
            >
              {ETIQUETAS_LIMITE[valor]}
            </button>
          ))}
        </div>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      </div>

      {isLoading ? (
        <p>Cargando movimientos…</p>
      ) : (
<<<<<<< HEAD
        <Tabla columnas={columnas} datos={movimientos ?? []} mensajeVacio="Todavía no hay movimientos de caja registrados." />
      )}

      <NuevoMovimientoModal abierto={formularioAbierto} onCerrar={() => setFormularioAbierto(false)} />
=======
        <Tabla
          columnas={columnas}
          datos={visibles}
          mensajeVacio={
            hayFiltros
              ? 'Ningún movimiento coincide con los filtros.'
              : 'Todavía no hay movimientos de caja registrados.'
          }
        />
      )}

      <NuevoMovimientoModal
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        saldoDisponible={saldo ? Number(saldo.saldo_total) : null}
      />
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    </div>
  )
}

<<<<<<< HEAD
function NuevoMovimientoModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
=======
function NuevoMovimientoModal({
  abierto,
  onCerrar,
  saldoDisponible,
}: {
  abierto: boolean
  onCerrar: () => void
  saldoDisponible: number | null
}) {
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const crear = useCrearMovimientoCaja()

  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoCaja>('ingreso')
  const [monto, setMonto] = useState('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState('')

<<<<<<< HEAD
=======
  // Vista previa: el backend recalcula y decide al guardar.
  const montoNumerico = Number(monto) || 0
  const saldoDespues =
    saldoDisponible === null
      ? null
      : tipoMovimiento === 'ingreso'
        ? saldoDisponible + montoNumerico
        : saldoDisponible - montoNumerico
  const sobregiro = tipoMovimiento === 'retiro' && saldoDespues !== null && saldoDespues < 0

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  function cerrarYLimpiar() {
    setTipoMovimiento('ingreso')
    setMonto('')
    setObservacion('')
    setError('')
    onCerrar()
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError('')

<<<<<<< HEAD
    const montoNumerico = Number(monto)
=======
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    if (!monto || montoNumerico <= 0) {
      setError('Ingresa un monto mayor a cero.')
      return
    }
    if (!observacion.trim()) {
      setError('La descripción es obligatoria.')
      return
    }

    const datos: MovimientoCajaFormulario = { tipo_movimiento: tipoMovimiento, monto, observacion }

    try {
      await crear.mutateAsync(datos)
      cerrarYLimpiar()
    } catch (err) {
      // No se limpia el formulario en caso de error (ej. saldo insuficiente
      // en un retiro) — el admin debe corregir el monto antes de reintentar,
      // no simplemente repetir la misma petición.
      setError(extraerMensajeError(err, 'No se pudo registrar el movimiento. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Registrar movimiento de caja" abierto={abierto} onCerrar={cerrarYLimpiar}>
<<<<<<< HEAD
      <form className={styles.formulario} onSubmit={alGuardar} noValidate>
        <label className={styles.campo}>
=======
      <form className="form" onSubmit={alGuardar} noValidate>
        <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Tipo de movimiento
          <select value={tipoMovimiento} onChange={(e) => setTipoMovimiento(e.target.value as TipoMovimientoCaja)}>
            <option value="ingreso">Ingreso</option>
            <option value="retiro">Retiro</option>
          </select>
        </label>

<<<<<<< HEAD
        <label className={styles.campo}>
=======
        <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Monto
          <input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>

<<<<<<< HEAD
        <label className={styles.campo}>
=======
        {saldoDisponible !== null && saldoDespues !== null && (
          <div className="summary">
            <div className="summaryRow">
              <span>Saldo disponible</span>
              <span data-testid="saldo-disponible">{formatearMoneda(saldoDisponible)}</span>
            </div>
            <div className="summaryRow">
              <span>Saldo después del movimiento</span>
              <span data-testid="saldo-despues">{formatearFlujoSaldo(saldoDespues)}</span>
            </div>
          </div>
        )}

        {/* Sin role="alert": solo anticipa el rechazo; el error real lo da el backend. */}
        {sobregiro && (
          <p className="fieldWarning">El retiro supera el saldo disponible; el sistema lo rechazará.</p>
        )}

        <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Descripción (motivo del movimiento)
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </label>

        {error && (
<<<<<<< HEAD
          <p className={styles.error} role="alert">
=======
          <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            {error}
          </p>
        )}

<<<<<<< HEAD
        <div className={styles.accionesFormulario}>
=======
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <BotonPrimario type="button" variante="secundario" onClick={cerrarYLimpiar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}
<<<<<<< HEAD
=======

// Un saldo resultante negativo (sobregiro) se muestra con signo menos.
function formatearFlujoSaldo(valor: number): string {
  return valor < 0 ? `−${formatearMoneda(-valor)}` : formatearMoneda(valor)
}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
