import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  COLOR_REJILLA,
  CURSOR_TOOLTIP,
  ESTILO_TOOLTIP,
  ETIQUETA_EJE,
  MARCA_EJE,
  MARGEN_GRAFICA,
  formatearCompacto,
} from './estiloGraficas'
import styles from './Graficas.module.css'

export interface BarraGrafica {
  etiqueta: string
  valor: number
}

interface GraficaBarrasProps {
  titulo: string
  datos: BarraGrafica[]
  colores: string[]
  etiquetaEjeY: string
  formatoValor?: (valor: number) => string
}

const formatoNumeroPorDefecto = (valor: number) => valor.toLocaleString('es-MX')

export function GraficaBarras({
  titulo,
  datos,
  colores,
  etiquetaEjeY,
  formatoValor = formatoNumeroPorDefecto,
}: GraficaBarrasProps) {
  return (
    <div className={styles.chart}>
      <h3 className={styles.chartTitle}>{titulo}</h3>
      {datos.length === 0 ? (
        <div className={styles.chartEmpty}>Sin datos en este periodo</div>
      ) : (
        <div className={styles.chartCanvas}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={MARGEN_GRAFICA}>
              <CartesianGrid vertical={false} stroke={COLOR_REJILLA} />
              <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} tick={MARCA_EJE} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={MARCA_EJE}
                tickFormatter={formatearCompacto}
                allowDecimals={false}
                label={{ value: etiquetaEjeY, angle: -90, position: 'insideLeft', ...ETIQUETA_EJE }}
              />
              <Tooltip
                contentStyle={ESTILO_TOOLTIP}
                cursor={CURSOR_TOOLTIP}
                formatter={(valor) => [formatoValor(Number(valor)), titulo]}
              />
              <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={64}>
                {datos.map((entrada, indice) => (
                  <Cell key={entrada.etiqueta} fill={colores[indice % colores.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
