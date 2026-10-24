import { useState } from 'react'

<<<<<<< HEAD
import logoSynapse from '../../assets/synapse_img/synapseErp_logo_transparent.png'
=======
import logoFlebosil from '../../assets/flebosil_transparentbg/logo_flebosil_magentafont.png'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import type { PeriodoDashboard } from '../../api/reportes'
import { formatearMoneda } from './compartido/formato'
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
<<<<<<< HEAD
    <div className={styles.saldo}>
      <span className={styles.saldoEtiqueta}>Saldo actual de la caja</span>
      <span className={styles.saldoMonto}>
=======
    <div className={styles.cashBalance}>
      <span className={styles.cashBalanceLabel}>Saldo actual de la caja</span>
      <span className={styles.cashBalanceAmount}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        {isLoading || !saldos ? '…' : formatearMoneda(saldos.saldo_actual)}
      </span>
    </div>
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
<<<<<<< HEAD
    <div className={styles.pagina}>
      <header className={styles.encabezado}>
        <img src={logoSynapse} alt="SynapseERP" className={styles.logo} />

        {esAdmin && <SaldoCajaAdmin />}

        <div className={styles.pestañas} role="tablist" aria-label="Periodo">
=======
    <div className="page">
      <header className={styles.hero}>
        <img src={logoFlebosil} alt="FleboSil" className={styles.dashboardLogo} />

        {esAdmin && <SaldoCajaAdmin />}

        <div className={styles.periodTabs} role="tablist" aria-label="Periodo">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          {pestañasDisponibles.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={periodo === p.clave}
<<<<<<< HEAD
              className={periodo === p.clave ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
=======
              className={periodo === p.clave ? `${styles.periodTab} ${styles.periodTabActive}` : styles.periodTab}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              onClick={() => setPeriodo(p.clave)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
<<<<<<< HEAD
      </header>

      <SeccionGanancias periodo={periodo} />
=======

        {!esAdmin && <p className="pageHint">Cifras de tus propias ventas, compras y facturas.</p>}
      </header>

      {/* Ganancia y movimientos de caja: solo admin (el backend tampoco se los da al operador). */}
      {esAdmin && <SeccionGanancias periodo={periodo} />}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      <SeccionVentas periodo={periodo} />
      <SeccionCompras periodo={periodo} />
      <SeccionProductos periodo={periodo} />
      <SeccionClientes periodo={periodo} />
<<<<<<< HEAD
      <SeccionFacturacion />
=======
      <SeccionFacturacion periodo={periodo} />
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    </div>
  )
}
