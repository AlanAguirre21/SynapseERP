import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearPosicion,
  desactivarPosicion,
  editarPosicion,
  getPosiciones,
<<<<<<< HEAD
=======
  getTodasLasPosiciones,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  reactivarPosicion,
  type PosicionFormulario,
} from '../api/rrhh'

<<<<<<< HEAD
=======
const CLAVE_TODAS = ['posiciones', 'todas'] as const

// Posiciones de toda la empresa (directorio y vacantes de RRHH).
export function useTodasLasPosiciones() {
  return useQuery({
    queryKey: CLAVE_TODAS,
    queryFn: getTodasLasPosiciones,
  })
}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
export function usePosiciones(departamentoId: number | null) {
  return useQuery({
    queryKey: ['posiciones', departamentoId],
    queryFn: () => getPosiciones(departamentoId as number),
    enabled: departamentoId !== null,
  })
}

export function useCrearPosicion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearPosicion,
<<<<<<< HEAD
    onSuccess: (posicion) =>
      queryClient.invalidateQueries({ queryKey: ['posiciones', posicion.departamento] }),
=======
    onSuccess: (posicion) => {
      queryClient.invalidateQueries({ queryKey: ['posiciones', posicion.departamento] })
      // La clave del departamento no alcanza a la lista completa.
      queryClient.invalidateQueries({ queryKey: CLAVE_TODAS })
    },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  })
}

export function useEditarPosicion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: PosicionFormulario }) => editarPosicion(id, datos),
<<<<<<< HEAD
    onSuccess: (posicion) =>
      queryClient.invalidateQueries({ queryKey: ['posiciones', posicion.departamento] }),
=======
    onSuccess: (posicion) => {
      queryClient.invalidateQueries({ queryKey: ['posiciones', posicion.departamento] })
      // La clave del departamento no alcanza a la lista completa.
      queryClient.invalidateQueries({ queryKey: CLAVE_TODAS })
    },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  })
}

export function useDesactivarPosicion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarPosicion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posiciones'] }),
  })
}

export function useReactivarPosicion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarPosicion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posiciones'] }),
  })
}
