import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearProveedor,
  desactivarProveedor,
  editarProveedor,
  getProveedores,
  reactivarProveedor,
  type ProveedorFormulario,
} from '../api/personas'

const CLAVE_PROVEEDORES = ['proveedores']

export function useProveedores() {
  return useQuery({
    queryKey: CLAVE_PROVEEDORES,
    queryFn: getProveedores,
  })
}

export function useCrearProveedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearProveedor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PROVEEDORES }),
  })
}

export function useEditarProveedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ProveedorFormulario }) => editarProveedor(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PROVEEDORES }),
  })
}

export function useDesactivarProveedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarProveedor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PROVEEDORES }),
  })
}

export function useReactivarProveedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarProveedor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PROVEEDORES }),
  })
}
