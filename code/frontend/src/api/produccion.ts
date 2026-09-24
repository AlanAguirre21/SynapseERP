import { apiClient } from './client'

// --- Recetas --------------------------------------------------------------

export interface Receta {
  id: number
  producto: number
  producto_nombre: string
  materia_prima: number
  materia_prima_nombre: string
  cantidad_requerida: string
  activo: boolean
}

export type RecetaFormulario = Pick<Receta, 'producto' | 'materia_prima' | 'cantidad_requerida'>

export async function getRecetas(productoId?: number): Promise<Receta[]> {
  const { data } = await apiClient.get<Receta[]>('/produccion/recetas/', {
    params: productoId ? { producto: productoId } : undefined,
  })
  return data
}

export async function crearReceta(datos: RecetaFormulario): Promise<Receta> {
  const { data } = await apiClient.post<Receta>('/produccion/recetas/', datos)
  return data
}

export async function editarReceta(id: number, datos: RecetaFormulario): Promise<Receta> {
  const { data } = await apiClient.patch<Receta>(`/produccion/recetas/${id}/`, datos)
  return data
}

export async function desactivarReceta(id: number): Promise<void> {
  await apiClient.delete(`/produccion/recetas/${id}/`)
}

export async function reactivarReceta(id: number): Promise<Receta> {
  const { data } = await apiClient.post<Receta>(`/produccion/recetas/${id}/reactivar/`)
  return data
}

// --- Producciones -----------------------------------------------------------

export interface DetalleProduccion {
  id: number
  materia_prima: number
  materia_prima_nombre: string
  cantidad_consumida: string
  costo_unitario_momento: string
  subtotal: string
}

export interface Produccion {
  id: number
  producto: number
  producto_nombre: string
  sucursal: number
  sucursal_nombre: string
  usuario: number
  usuario_nombre: string
  fecha: string
  cantidad_producida: string
  costo_total: string
  detalles: DetalleProduccion[]
}

export interface ProduccionFormulario {
  producto: number
  sucursal: number
  cantidad_producida: string
}

export interface FiltrosProducciones {
  sucursal?: number
  producto?: number
  fecha_desde?: string
  fecha_hasta?: string
}

export async function getProducciones(filtros: FiltrosProducciones): Promise<Produccion[]> {
  const { data } = await apiClient.get<Produccion[]>('/produccion/', { params: filtros })
  return data
}

export async function getProduccion(id: number): Promise<Produccion> {
  const { data } = await apiClient.get<Produccion>(`/produccion/${id}/`)
  return data
}

export async function crearProduccion(datos: ProduccionFormulario): Promise<Produccion> {
  const { data } = await apiClient.post<Produccion>('/produccion/', datos)
  return data
}
