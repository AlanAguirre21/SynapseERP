import { apiClient } from './client'

export type TipoMovimientoCaja = 'ingreso' | 'retiro'
export type MotivoMovimientoCaja = 'venta' | 'ajuste' | 'manual' | 'compra' | 'envio'

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

export interface SaldosCaja {
  saldo_actual: string
  saldo_adicional: string
  saldo_total: string
}

export async function getSaldoCaja(): Promise<SaldosCaja> {
  const { data } = await apiClient.get<SaldosCaja>('/caja/saldo/')
  return data
}

export async function crearMovimientoCaja(datos: MovimientoCajaFormulario): Promise<MovimientoCaja> {
  const { data } = await apiClient.post<MovimientoCaja>('/caja/', datos)
  return data
}
