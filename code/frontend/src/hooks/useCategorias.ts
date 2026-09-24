import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearCategoria,
  desactivarCategoria,
  editarCategoria,
  getCategorias,
  reactivarCategoria,
  type CategoriaFormulario,
} from '../api/catalogo'

const CLAVE_CATEGORIAS = ['categorias']

export function useCategorias() {
  return useQuery({
    queryKey: CLAVE_CATEGORIAS,
    queryFn: getCategorias,
  })
}

export function useCrearCategoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearCategoria,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CATEGORIAS }),
  })
}

export function useEditarCategoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: CategoriaFormulario }) => editarCategoria(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CATEGORIAS }),
  })
}

export function useDesactivarCategoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarCategoria,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CATEGORIAS }),
  })
}

export function useReactivarCategoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarCategoria,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CATEGORIAS }),
  })
}
