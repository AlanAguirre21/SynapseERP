import { Link } from 'react-router-dom'

import type { ProductoDemanda } from '../../../api/analitica'
import { Tabla, type ColumnaTabla } from '../../../components/common/Tabla'
import { useDemandaPronosticada } from '../../../hooks/useAnalitica'
import { clasePrecision, textoPrecision } from './formatoPronostico'

const formatearUnidades = (valor: string) => Number(valor).toLocaleString('es-MX', { maximumFractionDigits: 2 })

type Fila = ProductoDemanda & { id: number }

// "Demanda pronosticada" (023) para Compras y Producción: los productos de
// mayor demanda en las próximas 4 semanas frente a su stock total actual.
// Solo admin: quien la monta ya lo comprobó.
export function DemandaPronosticadaResumen() {
  const { data: demanda, isLoading } = useDemandaPronosticada('semanas_4', 5)
  const filas: Fila[] = (demanda?.productos ?? []).map((p) => ({ ...p, id: p.producto }))

  const columnas: ColumnaTabla<Fila>[] = [
    { clave: 'producto_nombre', encabezado: 'Producto' },
    {
      clave: 'unidades',
      alineacion: 'derecha',
      encabezado: 'Demanda (4 semanas)',
      render: (fila) => formatearUnidades(fila.unidades),
    },
    {
      clave: 'stock_total',
      alineacion: 'derecha',
      encabezado: 'Stock total',
      render: (fila) => formatearUnidades(fila.stock_total),
    },
    {
      clave: 'insuficiente',
      encabezado: 'Cobertura',
      render: (fila) =>
        fila.insuficiente ? (
          <span className="status statusWarning">Se quedaría corto</span>
        ) : (
          <span className="status statusSuccess">Alcanza</span>
        ),
    },
    {
      clave: 'precision',
      encabezado: 'Precisión',
      render: (fila) => <span className={clasePrecision(fila.precision)}>{textoPrecision(fila)}</span>,
    },
  ]

  return (
    <section className="card" aria-label="Demanda pronosticada">
      <div className="sectionHeader">
        <h2 className="sectionTitle">Demanda pronosticada</h2>
        <Link to="/auditoria-analisis?pestana=pronosticos" className="actionLink">
          Ver pronósticos
        </Link>
      </div>
      {isLoading ? (
        <p>Cargando…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={filas}
          mensajeVacio={
            demanda?.generacion
              ? 'Ningún producto tiene historial suficiente todavía.'
              : 'Todavía no hay pronósticos generados.'
          }
        />
      )}
    </section>
  )
}
