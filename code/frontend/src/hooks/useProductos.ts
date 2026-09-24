import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearProducto,
  desactivarProducto,
  editarProducto,
  getProductos,
  reactivarProducto,
  type ProductoFormulario,
} from '../api/catalogo'

const CLAVE_PRODUCTOS = ['productos']

export function useProductos() {
  return useQuery({
    queryKey: CLAVE_PRODUCTOS,
    queryFn: getProductos,
  })
}

export function useCrearProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearProducto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PRODUCTOS }),
  })
}

export function useEditarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ProductoFormulario }) => editarProducto(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PRODUCTOS }),
  })
}

export function useDesactivarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarProducto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PRODUCTOS }),
  })
}

export function useReactivarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarProducto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PRODUCTOS }),
  })
}
