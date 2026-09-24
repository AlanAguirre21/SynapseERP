import { apiClient } from './client'

export type EstadoCompra = 'pendiente' | 'recibida' | 'cancelada'

export interface DetalleCompraProducto {
  id: number
  producto: number
  cantidad: string
  costo_unitario: string
  subtotal: string
}

export interface DetalleCompraMateriaPrima {
  id: number
  materia_prima: number
  cantidad: string
  costo_unitario: string
  subtotal: string
}

export interface Compra {
  id: number
  proveedor: number
  proveedor_nombre: string
  sucursal: number
  sucursal_nombre: string
  usuario: number
  usuario_nombre: string
  fecha: string
  fecha_entrega: string | null
  total: string
  estado: EstadoCompra
  detalles_producto: DetalleCompraProducto[]
  detalles_materia_prima: DetalleCompraMateriaPrima[]
}

export interface LineaCompraProductoFormulario {
  producto: number
  cantidad: string
  costo_unitario: string
}

export interface LineaCompraMateriaPrimaFormulario {
  materia_prima: number
  cantidad: string
  costo_unitario: string
}

export interface CompraFormulario {
  proveedor: number
  sucursal: number
  fecha_entrega: string | null
  detalles_producto: LineaCompraProductoFormulario[]
  detalles_materia_prima: LineaCompraMateriaPrimaFormulario[]
}

export interface FiltrosCompras {
  proveedor?: number
  estado?: EstadoCompra
  fecha_desde?: string
  fecha_hasta?: string
}

export async function getCompras(filtros: FiltrosCompras): Promise<Compra[]> {
  const { data } = await apiClient.get<Compra[]>('/compras/', { params: filtros })
  return data
}

export async function getCompra(id: number): Promise<Compra> {
  const { data } = await apiClient.get<Compra>(`/compras/${id}/`)
  return data
}

export async function crearCompra(datos: CompraFormulario): Promise<Compra> {
  const { data } = await apiClient.post<Compra>('/compras/', datos)
  return data
}

export async function recibirCompra(id: number): Promise<Compra> {
  const { data } = await apiClient.post<Compra>(`/compras/${id}/recibir/`)
  return data
}

export async function cancelarCompra(id: number): Promise<Compra> {
  const { data } = await apiClient.post<Compra>(`/compras/${id}/cancelar/`)
  return data
}
