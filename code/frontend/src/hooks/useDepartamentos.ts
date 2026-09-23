import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearDepartamento,
  desactivarDepartamento,
  editarDepartamento,
  getDepartamentos,
  reactivarDepartamento,
  type DepartamentoFormulario,
} from '../api/rrhh'

const CLAVE_DEPARTAMENTOS = ['departamentos']

export function useDepartamentos() {
  return useQuery({
    queryKey: CLAVE_DEPARTAMENTOS,
    queryFn: getDepartamentos,
  })
}

export function useCrearDepartamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearDepartamento,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_DEPARTAMENTOS }),
  })
}

export function useEditarDepartamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DepartamentoFormulario }) => editarDepartamento(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_DEPARTAMENTOS }),
  })
}

export function useDesactivarDepartamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarDepartamento,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_DEPARTAMENTOS }),
  })
}

export function useReactivarDepartamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarDepartamento,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_DEPARTAMENTOS }),
  })
}
