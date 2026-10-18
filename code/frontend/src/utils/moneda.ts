// Formato de moneda para mostrar en pantalla: 1234.5 -> "$1,234.50".
export function formatearMoneda(valor: string | number): string {
  return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
