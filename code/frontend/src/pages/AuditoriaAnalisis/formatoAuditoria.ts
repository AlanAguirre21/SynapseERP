import type {
  CategoriaDiscrepancia,
  EstadoConteo,
  EstadoCorte,
  EstadoDiscrepancia,
  EstadoEjecucion,
  OrigenEjecucion,
  TipoAuditoria,
} from '../../api/auditoria'
import type { TipoItemInventario } from '../../api/inventario'
import { formatearMoneda } from '../../utils/moneda'

export const ETIQUETAS_TIPO_AUDITORIA: Record<TipoAuditoria, string> = {
  caja: 'Conciliación de caja',
  inventario: 'Auditoría de inventario',
}

export const ETIQUETAS_ORIGEN: Record<OrigenEjecucion, string> = {
  programada: 'Programada',
  manual: 'Manual',
}

export const ETIQUETAS_ESTADO_EJECUCION: Record<EstadoEjecucion, string> = {
  en_curso: 'En curso',
  exitosa: 'Exitosa',
  fallida: 'Fallida',
}

export const ETIQUETAS_CATEGORIA: Record<CategoriaDiscrepancia, string> = {
  caja_corte: 'Corte de caja',
  caja_integridad: 'Integridad del libro de caja',
  inventario_conteo: 'Conteo físico',
  inventario_integridad: 'Integridad del libro de inventario',
}

export const ETIQUETAS_ESTADO_DISCREPANCIA: Record<EstadoDiscrepancia, string> = {
  abierta: 'Abierta',
  ajustada: 'Ajustada',
  justificada: 'Justificada',
}

export const ETIQUETAS_ESTADO_CORTE: Record<EstadoCorte, string> = {
  pendiente: 'Pendiente',
  auditado: 'Auditado',
  reemplazado: 'Reemplazado',
}

export const ETIQUETAS_ESTADO_CONTEO: Record<EstadoConteo, string> = {
  pendiente: 'Pendiente',
  auditado: 'Auditado',
  descartado: 'Descartado',
}

export const ETIQUETAS_TIPO_ITEM: Record<TipoItemInventario, string> = {
  producto: 'Producto',
  materia_prima: 'Materia prima',
}

export function claseEstadoEjecucion(estado: EstadoEjecucion): string {
  if (estado === 'exitosa') return 'status statusSuccess'
  if (estado === 'fallida') return 'status statusError'
  return 'status statusNeutral'
}

export function claseEstadoDiscrepancia(estado: EstadoDiscrepancia): string {
  return estado === 'abierta' ? 'status statusWarning' : 'status statusSuccess'
}

export function claseEstadoRegistro(estado: EstadoCorte | EstadoConteo): string {
  if (estado === 'auditado') return 'status statusSuccess'
  if (estado === 'pendiente') return 'status statusWarning'
  return 'status statusNeutral'
}

export function formatearFechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// Las discrepancias de caja son dinero; las de inventario, cantidades.
export function formatearValor(categoria: CategoriaDiscrepancia, valor: string): string {
  return categoria.startsWith('caja') ? formatearMoneda(valor) : Number(valor).toLocaleString('es-MX')
}

// Diferencia con signo explícito: faltante (−) en rojo, sobrante (+) en verde.
export function formatearDiferencia(categoria: CategoriaDiscrepancia, diferencia: string): string {
  const numero = Number(diferencia)
  const absoluto = formatearValor(categoria, String(Math.abs(numero)))
  if (numero > 0) return `+${absoluto}`
  if (numero < 0) return `−${absoluto}`
  return absoluto
}

export function claseDiferencia(diferencia: string): string {
  const numero = Number(diferencia)
  if (numero < 0) return 'textError'
  if (numero > 0) return 'textSuccess'
  return ''
}

export function extraerMensajeError(err: unknown, mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined
  const primerTexto = (valor: unknown): string | undefined => {
    if (typeof valor === 'string') return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
    return undefined
  }

  if (typeof datos?.detail === 'string') return datos.detail

  // Errores por línea de un conteo: `detalles` llega como arreglo de objetos.
  const detalles = datos?.detalles
  if (Array.isArray(detalles)) {
    for (const [indice, erroresLinea] of detalles.entries()) {
      if (!erroresLinea || typeof erroresLinea !== 'object') continue
      for (const valor of Object.values(erroresLinea as Record<string, unknown>)) {
        const texto = primerTexto(valor)
        if (texto) return `Línea ${indice + 1}: ${texto}`
      }
    }
  }

  for (const valor of Object.values(datos ?? {})) {
    const texto = primerTexto(valor)
    if (texto) return texto
  }
  return mensajePorDefecto
}
