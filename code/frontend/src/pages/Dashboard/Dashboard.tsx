import { useState } from 'react'
import { Link } from 'react-router-dom'

import logoSynapse from '../../assets/synapse_img/synapseErp_logo_transparent.png'
import type { UltimaEjecucionResumen } from '../../api/auditoria'
import type { PeriodoDashboard } from '../../api/reportes'
import { formatearMoneda } from './compartido/formato'
import { useResumenAuditoria } from '../../hooks/useAuditoria'
import { useSaldoCaja } from '../../hooks/useMovimientosCaja'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { SeccionClientes } from './secciones/SeccionClientes/SeccionClientes'
import { SeccionCompras } from './secciones/SeccionCompras/SeccionCompras'
import { SeccionFacturacion } from './secciones/SeccionFacturacion/SeccionFacturacion'
import { SeccionGanancias } from './secciones/SeccionGanancias/SeccionGanancias'
import { SeccionProductos } from './secciones/SeccionProductos/SeccionProductos'
import { SeccionVentas } from './secciones/SeccionVentas/SeccionVentas'
import styles from './Dashboard.module.css'

const ETIQUETAS_PERIODO: { clave: PeriodoDashboard; etiqueta: string }[] = [
  { clave: 'dia', etiqueta: 'Día' },
  { clave: 'semana', etiqueta: 'Semana' },
  { clave: 'mes', etiqueta: 'Mes' },
  { clave: 'año', etiqueta: 'Año' },
]

function SaldoCajaAdmin() {
  const { data: saldos, isLoading } = useSaldoCaja()

  return (
    <div className={styles.cashBalance}>
      <span className={styles.cashBalanceLabel}>Saldo actual de la caja</span>
      <span className={styles.cashBalanceAmount}>
        {isLoading || !saldos ? '…' : formatearMoneda(saldos.saldo_actual)}
      </span>
    </div>
  )
}

// 022 · Auditoría automatizada: estado de la última ejecución de cada tipo.
function UltimaAuditoria() {
  const { data: resumen, isLoading } = useResumenAuditoria()

  function tarjeta(etiqueta: string, ultima: UltimaEjecucionResumen | null | undefined) {
    const abiertas = ultima?.discrepancias_abiertas ?? 0
    const clase = ultima?.estado === 'fallida' ? 'statTile statTileDanger' : abiertas > 0 ? 'statTile statTileWarning' : 'statTile'
    return (
      <Link to="/auditoria-analisis?pestana=ejecuciones" className={clase}>
        <span className="statLabel">{etiqueta}</span>
        <span className="statValue">
          {isLoading ? '…' : !ultima ? 'Sin ejecuciones' : ultima.estado === 'fallida' ? 'Falló' : `${abiertas} abierta(s)`}
        </span>
        {ultima && (
          <span className="pageHint">
            {new Date(ultima.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        )}
      </Link>
    )
  }

  return (
    <section aria-label="Última auditoría">
      <h2 className="sectionTitle">Última auditoría</h2>
      <div className="statRow">
        {tarjeta('Conciliación de caja', resumen?.ultima_caja)}
        {tarjeta('Auditoría de inventario', resumen?.ultima_inventario)}
      </div>
    </section>
  )
}

export function Dashboard() {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('dia')
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  // El operador solo puede consultar el periodo "Día" — no se deshabilitan
  // las demás pestañas, se omiten del DOM para que la restricción no
  // dependa únicamente de ocultamiento visual.
  const pestañasDisponibles = esAdmin ? ETIQUETAS_PERIODO : ETIQUETAS_PERIODO.filter((p) => p.clave === 'dia')

  return (
    <div className="page">
      <header className={styles.hero}>
        <img src={logoSynapse} alt="SynapseERP" className={styles.dashboardLogo} />

        {esAdmin && <SaldoCajaAdmin />}

        <div className={styles.periodTabs} role="tablist" aria-label="Periodo">
          {pestañasDisponibles.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={periodo === p.clave}
              className={periodo === p.clave ? `${styles.periodTab} ${styles.periodTabActive}` : styles.periodTab}
              onClick={() => setPeriodo(p.clave)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {!esAdmin && <p className="pageHint">Cifras de tus propias ventas, compras y facturas.</p>}
      </header>

      {/* Ganancia y movimientos de caja: solo admin (el backend tampoco se los da al operador). */}
      {esAdmin && <SeccionGanancias periodo={periodo} />}
      {esAdmin && <UltimaAuditoria />}
      <SeccionVentas periodo={periodo} esAdmin={esAdmin} />
      <SeccionCompras periodo={periodo} />
      <SeccionProductos periodo={periodo} />
      <SeccionClientes periodo={periodo} />
      <SeccionFacturacion periodo={periodo} />
    </div>
  )
}
