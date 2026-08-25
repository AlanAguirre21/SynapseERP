import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import type {
  MotivoMovimientoCaja,
  MovimientoCaja as MovimientoCajaApi,
  MovimientoCajaFormulario,
  TipoMovimientoCaja,
} from '../../api/caja'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useCrearMovimientoCaja, useMovimientosCaja, useSaldoCaja } from '../../hooks/useMovimientosCaja'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
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
}

function formatearMoneda(valor: string) {
  return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

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

  const { data: movimientos, isLoading } = useMovimientosCaja({
    tipo_movimiento: tipoFiltro || undefined,
    motivo: motivoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const [formularioAbierto, setFormularioAbierto] = useState(false)

  const columnas: ColumnaTabla<MovimientoCajaApi>[] = [
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => new Date(fila.fecha).toLocaleString('es-MX') },
    {
      clave: 'tipo_movimiento',
      encabezado: 'Tipo',
      render: (fila) => (
        <span className={fila.tipo_movimiento === 'ingreso' ? styles.badgeIngreso : styles.badgeRetiro}>
          {ETIQUETAS_TIPO[fila.tipo_movimiento]}
        </span>
      ),
    },
    { clave: 'monto', encabezado: 'Monto', render: (fila) => formatearMoneda(fila.monto) },
    {
      clave: 'motivo',
      encabezado: 'Motivo',
      render: (fila) => (
        <div>
          <span className={styles.badgeMotivo}>{ETIQUETAS_MOTIVO[fila.motivo]}</span>
          {fila.motivo === 'venta' && fila.referencia_id && (
            <Link to={`/ventas/${fila.referencia_id}`} className={styles.enlaceReferencia}>
              Ver venta #{fila.referencia_id}
            </Link>
          )}
        </div>
      ),
    },
    { clave: 'observacion', encabezado: 'Descripción' },
    { clave: 'usuario_nombre', encabezado: 'Usuario' },
    {
      clave: 'saldo_resultante',
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

      <div className={styles.saldo}>
        <span className={styles.saldoEtiqueta}>Saldo actual de caja</span>
        <span className={styles.saldoMonto}>{saldoCargando || saldo === undefined ? '…' : formatearMoneda(saldo)}</span>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
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

        <label className={styles.campoFiltro}>
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

        <label className={styles.campoFiltro}>
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

        <label className={styles.campoFiltro}>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
      </div>

      {isLoading ? (
        <p>Cargando movimientos…</p>
      ) : (
        <Tabla columnas={columnas} datos={movimientos ?? []} mensajeVacio="Todavía no hay movimientos de caja registrados." />
      )}

      <NuevoMovimientoModal abierto={formularioAbierto} onCerrar={() => setFormularioAbierto(false)} />
    </div>
  )
}

function NuevoMovimientoModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const crear = useCrearMovimientoCaja()

  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoCaja>('ingreso')
  const [monto, setMonto] = useState('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState('')

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

    const montoNumerico = Number(monto)
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
      <form className={styles.formulario} onSubmit={alGuardar} noValidate>
        <label className={styles.campo}>
          Tipo de movimiento
          <select value={tipoMovimiento} onChange={(e) => setTipoMovimiento(e.target.value as TipoMovimientoCaja)}>
            <option value="ingreso">Ingreso</option>
            <option value="retiro">Retiro</option>
          </select>
        </label>

        <label className={styles.campo}>
          Monto
          <input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>

        <label className={styles.campo}>
          Descripción (motivo del movimiento)
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.accionesFormulario}>
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
