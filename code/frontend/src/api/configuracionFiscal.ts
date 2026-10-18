import { apiClient } from './client'

export interface DatosFiscalesEmpresa {
  rfc: string
  razon_social: string
  regimen_fiscal: string
  codigo_postal_fiscal: string
  completa: boolean
}

export type DatosFiscalesEmpresaFormulario = Omit<DatosFiscalesEmpresa, 'completa'>

// Catálogo c_RegimenFiscal del SAT (CFDI 4.0). Solo se usa para describir el
// código capturado; el campo acepta cualquier código, así que un catálogo
// desactualizado no bloquea nada (revisar junto con los demás catálogos del
// SAT del checklist de mantenimiento de `019 · Facturación`).
export const REGIMENES_FISCALES: { valor: string; etiqueta: string }[] = [
  { valor: '601', etiqueta: '601 — General de Ley Personas Morales' },
  { valor: '603', etiqueta: '603 — Personas Morales con Fines no Lucrativos' },
  { valor: '605', etiqueta: '605 — Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { valor: '606', etiqueta: '606 — Arrendamiento' },
  { valor: '607', etiqueta: '607 — Régimen de Enajenación o Adquisición de Bienes' },
  { valor: '608', etiqueta: '608 — Demás ingresos' },
  { valor: '610', etiqueta: '610 — Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { valor: '611', etiqueta: '611 — Ingresos por Dividendos (socios y accionistas)' },
  { valor: '612', etiqueta: '612 — Personas Físicas con Actividades Empresariales y Profesionales' },
  { valor: '614', etiqueta: '614 — Ingresos por intereses' },
  { valor: '615', etiqueta: '615 — Régimen de los ingresos por obtención de premios' },
  { valor: '616', etiqueta: '616 — Sin obligaciones fiscales' },
  { valor: '620', etiqueta: '620 — Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { valor: '621', etiqueta: '621 — Incorporación Fiscal' },
  { valor: '622', etiqueta: '622 — Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { valor: '623', etiqueta: '623 — Opcional para Grupos de Sociedades' },
  { valor: '624', etiqueta: '624 — Coordinados' },
  { valor: '625', etiqueta: '625 — Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { valor: '626', etiqueta: '626 — Régimen Simplificado de Confianza' },
]

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
