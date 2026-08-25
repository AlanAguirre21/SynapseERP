import { apiClient } from './client'

export interface AlertaStock {
  tipo: 'producto' | 'materia_prima'
  nombre: string
  sucursal: string
  stock_actual: number | string
  stock_minimo: number | string
}

export async function getAlertasStock(): Promise<AlertaStock[]> {
  const { data } = await apiClient.get<AlertaStock[]>('/inventario/alertas/')
  return data
}

// --- Stock -----------------------------------------------------------

export type TipoItemInventario = 'producto' | 'materia_prima'

export interface StockItem {
  id: number
  nombre: string
  stock_actual: string
  stock_minimo: string
  stock_bajo: boolean
}

export async function getStock(tipo: TipoItemInventario, sucursalId: number): Promise<StockItem[]> {
  const { data } = await apiClient.get<StockItem[]>('/inventario/stock/', {
    params: { tipo, sucursal: sucursalId },
  })
  return data
}

// --- Movimientos de inventario -------------------------------------------

export type TipoMovimientoInventario = 'entrada' | 'salida'
export type MotivoMovimientoInventario = 'compra' | 'venta' | 'produccion' | 'ajuste'

export interface MovimientoInventario {
  id: number
  fecha: string
  sucursal: number
  sucursal_nombre: string
  tipo_item: TipoItemInventario
  item_id: number
  item_nombre: string
  tipo_movimiento: TipoMovimientoInventario
  cantidad: string
  motivo: MotivoMovimientoInventario
  referencia_id: number | null
  stock_resultante: string
  usuario: number
  usuario_nombre: string
}

export interface FiltrosMovimientosInventario {
  sucursal?: number
  tipo_item?: TipoItemInventario
  item_id?: number
  tipo_movimiento?: TipoMovimientoInventario
}

export async function getMovimientosInventario(
  filtros: FiltrosMovimientosInventario,
): Promise<MovimientoInventario[]> {
  const { data } = await apiClient.get<MovimientoInventario[]>('/inventario/movimientos/', {
    params: filtros,
  })
  return data
}
