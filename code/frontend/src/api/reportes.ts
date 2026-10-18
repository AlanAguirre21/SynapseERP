import { apiClient } from './client'
import type { EstadoFactura } from './facturacion'

export type PeriodoDashboard = 'dia' | 'semana' | 'mes' | 'año'

export interface PuntoResumenDashboard {
  fecha: string
  ganancia: string
}

// `ganancia` y `serie` solo llegan al admin; el operador recibe los totales
// que usan Ventas y Compras (016, "Actualización: ganancias y movimientos de
// caja solo para admin").
export interface ResumenDashboard {
  periodo: PeriodoDashboard
  ventas_total: string
  compras_total: string
  ganancia?: string
  serie?: PuntoResumenDashboard[]
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

// Admin: monto comprado. Operador: número de compras, sin importes.
export interface ClienteTop {
  cliente: string
  monto?: string
  compras?: number
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

// --- Resumen facturación (016, "Actualización: Resumen facturación con datos")

export interface PuntoFacturacion {
  fecha: string
  total: string
  pue: string
  ppd: string
}

export interface ConteoEstadoFactura {
  estado: EstadoFactura
  tipo: string
  cantidad: number
}

export interface FacturaPorAtender {
  id: number
  serie: string
  folio_interno: number | null
  cliente: string
  total: string
  estado: EstadoFactura
  fecha: string
}

export interface ResumenFacturacion {
  periodo: PeriodoDashboard
  facturado_total: string
  facturas_emitidas: number
  por_cobrar_ppd: string
  // `null` si no hay ventas en el periodo.
  porcentaje_facturado: string | null
  serie: PuntoFacturacion[]
  conteo_estado: ConteoEstadoFactura[]
  // Pendientes accionables (error / pendiente de cancelación): no dependen del periodo.
  requiere_atencion: FacturaPorAtender[]
}

export async function getResumenFacturacion(periodo: PeriodoDashboard): Promise<ResumenFacturacion> {
  const { data } = await apiClient.get<ResumenFacturacion>('/reportes/facturacion/', { params: { periodo } })
  return data
}
