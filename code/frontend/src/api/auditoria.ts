import type { TipoItemInventario } from './inventario'
import { apiClient } from './client'

// --- Ejecuciones -----------------------------------------------------------------

export type TipoAuditoria = 'caja' | 'inventario'
export type OrigenEjecucion = 'programada' | 'manual'
export type EstadoEjecucion = 'en_curso' | 'exitosa' | 'fallida'

export interface EjecucionAuditoria {
  id: number
  tipo: TipoAuditoria
  origen: OrigenEjecucion
  iniciada_por: number | null
  iniciada_por_nombre: string
  fecha_inicio: string
  fecha_fin: string | null
  estado: EstadoEjecucion
  elementos_revisados: number
  discrepancias_encontradas: number
  mensaje_error: string
}

export async function getEjecucionesAuditoria(tipo?: TipoAuditoria): Promise<EjecucionAuditoria[]> {
  const { data } = await apiClient.get<EjecucionAuditoria[]>('/auditoria/ejecuciones/', { params: { tipo } })
  return data
}

export async function ejecutarAuditoria(tipo: TipoAuditoria): Promise<EjecucionAuditoria> {
  const { data } = await apiClient.post<EjecucionAuditoria>('/auditoria/ejecuciones/ejecutar/', { tipo })
  return data
}

export async function descargarReporteEjecucion(id: number): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/auditoria/ejecuciones/${id}/pdf/`, { responseType: 'blob' })
  return data
}

// --- Discrepancias ---------------------------------------------------------------

export type CategoriaDiscrepancia = 'caja_corte' | 'caja_integridad' | 'inventario_conteo' | 'inventario_integridad'
export type EstadoDiscrepancia = 'abierta' | 'ajustada' | 'justificada'

export interface DiscrepanciaAuditoria {
  id: number
  ejecucion: number
  fecha_ejecucion: string
  tipo: TipoAuditoria
  categoria: CategoriaDiscrepancia
  descripcion: string
  corte: number | null
  movimiento_caja_id: number | null
  sucursal: number | null
  sucursal_nombre: string
  tipo_item: TipoItemInventario | ''
  item_id: number | null
  item_nombre: string
  valor_esperado: string
  valor_registrado: string
  diferencia: string
  estado: EstadoDiscrepancia
  resuelta_por: number | null
  resuelta_por_nombre: string
  fecha_resolucion: string | null
  comentario_resolucion: string
  movimiento_ajuste_id: number | null
}

export interface FiltrosDiscrepancias {
  tipo?: TipoAuditoria
  categoria?: CategoriaDiscrepancia
  estado?: EstadoDiscrepancia
  sucursal?: number
  ejecucion?: number
  fecha_desde?: string
  fecha_hasta?: string
}

export async function getDiscrepancias(filtros: FiltrosDiscrepancias): Promise<DiscrepanciaAuditoria[]> {
  const { data } = await apiClient.get<DiscrepanciaAuditoria[]>('/auditoria/discrepancias/', { params: filtros })
  return data
}

export async function ajustarDiscrepancia(id: number, comentario: string): Promise<DiscrepanciaAuditoria> {
  const { data } = await apiClient.post<DiscrepanciaAuditoria>(`/auditoria/discrepancias/${id}/ajustar/`, {
    comentario,
  })
  return data
}

export async function justificarDiscrepancia(id: number, comentario: string): Promise<DiscrepanciaAuditoria> {
  const { data } = await apiClient.post<DiscrepanciaAuditoria>(`/auditoria/discrepancias/${id}/justificar/`, {
    comentario,
  })
  return data
}

// --- Cortes de caja --------------------------------------------------------------

export type EstadoCorte = 'pendiente' | 'auditado' | 'reemplazado'

export interface CorteCaja {
  id: number
  fecha_hora_corte: string
  monto_contado: string
  observacion: string
  usuario: number
  usuario_nombre: string
  fecha_registro: string
  reemplaza: number | null
  ejecucion: number | null
  saldo_esperado: string | null
  diferencia: string | null
  estado: EstadoCorte
}

export interface CorteCajaFormulario {
  monto_contado: string
  // Vacío = el momento actual (lo fija el backend).
  fecha_hora_corte?: string
  observacion: string
  reemplaza?: number
}

export async function getCortesCaja(): Promise<CorteCaja[]> {
  const { data } = await apiClient.get<CorteCaja[]>('/auditoria/cortes-caja/')
  return data
}

export async function crearCorteCaja(datos: CorteCajaFormulario): Promise<CorteCaja> {
  const { data } = await apiClient.post<CorteCaja>('/auditoria/cortes-caja/', datos)
  return data
}

// --- Conteos físicos ---------------------------------------------------------------

export type EstadoConteo = 'pendiente' | 'auditado' | 'descartado'

export interface DetalleConteoFisico {
  id: number
  tipo_item: TipoItemInventario
  item_id: number
  item_nombre: string
  cantidad_contada: string
  // Solo llega para admin: el conteo es ciego para el operador.
  stock_teorico?: string
}

export interface ConteoFisico {
  id: number
  sucursal: number
  sucursal_nombre: string
  fecha_conteo: string
  usuario: number
  usuario_nombre: string
  observacion: string
  estado: EstadoConteo
  ejecucion: number | null
  detalles: DetalleConteoFisico[]
}

export interface ConteoFisicoFormulario {
  sucursal: number
  observacion: string
  detalles: { tipo_item: TipoItemInventario; item_id: number; cantidad_contada: string }[]
}

export async function getConteosFisicos(): Promise<ConteoFisico[]> {
  const { data } = await apiClient.get<ConteoFisico[]>('/auditoria/conteos/')
  return data
}

export async function crearConteoFisico(datos: ConteoFisicoFormulario): Promise<ConteoFisico> {
  const { data } = await apiClient.post<ConteoFisico>('/auditoria/conteos/', datos)
  return data
}

export async function descartarConteoFisico(id: number): Promise<ConteoFisico> {
  const { data } = await apiClient.post<ConteoFisico>(`/auditoria/conteos/${id}/descartar/`)
  return data
}

// --- Resumen (vistas vinculadas) ------------------------------------------------------

export interface UltimaEjecucionResumen {
  id: number
  fecha: string
  estado: EstadoEjecucion
  discrepancias_encontradas: number
  discrepancias_abiertas: number
}

export interface PuntoCorteCaja {
  id: number
  fecha_hora_corte: string
  saldo_esperado: string
  monto_contado: string
  diferencia: string
}

export interface ResumenAuditoria {
  ultima_caja: UltimaEjecucionResumen | null
  ultima_inventario: UltimaEjecucionResumen | null
  abiertas_caja: number
  abiertas_inventario: number
  abiertas_por_sucursal: { sucursal: number; sucursal_nombre: string; abiertas: number }[]
  serie_cortes: PuntoCorteCaja[]
}

export async function getResumenAuditoria(): Promise<ResumenAuditoria> {
  const { data } = await apiClient.get<ResumenAuditoria>('/auditoria/resumen/')
  return data
}
