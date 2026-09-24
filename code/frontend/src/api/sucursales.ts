import { apiClient } from './client'

export interface Sucursal {
  id: number
  nombre_sucursal: string
  ubicacion_sucursal: string
  telefono_sucursal: string
  activo: boolean
}

export type SucursalFormulario = Pick<
  Sucursal,
  'nombre_sucursal' | 'ubicacion_sucursal' | 'telefono_sucursal'
>

export async function getSucursales(): Promise<Sucursal[]> {
  const { data } = await apiClient.get<Sucursal[]>('/sucursales/')
  return data
}

export async function crearSucursal(datos: SucursalFormulario): Promise<Sucursal> {
  const { data } = await apiClient.post<Sucursal>('/sucursales/', datos)
  return data
}

export async function editarSucursal(id: number, datos: SucursalFormulario): Promise<Sucursal> {
  const { data } = await apiClient.patch<Sucursal>(`/sucursales/${id}/`, datos)
  return data
}

export async function desactivarSucursal(id: number): Promise<void> {
  await apiClient.delete(`/sucursales/${id}/`)
}

export async function reactivarSucursal(id: number): Promise<Sucursal> {
  const { data } = await apiClient.post<Sucursal>(`/sucursales/${id}/reactivar/`)
  return data
}
