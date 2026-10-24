<<<<<<< HEAD
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

=======
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  COLOR_REJILLA,
  ESTILO_TOOLTIP,
  ETIQUETA_EJE,
  MARCA_EJE,
  MARGEN_GRAFICA,
  formatearCompacto,
} from './estiloGraficas'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import styles from './Graficas.module.css'

export interface PuntoGrafica {
  etiqueta: string
  valor: number
}

interface GraficaLineaProps {
  titulo: string
  datos: PuntoGrafica[]
  color: string
  formatoValor?: (valor: number) => string
}

const formatoMonedaPorDefecto = (valor: number) =>
  `$${valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

<<<<<<< HEAD
export function GraficaLinea({ titulo, datos, color, formatoValor = formatoMonedaPorDefecto }: GraficaLineaProps) {
  return (
    <div className={styles.grafica}>
      <h3 className={styles.graficaTitulo}>{titulo}</h3>
      {datos.length === 0 ? (
        <div className={styles.graficaVacia}>Sin datos en este periodo</div>
      ) : (
        <div className={styles.graficaLienzo}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-texto)" opacity={0.1} />
              <XAxis dataKey="etiqueta" stroke="var(--color-texto)" opacity={0.6} fontSize={12} />
              <YAxis
                stroke="var(--color-texto)"
                opacity={0.6}
                fontSize={12}
                label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              <Tooltip formatter={(valor) => [formatoValor(Number(valor)), titulo]} />
              <Line type="monotone" dataKey="valor" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
=======
// Gráfica de tendencia: línea con un relleno tenue debajo.
export function GraficaLinea({ titulo, datos, color, formatoValor = formatoMonedaPorDefecto }: GraficaLineaProps) {
  return (
    <div className={styles.chart}>
      <h3 className={styles.chartTitle}>{titulo}</h3>
      {datos.length === 0 ? (
        <div className={styles.chartEmpty}>Sin datos en este periodo</div>
      ) : (
        <div className={styles.chartCanvas}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datos} margin={MARGEN_GRAFICA}>
              <CartesianGrid vertical={false} stroke={COLOR_REJILLA} />
              <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} tick={MARCA_EJE} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={MARCA_EJE}
                tickFormatter={formatearCompacto}
                label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft', ...ETIQUETA_EJE }}
              />
              <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(valor) => [formatoValor(Number(valor)), titulo]} />
              <Area
                type="monotone"
                dataKey="valor"
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.12}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
