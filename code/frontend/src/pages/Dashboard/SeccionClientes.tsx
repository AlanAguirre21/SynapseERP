import { useState } from 'react'

import type { OrdenTop, PeriodoDashboard } from '../../api/reportes'
import { formatearMoneda } from './formato'
import { GraficaBarras } from './GraficaBarras'
import { useClientesTop } from '../../hooks/useClientesTop'
import styles from './SeccionTop.module.css'

interface SeccionClientesProps {
  periodo: PeriodoDashboard
}

export function SeccionClientes({ periodo }: SeccionClientesProps) {
  const [orden, setOrden] = useState<OrdenTop>('mas')
  const { data: clientes, isLoading } = useClientesTop(periodo, orden)

  const datos = (clientes ?? []).map((cliente) => ({ etiqueta: cliente.cliente, valor: Number(cliente.monto) }))

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.tituloSeccion}>Resumen clientes</h2>
        <div className={styles.selectorOrden} role="group" aria-label="Orden del ranking de clientes">
          <button
            type="button"
            className={orden === 'mas' ? `${styles.opcionOrden} ${styles.opcionOrdenActiva}` : styles.opcionOrden}
            aria-pressed={orden === 'mas'}
            onClick={() => setOrden('mas')}
          >
            Más compras
          </button>
          <button
            type="button"
            className={orden === 'menos' ? `${styles.opcionOrden} ${styles.opcionOrdenActiva}` : styles.opcionOrden}
            aria-pressed={orden === 'menos'}
            onClick={() => setOrden('menos')}
          >
            Menos compras
          </button>
        </div>
      </div>

      {isLoading ? (
        <p>Cargando clientes…</p>
      ) : datos.length === 0 ? (
        <p className={styles.sinDatos}>No hay compras de clientes en este periodo.</p>
      ) : (
        <GraficaBarras
          titulo={orden === 'mas' ? 'Top 5 clientes con más compras' : 'Top 5 clientes con menos compras'}
          datos={datos}
          colores={['var(--color-primario)']}
          etiquetaEjeY="Monto ($)"
          formatoValor={formatearMoneda}
        />
      )}
    </section>
  )
}
