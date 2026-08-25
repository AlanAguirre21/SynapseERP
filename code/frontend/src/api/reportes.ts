import { apiClient } from './client'

export type PeriodoDashboard = 'dia' | 'semana' | 'mes'

export interface PuntoResumenDashboard {
  fecha: string
  ganancia: string
}

export interface ResumenDashboard {
  periodo: PeriodoDashboard
  ventas_total: string
  compras_total: string
  ganancia: string
  serie: PuntoResumenDashboard[]
}

export async function getResumenDashboard(periodo: PeriodoDashboard): Promise<ResumenDashboard> {
  const { data } = await apiClient.get<ResumenDashboard>('/reportes/resumen/', { params: { periodo } })
  return data
}
