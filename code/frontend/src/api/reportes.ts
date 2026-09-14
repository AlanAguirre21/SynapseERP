import { apiClient } from './client'

export type PeriodoDashboard = 'dia' | 'semana' | 'mes' | 'año'

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

export interface PuntoMonto {
  fecha: string
  monto: string
}

export interface ConteoEstado {
  tipo: string
  cantidad: number
}

export interface ResumenVentas {
  periodo: PeriodoDashboard
  con_envio: PuntoMonto[]
  sin_envio: PuntoMonto[]
  envio: PuntoMonto[]
  conteo_estado: ConteoEstado[]
}

export async function getResumenVentas(periodo: PeriodoDashboard): Promise<ResumenVentas> {
  const { data } = await apiClient.get<ResumenVentas>('/reportes/ventas/', { params: { periodo } })
  return data
}

export interface ResumenCompras {
  periodo: PeriodoDashboard
  todas: PuntoMonto[]
  productos: PuntoMonto[]
  insumos: PuntoMonto[]
  conteo_estado: ConteoEstado[]
}

export async function getResumenCompras(periodo: PeriodoDashboard): Promise<ResumenCompras> {
  const { data } = await apiClient.get<ResumenCompras>('/reportes/compras/', { params: { periodo } })
  return data
}

export type OrdenTop = 'mas' | 'menos'

export interface ProductoTop {
  producto: string
  cantidad: string
}

export async function getProductosTop(periodo: PeriodoDashboard, orden: OrdenTop): Promise<ProductoTop[]> {
  const { data } = await apiClient.get<ProductoTop[]>('/reportes/productos-top/', { params: { periodo, orden } })
  return data
}

export interface ClienteTop {
  cliente: string
  monto: string
}

export async function getClientesTop(periodo: PeriodoDashboard, orden: OrdenTop): Promise<ClienteTop[]> {
  const { data } = await apiClient.get<ClienteTop[]>('/reportes/clientes-top/', { params: { periodo, orden } })
  return data
}

export type LimiteMovimientos = '5' | '10' | 'todos'

export interface MovimientoCajaReporte {
  fecha: string
  tipo_movimiento: 'ingreso' | 'retiro'
  observacion: string
}

export async function getMovimientosCajaReporte(
  periodo: PeriodoDashboard,
  limite: LimiteMovimientos,
): Promise<MovimientoCajaReporte[]> {
  const { data } = await apiClient.get<MovimientoCajaReporte[]>('/reportes/movimientos-caja/', {
    params: { periodo, limite },
  })
  return data
}
