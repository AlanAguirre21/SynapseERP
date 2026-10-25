import type {
  GranularidadPronostico,
  HorizontePronostico,
  PrecisionPronostico,
  Pronostico,
  PuntoHistorial,
} from '../../../api/analitica'
import type { PuntoPronosticoGrafica } from './GraficaPronostico'

export const ETIQUETAS_HORIZONTE: Record<HorizontePronostico, string> = {
  dias_7: 'Próximos 7 días',
  semanas_4: 'Próximas 4 semanas',
  meses_3: 'Próximos 3 meses',
  personalizado: 'Rango personalizado',
}

export const ETIQUETAS_GRANULARIDAD: Record<GranularidadPronostico, string> = {
  dia: 'Diaria',
  semana: 'Semanal',
  mes: 'Mensual',
}

export const ETIQUETAS_PRECISION: Record<PrecisionPronostico, string> = {
  alta: 'Precisión alta',
  media: 'Precisión media',
  baja: 'Precisión baja',
}

export function clasePrecision(precision: PrecisionPronostico | null): string {
  if (precision === 'alta') return 'status statusSuccess'
  if (precision === 'media') return 'status statusWarning'
  if (precision === 'baja') return 'status statusError'
  return 'status statusNeutral'
}

// "Precisión alta · 88 %" o "Sin validación suficiente".
export function textoPrecision(pronostico: Pick<Pronostico, 'precision' | 'wape'>): string {
  if (!pronostico.precision || pronostico.wape === null) return 'Sin validación suficiente'
  const porcentaje = Math.max(0, Math.round((1 - Number(pronostico.wape)) * 100))
  return `${ETIQUETAS_PRECISION[pronostico.precision]} · ${porcentaje} %`
}

export function mensajeInsuficiente(pronostico: Pick<Pronostico, 'periodos_historial' | 'periodos_minimos'>): string {
  return (
    `Historial insuficiente: hay ${pronostico.periodos_historial} periodo(s) completo(s) y se necesitan al menos ` +
    `${pronostico.periodos_minimos} para pronosticar.`
  )
}

// `AAAA-MM-DD` sin pasar por `Date` UTC (evita el corrimiento de zona horaria).
function partesFecha(iso: string): [number, number, number] {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return [anio ?? 0, mes ?? 1, dia ?? 1]
}

export function etiquetaPeriodo(iso: string, granularidad: GranularidadPronostico): string {
  const [anio, mes, dia] = partesFecha(iso)
  const fecha = new Date(anio, mes - 1, dia)
  if (granularidad === 'mes') return fecha.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export function fechaLarga(iso: string): string {
  const [anio, mes, dia] = partesFecha(iso)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Historial real + puntos pronosticados, en el formato de `GraficaPronostico`.
export function datosGraficaPronostico(
  historial: PuntoHistorial[],
  pronostico: Pronostico | null,
  granularidad: GranularidadPronostico,
): PuntoPronosticoGrafica[] {
  const reales = historial.map((p) => ({
    etiqueta: etiquetaPeriodo(p.periodo_inicio, granularidad),
    real: Number(p.valor),
  }))
  const futuros =
    pronostico?.estado === 'generado'
      ? pronostico.puntos.map((p) => ({
          etiqueta: etiquetaPeriodo(p.periodo_inicio, granularidad),
          pronostico: Number(p.valor),
          rango: [Number(p.limite_inferior), Number(p.limite_superior)] as [number, number],
        }))
      : []
  return [...reales, ...futuros]
}
