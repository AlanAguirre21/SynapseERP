import { apiClient } from './client'

export type TipoCuenta = 'activo' | 'pasivo' | 'capital' | 'ingreso' | 'egreso'

export const ETIQUETAS_TIPO_CUENTA: Record<TipoCuenta, string> = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  capital: 'Capital',
  ingreso: 'Ingreso',
  egreso: 'Egreso',
}

export interface CuentaContable {
  id: number
  codigo: string
  nombre: string
  tipo: TipoCuenta
  cuenta_padre: number | null
  cuenta_padre_codigo: string | null
  activo: boolean
}

export interface CuentaContableFormulario {
  codigo: string
  nombre: string
  tipo: TipoCuenta
  cuenta_padre: number | null
}

export type TipoOrigenAsiento = 'venta' | 'compra' | 'caja' | 'ajuste'

export const ETIQUETAS_ORIGEN_ASIENTO: Record<TipoOrigenAsiento, string> = {
  venta: 'Venta',
  compra: 'Compra',
  caja: 'Caja',
  ajuste: 'Ajuste',
}

export interface MovimientoContable {
  id: number
  cuenta_contable: number
  cuenta_codigo: string
  cuenta_nombre: string
  tipo_movimiento: 'cargo' | 'abono'
  monto: string
}

export interface AsientoContable {
  id: number
  fecha: string
  concepto: string
  tipo_origen: TipoOrigenAsiento
  referencia_id: number | null
  usuario: number
  usuario_nombre: string
  movimientos: MovimientoContable[]
}

export interface FiltrosLibroDiario {
  tipo_origen?: TipoOrigenAsiento
  cuenta?: number
  fecha_desde?: string
  fecha_hasta?: string
}

export interface FilaBalance {
  cuenta: number
  codigo: string
  nombre: string
  tipo: TipoCuenta
  total_cargos: string
  total_abonos: string
  saldo: string
}

export interface FiltrosBalance {
  fecha_desde?: string
  fecha_hasta?: string
}

export type TipoExportacion = 'libro_diario' | 'balance'

export async function getCuentasContables(filtros: { tipo?: TipoCuenta } = {}): Promise<CuentaContable[]> {
  const { data } = await apiClient.get<CuentaContable[]>('/contabilidad/cuentas/', { params: filtros })
  return data
}

export async function crearCuentaContable(datos: CuentaContableFormulario): Promise<CuentaContable> {
  const { data } = await apiClient.post<CuentaContable>('/contabilidad/cuentas/', datos)
  return data
}

export async function editarCuentaContable(id: number, datos: CuentaContableFormulario): Promise<CuentaContable> {
  const { data } = await apiClient.patch<CuentaContable>(`/contabilidad/cuentas/${id}/`, datos)
  return data
}

export async function desactivarCuentaContable(id: number): Promise<void> {
  await apiClient.delete(`/contabilidad/cuentas/${id}/`)
}

export async function reactivarCuentaContable(id: number): Promise<CuentaContable> {
  const { data } = await apiClient.post<CuentaContable>(`/contabilidad/cuentas/${id}/reactivar/`)
  return data
}

export async function getLibroDiario(filtros: FiltrosLibroDiario): Promise<AsientoContable[]> {
  const { data } = await apiClient.get<AsientoContable[]>('/contabilidad/asientos/', { params: filtros })
  return data
}

export async function getBalanceComprobacion(filtros: FiltrosBalance): Promise<FilaBalance[]> {
  const { data } = await apiClient.get<FilaBalance[]>('/contabilidad/balance/', { params: filtros })
  return data
}

export async function exportarContabilidad(
  tipo: TipoExportacion, filtros: FiltrosLibroDiario | FiltrosBalance = {},
): Promise<Blob> {
  const { data } = await apiClient.get('/contabilidad/exportar/', {
    params: { ...filtros, tipo, formato: 'csv' },
    responseType: 'blob',
  })
  return data
}
