export function obtenerIniciales(nombre: string | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean)

  const [primera, segunda] = palabras

  if (!primera) return ''
  if (!segunda) return primera.slice(0, 2).toUpperCase()

  return (primera.charAt(0) + segunda.charAt(0)).toUpperCase()
}
<<<<<<< HEAD
=======

// Texto comparable para búsquedas: minúsculas y sin acentos, para que
// "fisiologico" encuentre "Fisiológico". No toca guiones ni espacios internos.
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
