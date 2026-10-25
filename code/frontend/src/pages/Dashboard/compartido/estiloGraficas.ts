// Estilo compartido de todas las gráficas del Dashboard. recharts recibe estos
// valores como props de configuración; siempre apuntan a tokens de index.css.

export const COLOR_REJILLA = 'var(--color-borde)'

export const MARCA_EJE = { fill: 'var(--color-texto-suave)', fontSize: 12 }

export const ETIQUETA_EJE = { fill: 'var(--color-texto-suave)', fontSize: 11 }

export const MARGEN_GRAFICA = { top: 8, right: 12, left: 0, bottom: 0 }

export const ESTILO_TOOLTIP = {
  backgroundColor: 'var(--color-superficie)',
  border: '1px solid var(--color-borde)',
  borderRadius: 'var(--radius-control)',
  boxShadow: 'var(--shadow-marcada)',
  color: 'var(--color-texto)',
  fontSize: 13,
}

export const ESTILO_LEYENDA = { fontSize: 12, color: 'var(--color-texto-suave)' }

export const CURSOR_TOOLTIP = { fill: 'var(--color-primario-suave)', opacity: 0.4 }

const formatoCompacto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 })

// Marca del eje Y: 1500 -> "1.5 k", para que los montos grandes no ensanchen el eje.
export function formatearCompacto(valor: number) {
  return formatoCompacto.format(valor)
}
