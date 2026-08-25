import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearCliente,
  desactivarCliente,
  editarCliente,
  getClientes,
  reactivarCliente,
  type ClienteFormulario,
} from '../api/personas'

const CLAVE_CLIENTES = ['clientes']

export function useClientes() {
  return useQuery({
    queryKey: CLAVE_CLIENTES,
    queryFn: getClientes,
  })
}

export function useCrearCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearCliente,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CLIENTES }),
  })
}

export function useEditarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ClienteFormulario }) => editarCliente(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CLIENTES }),
  })
}

export function useDesactivarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarCliente,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CLIENTES }),
  })
}

export function useReactivarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarCliente,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CLIENTES }),
  })
}
