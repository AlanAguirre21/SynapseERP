// `true` si la petición falló con 404 (el recurso no existe o, para el
// operador, pertenece a otro usuario y el backend no revela que existe).
export function esNoEncontrado(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  )
}
