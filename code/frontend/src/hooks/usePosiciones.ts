import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearPosicion,
  desactivarPosicion,
  editarPosicion,
  getPosiciones,
  getTodasLasPosiciones,
  reactivarPosicion,
  type PosicionFormulario,
} from '../api/rrhh'

const CLAVE_TODAS = ['posiciones', 'todas'] as const

// Posiciones de toda la empresa (directorio y vacantes de RRHH).
export function useTodasLasPosiciones() {
  return useQuery({
    queryKey: CLAVE_TODAS,
    queryFn: getTodasLasPosiciones,
  })
}

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
    onSuccess: (posicion) => {
      queryClient.invalidateQueries({ queryKey: ['posiciones', posicion.departamento] })
      // La clave del departamento no alcanza a la lista completa.
      queryClient.invalidateQueries({ queryKey: CLAVE_TODAS })
    },
  })
}

export function useEditarPosicion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: PosicionFormulario }) => editarPosicion(id, datos),
    onSuccess: (posicion) => {
      queryClient.invalidateQueries({ queryKey: ['posiciones', posicion.departamento] })
      // La clave del departamento no alcanza a la lista completa.
      queryClient.invalidateQueries({ queryKey: CLAVE_TODAS })
    },
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
