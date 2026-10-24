// Importe en formato de reporte contable: miles y dos decimales, sin signo de
// moneda. 101370 -> "101,370.00"; 100169.5 -> "100,169.50".
export function formatearImporte(valor: string | number): string {
  return Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
