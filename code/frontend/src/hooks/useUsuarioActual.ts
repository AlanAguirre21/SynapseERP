import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { actualizarMiInformacion, getUsuarioActual } from '../api/usuarios'

const CLAVE_USUARIO_ACTUAL = ['usuario-actual']

export function useUsuarioActual() {
  return useQuery({
    queryKey: CLAVE_USUARIO_ACTUAL,
    queryFn: getUsuarioActual,
    retry: false,
    // `staleTime: 0` (explícito, aunque coincide con el default de React
    // Query) para que un admin desactivando a este usuario desde otra
    // sesión se refleje en el próximo refetch (montaje/refoco de ventana),
    // no quede escondido detrás de una copia en caché todavía "fresca".
    staleTime: 0,
  })
}

export function useActualizarMiInformacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: actualizarMiInformacion,
    // Invalida la caché (en vez de solo escribir la respuesta con
    // `setQueryData`) para que el Header y cualquier otra vista que lea
    // `useUsuarioActual` recarguen el dato desde el servidor de inmediato.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_USUARIO_ACTUAL }),
  })
}
