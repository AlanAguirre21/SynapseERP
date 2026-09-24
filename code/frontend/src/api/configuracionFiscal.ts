import { apiClient } from './client'

export interface DatosFiscalesEmpresa {
  rfc: string
  razon_social: string
  regimen_fiscal: string
  codigo_postal_fiscal: string
  completa: boolean
}

export type DatosFiscalesEmpresaFormulario = Omit<DatosFiscalesEmpresa, 'completa'>

export interface ConfiguracionPAC {
  proveedor: string
  api_key_configurada: boolean
  api_endpoint: string
  configuracion_extra: Record<string, unknown>
  activo: boolean
  completa: boolean
}

export interface ConfiguracionPACFormulario {
  proveedor: string
  api_endpoint: string
  activo: boolean
  // Opcional a propósito: si se omite, el backend conserva la credencial ya
  // guardada — nunca se envía la que ya existe, porque el backend nunca la
  // devuelve en lectura (ver `ConfiguracionPACSerializer`).
  api_key?: string
}

export interface SerieFolio {
  id: number
  serie: string
  folio_actual: number
  activo: boolean
}

export interface SerieFolioFormulario {
  serie: string
  folio_actual: number
}

export async function getDatosFiscalesEmpresa(): Promise<DatosFiscalesEmpresa> {
  const { data } = await apiClient.get<DatosFiscalesEmpresa>('/configuracion-fiscal/datos-empresa/')
  return data
}

export async function actualizarDatosFiscalesEmpresa(
  datos: DatosFiscalesEmpresaFormulario,
): Promise<DatosFiscalesEmpresa> {
  const { data } = await apiClient.patch<DatosFiscalesEmpresa>('/configuracion-fiscal/datos-empresa/', datos)
  return data
}

export async function getConfiguracionPAC(): Promise<ConfiguracionPAC> {
  const { data } = await apiClient.get<ConfiguracionPAC>('/configuracion-fiscal/pac/')
  return data
}

export async function actualizarConfiguracionPAC(datos: ConfiguracionPACFormulario): Promise<ConfiguracionPAC> {
  const { data } = await apiClient.patch<ConfiguracionPAC>('/configuracion-fiscal/pac/', datos)
  return data
}

export async function getSeriesFolio(): Promise<SerieFolio[]> {
  const { data } = await apiClient.get<SerieFolio[]>('/configuracion-fiscal/series/')
  return data
}

export async function crearSerieFolio(datos: SerieFolioFormulario): Promise<SerieFolio> {
  const { data } = await apiClient.post<SerieFolio>('/configuracion-fiscal/series/', datos)
  return data
}

export async function editarSerieFolio(id: number, datos: SerieFolioFormulario): Promise<SerieFolio> {
  const { data } = await apiClient.patch<SerieFolio>(`/configuracion-fiscal/series/${id}/`, datos)
  return data
}

export async function desactivarSerieFolio(id: number): Promise<void> {
  await apiClient.delete(`/configuracion-fiscal/series/${id}/`)
}

export async function reactivarSerieFolio(id: number): Promise<SerieFolio> {
  const { data } = await apiClient.post<SerieFolio>(`/configuracion-fiscal/series/${id}/reactivar/`)
  return data
}
