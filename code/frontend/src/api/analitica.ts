import { apiClient } from './client'

export type HorizontePronostico = 'dias_7' | 'semanas_4' | 'meses_3' | 'personalizado'
export type HorizonteEstandar = Exclude<HorizontePronostico, 'personalizado'>
export type GranularidadPronostico = 'dia' | 'semana' | 'mes'
export type EstadoGeneracion = 'en_curso' | 'exitosa' | 'fallida'
export type MetricaPronostico =
  | 'monto_ventas'
  | 'numero_ventas'
  | 'monto_categoria'
  | 'unidades_producto'
  | 'clientes_nuevos'
  | 'clientes_activos'
  | 'base_clientes'
export type PrecisionPronostico = 'alta' | 'media' | 'baja'

export interface GeneracionPronostico {
  id: number
  origen: 'programada' | 'manual'
  iniciada_por: number | null
  iniciada_por_nombre: string
  fecha_inicio: string
  fecha_fin: string | null
  estado: EstadoGeneracion
  horizonte: HorizontePronostico
  granularidad: GranularidadPronostico
  periodo_desde: string
  periodo_hasta: string
  historial_desde: string | null
  historial_hasta: string | null
  mensaje_error: string
}

export interface PuntoPronostico {
  periodo_inicio: string
  periodo_fin: string
  valor: string
  limite_inferior: string
  limite_superior: string
}

export interface Pronostico {
  id: number
  generacion: number
  metrica: MetricaPronostico
  producto: number | null
  producto_nombre: string
  categoria: number | null
  categoria_nombre: string
  estado: 'generado' | 'historial_insuficiente'
  periodos_historial: number
  periodos_minimos: number
  metodo: 'tendencia' | 'tendencia_estacional' | ''
  wape: string | null
  precision: PrecisionPronostico | null
  total_pronosticado: string | null
  total_inferior: string | null
  total_superior: string | null
  puntos: PuntoPronostico[]
}

export interface PuntoHistorial {
  periodo_inicio: string
  valor: string
}

export interface PrecisionReal {
  generacion: number
  puntos: { periodo_inicio: string; pronosticado: string; real: string }[]
  wape: string | null
}

export interface VistaPronostico {
  generacion: GeneracionPronostico | null
  pronostico: Pronostico | null
  historial: PuntoHistorial[]
  precision_real: PrecisionReal | null
}

export interface FiltrosVistaPronostico {
  metrica: MetricaPronostico
  horizonte: HorizontePronostico
  generacion?: number
  producto?: number
  categoria?: number
}

export async function getVistaPronostico(filtros: FiltrosVistaPronostico): Promise<VistaPronostico> {
  const { data } = await apiClient.get<VistaPronostico>('/analitica/vista/', { params: filtros })
  return data
}

export async function getGeneracionesPronostico(horizonte?: HorizontePronostico): Promise<GeneracionPronostico[]> {
  const { data } = await apiClient.get<GeneracionPronostico[]>('/analitica/generaciones/', { params: { horizonte } })
  return data
}

export interface SolicitudGenerarPronostico {
  // Sin horizonte: los tres estándar.
  horizonte?: HorizontePronostico
  desde?: string
  hasta?: string
  granularidad?: GranularidadPronostico
}

export async function generarPronosticos(datos: SolicitudGenerarPronostico): Promise<GeneracionPronostico[]> {
  const { data } = await apiClient.post<GeneracionPronostico[]>('/analitica/generaciones/generar/', datos)
  return data
}

export async function getPronosticos(filtros: {
  generacion: number
  metrica: MetricaPronostico
}): Promise<Pronostico[]> {
  const { data } = await apiClient.get<Pronostico[]>('/analitica/pronosticos/', { params: filtros })
  return data
}

export type PeriodoProyeccion = 'semana' | 'mes' | 'año'

export interface ProyeccionDashboard {
  granularidad: GranularidadPronostico
  real: PuntoHistorial[]
  proyeccion: { periodo_inicio: string; valor: string; limite_inferior: string; limite_superior: string }[]
  generacion_fecha: string | null
}

export async function getProyeccionDashboard(periodo: PeriodoProyeccion): Promise<ProyeccionDashboard> {
  const { data } = await apiClient.get<ProyeccionDashboard>('/analitica/proyeccion-dashboard/', { params: { periodo } })
  return data
}

export interface ProductoDemanda {
  producto: number
  producto_nombre: string
  unidades: string
  limite_inferior: string
  limite_superior: string
  wape: string | null
  precision: PrecisionPronostico | null
  stock_total: string
  insuficiente: boolean
}

export interface DemandaPronosticada {
  generacion: GeneracionPronostico | null
  productos: ProductoDemanda[]
}

// `generacion`: una generación concreta (ej. un rango personalizado) en vez de la vigente.
export async function getDemandaPronosticada(
  horizonte: HorizonteEstandar,
  limite?: number,
  generacion?: number,
): Promise<DemandaPronosticada> {
  const { data } = await apiClient.get<DemandaPronosticada>('/analitica/demanda/', {
    params: { horizonte, limite, generacion },
  })
  return data
}
