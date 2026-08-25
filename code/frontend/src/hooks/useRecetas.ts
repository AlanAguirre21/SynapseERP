import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearReceta,
  desactivarReceta,
  editarReceta,
  getRecetas,
  reactivarReceta,
  type RecetaFormulario,
} from '../api/produccion'

const CLAVE_RECETAS = ['recetas']

export function useRecetas(productoId?: number) {
  return useQuery({
    queryKey: [...CLAVE_RECETAS, productoId ?? null],
    queryFn: () => getRecetas(productoId),
  })
}

export function useCrearReceta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearReceta,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_RECETAS }),
  })
}

export function useEditarReceta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: RecetaFormulario }) => editarReceta(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_RECETAS }),
  })
}

export function useDesactivarReceta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarReceta,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_RECETAS }),
  })
}

export function useReactivarReceta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarReceta,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_RECETAS }),
  })
}
