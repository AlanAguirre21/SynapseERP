import { apiClient } from './client'

export type EstadoFactura = 'pendiente' | 'timbrada' | 'pendiente_cancelacion' | 'cancelada' | 'error'
export type MetodoPago = 'PUE' | 'PPD'
export type MotivoCancelacion = '01' | '02' | '03' | '04'

// Catálogos del SAT usados por los formularios de esta feature — vigentes
// al momento de construir `017 · Facturación` (ver checklist de
// mantenimiento en `tasks.md`: revisar si el SAT publica cambios).
export const USOS_CFDI: { valor: string; etiqueta: string }[] = [
  { valor: 'G01', etiqueta: 'G01 — Adquisición de mercancías' },
  { valor: 'G03', etiqueta: 'G03 — Gastos en general' },
  { valor: 'I01', etiqueta: 'I01 — Construcciones' },
  { valor: 'P01', etiqueta: 'P01 — Por definir' },
  { valor: 'S01', etiqueta: 'S01 — Sin efectos fiscales' },
]

export const FORMAS_PAGO: { valor: string; etiqueta: string }[] = [
  { valor: '01', etiqueta: '01 — Efectivo' },
  { valor: '03', etiqueta: '03 — Transferencia electrónica de fondos' },
  { valor: '04', etiqueta: '04 — Tarjeta de crédito' },
  { valor: '28', etiqueta: '28 — Tarjeta de débito' },
  { valor: '99', etiqueta: '99 — Por definir' },
]

export const METODOS_PAGO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'PUE', etiqueta: 'PUE — Pago en una sola exhibición' },
  { valor: 'PPD', etiqueta: 'PPD — Pago en parcialidades o diferido' },
]

export const MOTIVOS_CANCELACION: { valor: MotivoCancelacion; etiqueta: string }[] = [
  { valor: '01', etiqueta: '01 — Comprobante emitido con errores con relación' },
  { valor: '02', etiqueta: '02 — Comprobante emitido con errores sin relación' },
  { valor: '03', etiqueta: '03 — No se llevó a cabo la operación' },
  { valor: '04', etiqueta: '04 — Operación nominativa relacionada en una factura global' },
]

export const ETIQUETAS_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  pendiente: 'Pendiente',
  timbrada: 'Timbrada',
  pendiente_cancelacion: 'Pendiente de cancelación',
  cancelada: 'Cancelada',
  error: 'Error',
}

export interface Factura {
  id: number
  venta: number
  venta_total: string
  cliente_nombre: string
  usuario: number
  usuario_nombre: string
  folio_fiscal: string
  serie: string
  folio_interno: number | null
  uso_cfdi: string
  forma_pago: string
  metodo_pago: MetodoPago
  estado: EstadoFactura
  mensaje_error: string
  motivo_cancelacion: MotivoCancelacion | ''
  fecha_solicitud_cancelacion: string | null
  fecha_creacion: string
  fecha_timbrado: string | null
}

export interface FacturaFormulario {
  venta: number
  uso_cfdi: string
  forma_pago: string
  metodo_pago: MetodoPago
}

export interface FiltrosFacturas {
  estado?: EstadoFactura
  cliente?: number
  fecha_desde?: string
  fecha_hasta?: string
}

export interface ComplementoPago {
  id: number
  factura: number
  usuario: number
  monto_pagado: string
  fecha_pago: string
  folio_fiscal_rep: string
  estado: 'timbrada' | 'error'
  mensaje_error: string
  fecha_creacion: string
}

export interface ComplementoPagoFormulario {
  factura: number
  monto_pagado: string
  fecha_pago: string
}

export async function getFacturas(filtros: FiltrosFacturas): Promise<Factura[]> {
  const { data } = await apiClient.get<Factura[]>('/facturacion/', { params: filtros })
  return data
}

export async function getFactura(id: number): Promise<Factura> {
  const { data } = await apiClient.get<Factura>(`/facturacion/${id}/`)
  return data
}

export async function generarFactura(datos: FacturaFormulario): Promise<Factura> {
  const { data } = await apiClient.post<Factura>('/facturacion/', datos)
  return data
}

export async function cancelarFactura(id: number, motivo_cancelacion: MotivoCancelacion): Promise<Factura> {
  const { data } = await apiClient.post<Factura>(`/facturacion/${id}/cancelar/`, { motivo_cancelacion })
  return data
}

export async function descargarXmlFactura(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/facturacion/${id}/descargar-xml/`, { responseType: 'blob' })
  return data
}

export async function descargarPdfFactura(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/facturacion/${id}/descargar-pdf/`, { responseType: 'blob' })
  return data
}

export async function getComplementosPago(facturaId: number): Promise<ComplementoPago[]> {
  const { data } = await apiClient.get<ComplementoPago[]>('/facturacion/complementos-pago/', {
    params: { factura: facturaId },
  })
  return data
}

export async function registrarComplementoPago(datos: ComplementoPagoFormulario): Promise<ComplementoPago> {
  const { data } = await apiClient.post<ComplementoPago>('/facturacion/complementos-pago/', datos)
  return data
}
