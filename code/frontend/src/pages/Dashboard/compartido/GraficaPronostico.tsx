import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  COLOR_REJILLA,
  ESTILO_LEYENDA,
  ESTILO_TOOLTIP,
  ETIQUETA_EJE,
  MARCA_EJE,
  MARGEN_GRAFICA,
  formatearCompacto,
} from './estiloGraficas'
import styles from './Graficas.module.css'

export interface PuntoPronosticoGrafica {
  etiqueta: string
  real?: number
  pronostico?: number
  // [límite inferior, límite superior] del rango esperado.
  rango?: [number, number]
}

interface GraficaPronosticoProps {
  titulo: string
  datos: PuntoPronosticoGrafica[]
  etiquetaEjeY: string
  formatoValor?: (valor: number) => string
  // Texto en lugar de la gráfica (ej. "Historial insuficiente…").
  mensajeVacio?: string
}

const formatoNumeroPorDefecto = (valor: number) => valor.toLocaleString('es-MX', { maximumFractionDigits: 2 })

// Historial (línea continua) + pronóstico (línea punteada) + rango esperado
// (área tenue). La proyección se distingue siempre del historial (spec 023).
export function GraficaPronostico({
  titulo,
  datos,
  etiquetaEjeY,
  formatoValor = formatoNumeroPorDefecto,
  mensajeVacio = 'Sin datos para graficar',
}: GraficaPronosticoProps) {
  return (
    <div className={styles.chart}>
      <h3 className={styles.chartTitle}>{titulo}</h3>
      {datos.length === 0 ? (
        <div className={styles.chartEmpty}>{mensajeVacio}</div>
      ) : (
        <div className={styles.chartCanvas}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={MARGEN_GRAFICA}>
              <CartesianGrid vertical={false} stroke={COLOR_REJILLA} />
              <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} tick={MARCA_EJE} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={MARCA_EJE}
                tickFormatter={formatearCompacto}
                label={{ value: etiquetaEjeY, angle: -90, position: 'insideLeft', ...ETIQUETA_EJE }}
              />
              <Tooltip
                contentStyle={ESTILO_TOOLTIP}
                formatter={(valor, nombre) => {
                  const texto = Array.isArray(valor)
                    ? `${formatoValor(Number(valor[0]))} – ${formatoValor(Number(valor[1]))}`
                    : formatoValor(Number(valor))
                  return [texto, nombre]
                }}
              />
              <Legend wrapperStyle={ESTILO_LEYENDA} />
              <Area
                type="monotone"
                dataKey="rango"
                name="Rango esperado"
                stroke="none"
                fill="var(--color-inicio)"
                fillOpacity={0.15}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Real"
                stroke="var(--color-primario)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="pronostico"
                name="Pronóstico"
                stroke="var(--color-inicio)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
