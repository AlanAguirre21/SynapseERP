import { useState } from 'react'

import type { OrdenTop, PeriodoDashboard } from '../../../../api/reportes'
import { formatearMoneda } from '../../compartido/formato'
import { GraficaBarras } from '../../compartido/GraficaBarras'
import { useClientesTop } from '../../../../hooks/useClientesTop'
<<<<<<< HEAD
import styles from '../../compartido/SeccionTop.module.css'
=======

function formatearCompras(valor: number): string {
  return valor === 1 ? '1 compra' : `${valor} compras`
}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

interface SeccionClientesProps {
  periodo: PeriodoDashboard
}

export function SeccionClientes({ periodo }: SeccionClientesProps) {
  const [orden, setOrden] = useState<OrdenTop>('mas')
  const { data: clientes, isLoading } = useClientesTop(periodo, orden)

<<<<<<< HEAD
  const datos = (clientes ?? []).map((cliente) => ({ etiqueta: cliente.cliente, valor: Number(cliente.monto) }))

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.tituloSeccion}>Resumen clientes</h2>
        <div className={styles.selectorOrden} role="group" aria-label="Orden del ranking de clientes">
          <button
            type="button"
            className={orden === 'mas' ? `${styles.opcionOrden} ${styles.opcionOrdenActiva}` : styles.opcionOrden}
=======
  // El admin recibe el monto comprado; el operador, el número de compras (sin importes).
  const porCompras = (clientes ?? []).some((cliente) => cliente.compras !== undefined)
  const datos = (clientes ?? []).map((cliente) => ({
    etiqueta: cliente.cliente,
    valor: porCompras ? Number(cliente.compras ?? 0) : Number(cliente.monto ?? 0),
  }))

  return (
    <section className="card">
      <div className="sectionHeader">
        <h2 className="sectionTitle">Resumen clientes</h2>
        <div className="segmented" role="group" aria-label="Orden del ranking de clientes">
          <button
            type="button"
            className={orden === 'mas' ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            aria-pressed={orden === 'mas'}
            onClick={() => setOrden('mas')}
          >
            Más compras
          </button>
          <button
            type="button"
<<<<<<< HEAD
            className={orden === 'menos' ? `${styles.opcionOrden} ${styles.opcionOrdenActiva}` : styles.opcionOrden}
=======
            className={orden === 'menos' ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
        <p className={styles.sinDatos}>No hay compras de clientes en este periodo.</p>
=======
        <p className="emptyState">No hay compras de clientes en este periodo.</p>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      ) : (
        <GraficaBarras
          titulo={orden === 'mas' ? 'Top 5 clientes con más compras' : 'Top 5 clientes con menos compras'}
          datos={datos}
          colores={['var(--color-primario)']}
<<<<<<< HEAD
          etiquetaEjeY="Monto ($)"
          formatoValor={formatearMoneda}
=======
          etiquetaEjeY={porCompras ? 'Compras' : 'Monto ($)'}
          formatoValor={porCompras ? formatearCompras : formatearMoneda}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        />
      )}
    </section>
  )
}
