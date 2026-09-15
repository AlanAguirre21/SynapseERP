import type { PeriodoDashboard } from '../../../api/reportes'

export function formatearMoneda(valor: string | number) {
  return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatearEtiquetaFecha(fecha: string, periodo: PeriodoDashboard) {
  const valor = new Date(fecha)
  if (periodo === 'dia') {
    return valor.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  if (periodo === 'año') {
    return valor.toLocaleDateString('es-MX', { month: 'short' })
  }
  return valor.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
}

export function formatearFechaMovimiento(fecha: string) {
  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
