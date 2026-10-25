import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { HorizonteEstandar, MetricaPronostico } from '../../../api/analitica'
import { useVistaPronostico } from '../../../hooks/useAnalitica'
import { ETIQUETAS_HORIZONTE, clasePrecision, datosGraficaPronostico, mensajeInsuficiente, textoPrecision } from './formatoPronostico'
import { GraficaPronostico } from './GraficaPronostico'

export interface MetricaVinculada {
  metrica: MetricaPronostico
  titulo: string
  ejeY: string
  formato: (valor: number) => string
}

interface PronosticoVinculadoProps {
  titulo: string
  metricas: MetricaVinculada[]
}

const HORIZONTES: HorizonteEstandar[] = ['dias_7', 'semanas_4', 'meses_3']

// Sección de pronóstico (023) dentro de otro módulo: historial reciente +
// pronóstico vigente de cada métrica, con selector de horizonte. Quien la
// monta ya comprobó que el usuario es admin (los endpoints son admin-only).
export function PronosticoVinculado({ titulo, metricas }: PronosticoVinculadoProps) {
  const [horizonte, setHorizonte] = useState<HorizonteEstandar>('semanas_4')

  return (
    <section className="card" aria-label={titulo}>
      <div className="sectionHeader">
        <h2 className="sectionTitle">{titulo}</h2>
        <div className="headerActions">
          <div className="segmented" role="group" aria-label={`Horizonte de ${titulo.toLowerCase()}`}>
            {HORIZONTES.map((h) => (
              <button
                key={h}
                type="button"
                className={horizonte === h ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
                aria-pressed={horizonte === h}
                onClick={() => setHorizonte(h)}
              >
                {ETIQUETAS_HORIZONTE[h]}
              </button>
            ))}
          </div>
          <Link to="/auditoria-analisis?pestana=pronosticos" className="actionLink">
            Ver pronósticos
          </Link>
        </div>
      </div>
      <div className="chartGrid">
        {metricas.map((m) => (
          <GraficaMetricaVinculada key={m.metrica} metrica={m} horizonte={horizonte} />
        ))}
      </div>
    </section>
  )
}

function GraficaMetricaVinculada({ metrica, horizonte }: { metrica: MetricaVinculada; horizonte: HorizonteEstandar }) {
  const { data: vista, isLoading } = useVistaPronostico({ metrica: metrica.metrica, horizonte })
  if (isLoading || !vista) return <p>Cargando…</p>

  const pronostico = vista.pronostico
  const granularidad = vista.generacion?.granularidad ?? 'semana'
  const generado = pronostico?.estado === 'generado'
  let mensaje = 'Todavía no hay pronósticos generados.'
  if (pronostico && !generado) mensaje = mensajeInsuficiente(pronostico)

  return (
    <div className="cellStack">
      <GraficaPronostico
        titulo={metrica.titulo}
        datos={generado ? datosGraficaPronostico(vista.historial, pronostico, granularidad) : []}
        etiquetaEjeY={metrica.ejeY}
        formatoValor={metrica.formato}
        mensajeVacio={mensaje}
      />
      {generado && <span className={clasePrecision(pronostico.precision)}>{textoPrecision(pronostico)}</span>}
    </div>
  )
}
