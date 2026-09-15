import { useState } from 'react'

import logoFlebosil from '../../assets/flebosil_transparentbg/logo_flebosil_magentafont.png'
import type { PeriodoDashboard } from '../../api/reportes'
import { formatearMoneda } from './formato'
import { useSaldoCaja } from '../../hooks/useMovimientosCaja'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { SeccionClientes } from './SeccionClientes'
import { SeccionCompras } from './SeccionCompras'
import { SeccionFacturacion } from './SeccionFacturacion'
import { SeccionGanancias } from './SeccionGanancias'
import { SeccionProductos } from './SeccionProductos'
import { SeccionVentas } from './SeccionVentas'
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
    <div className={styles.saldo}>
      <span className={styles.saldoEtiqueta}>Saldo actual de la caja</span>
      <span className={styles.saldoMonto}>
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
    <div className={styles.pagina}>
      <header className={styles.encabezado}>
        <img src={logoFlebosil} alt="FleboSil" className={styles.logo} />

        {esAdmin && <SaldoCajaAdmin />}

        <div className={styles.pestañas} role="tablist" aria-label="Periodo">
          {pestañasDisponibles.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={periodo === p.clave}
              className={periodo === p.clave ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
              onClick={() => setPeriodo(p.clave)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </header>

      <SeccionGanancias periodo={periodo} />
      <SeccionVentas periodo={periodo} />
      <SeccionCompras periodo={periodo} />
      <SeccionProductos periodo={periodo} />
      <SeccionClientes periodo={periodo} />
      <SeccionFacturacion />
    </div>
  )
}
