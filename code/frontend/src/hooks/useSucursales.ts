import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearSucursal,
  desactivarSucursal,
  editarSucursal,
  getSucursales,
  reactivarSucursal,
  type SucursalFormulario,
} from '../api/sucursales'

const CLAVE_SUCURSALES = ['sucursales']

export function useSucursales() {
  return useQuery({
    queryKey: CLAVE_SUCURSALES,
    queryFn: getSucursales,
  })
}

export function useCrearSucursal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearSucursal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SUCURSALES }),
  })
}

export function useEditarSucursal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: SucursalFormulario }) =>
      editarSucursal(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SUCURSALES }),
  })
}

export function useDesactivarSucursal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarSucursal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SUCURSALES }),
  })
}

export function useReactivarSucursal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarSucursal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SUCURSALES }),
  })
}
