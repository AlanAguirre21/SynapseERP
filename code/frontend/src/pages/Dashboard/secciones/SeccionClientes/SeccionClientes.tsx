import { useState } from 'react'

import type { OrdenTop, PeriodoDashboard } from '../../../../api/reportes'
import { formatearMoneda } from '../../compartido/formato'
import { GraficaBarras } from '../../compartido/GraficaBarras'
import { useClientesTop } from '../../../../hooks/useClientesTop'

function formatearCompras(valor: number): string {
  return valor === 1 ? '1 compra' : `${valor} compras`
}

interface SeccionClientesProps {
  periodo: PeriodoDashboard
}

export function SeccionClientes({ periodo }: SeccionClientesProps) {
  const [orden, setOrden] = useState<OrdenTop>('mas')
  const { data: clientes, isLoading } = useClientesTop(periodo, orden)

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
            aria-pressed={orden === 'mas'}
            onClick={() => setOrden('mas')}
          >
            Más compras
          </button>
          <button
            type="button"
            className={orden === 'menos' ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
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
        <p className="emptyState">No hay compras de clientes en este periodo.</p>
      ) : (
        <GraficaBarras
          titulo={orden === 'mas' ? 'Top 5 clientes con más compras' : 'Top 5 clientes con menos compras'}
          datos={datos}
          colores={['var(--color-primario)']}
          etiquetaEjeY={porCompras ? 'Compras' : 'Monto ($)'}
          formatoValor={porCompras ? formatearCompras : formatearMoneda}
        />
      )}
    </section>
  )
}
