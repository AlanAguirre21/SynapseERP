import { apiClient } from './client'

export type EstadoCompra = 'pendiente' | 'recibida' | 'cancelada'

<<<<<<< HEAD
=======
// Etiquetas compartidas por Compras, DetalleCompra y el estado de cuenta de Terceros.
export const ETIQUETAS_ESTADO_COMPRA: Record<EstadoCompra, string> = {
  pendiente: 'Pendiente',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
=======
  // Solo tiene efecto para el admin; el operador siempre recibe solo las suyas.
  usuario?: number
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
