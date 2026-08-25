import { apiClient } from './client'

export type TipoMovimientoCaja = 'ingreso' | 'retiro'
export type MotivoMovimientoCaja = 'venta' | 'ajuste' | 'manual'

export interface MovimientoCaja {
  id: number
  fecha: string
  tipo_movimiento: TipoMovimientoCaja
  monto: string
  motivo: MotivoMovimientoCaja
  referencia_id: number | null
  observacion: string
  usuario: number
  usuario_nombre: string
  saldo_resultante: string
}

export interface MovimientoCajaFormulario {
  tipo_movimiento: TipoMovimientoCaja
  monto: string
  observacion: string
}

export interface FiltrosMovimientosCaja {
  tipo_movimiento?: TipoMovimientoCaja
  motivo?: MotivoMovimientoCaja
  fecha_desde?: string
  fecha_hasta?: string
}

export async function getMovimientosCaja(filtros: FiltrosMovimientosCaja): Promise<MovimientoCaja[]> {
  const { data } = await apiClient.get<MovimientoCaja[]>('/caja/', { params: filtros })
  return data
}

export async function getSaldoCaja(): Promise<string> {
  const { data } = await apiClient.get<{ saldo_actual: string }>('/caja/saldo/')
  return data.saldo_actual
}

export async function crearMovimientoCaja(datos: MovimientoCajaFormulario): Promise<MovimientoCaja> {
  const { data } = await apiClient.post<MovimientoCaja>('/caja/', datos)
  return data
}
