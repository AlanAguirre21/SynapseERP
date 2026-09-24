export function obtenerIniciales(nombre: string | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean)

  const [primera, segunda] = palabras

  if (!primera) return ''
  if (!segunda) return primera.slice(0, 2).toUpperCase()

  return (primera.charAt(0) + segunda.charAt(0)).toUpperCase()
}
