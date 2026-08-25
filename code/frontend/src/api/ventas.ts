import { apiClient } from './client'

export type EstadoVenta = 'pendiente' | 'entregada' | 'cancelada'

export interface DetalleVenta {
  id: number
  producto: number
  cantidad: string
  precio_unitario: string
  subtotal: string
}

export interface Venta {
  id: number
  cliente: number | null
  cliente_nombre: string
  sucursal: number
  sucursal_nombre: string
  usuario: number
  usuario_nombre: string
  fecha: string
  fecha_entrega: string | null
  fecha_entrega_real: string | null
  total: string
  estado: EstadoVenta
  detalles: DetalleVenta[]
}

export interface LineaVentaFormulario {
  producto: number
  cantidad: string
}

export interface VentaFormulario {
  cliente: number | null
  sucursal: number
  fecha_entrega: string | null
  detalles: LineaVentaFormulario[]
}

export interface FiltrosVentas {
  sucursal?: number
  estado?: EstadoVenta
  cliente?: number
  producto?: number
  fecha_desde?: string
  fecha_hasta?: string
}

export async function getVentas(filtros: FiltrosVentas): Promise<Venta[]> {
  const { data } = await apiClient.get<Venta[]>('/ventas/', { params: filtros })
  return data
}

export async function getVenta(id: number): Promise<Venta> {
  const { data } = await apiClient.get<Venta>(`/ventas/${id}/`)
  return data
}

export async function crearVenta(datos: VentaFormulario): Promise<Venta> {
  const { data } = await apiClient.post<Venta>('/ventas/', datos)
  return data
}

export async function entregarVenta(id: number): Promise<Venta> {
  const { data } = await apiClient.post<Venta>(`/ventas/${id}/entregar/`)
  return data
}

export async function cancelarVenta(id: number): Promise<Venta> {
  const { data } = await apiClient.post<Venta>(`/ventas/${id}/cancelar/`)
  return data
}

export async function obtenerTicketVenta(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/ventas/${id}/ticket/`, { responseType: 'blob' })
  return data
}
