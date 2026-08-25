import { useQuery } from '@tanstack/react-query'

import { getUsuarioActual } from '../api/usuarios'

export function useUsuarioActual() {
  return useQuery({
    queryKey: ['usuario-actual'],
    queryFn: getUsuarioActual,
    retry: false,
    // `staleTime: 0` (explícito, aunque coincide con el default de React
    // Query) para que un admin desactivando a este usuario desde otra
    // sesión se refleje en el próximo refetch (montaje/refoco de ventana),
    // no quede escondido detrás de una copia en caché todavía "fresca".
    staleTime: 0,
  })
}
