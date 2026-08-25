import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearEmpleado,
  desactivarEmpleado,
  editarEmpleado,
  getEmpleados,
  reactivarEmpleado,
  type EmpleadoFormulario,
} from '../api/personas'

const CLAVE_EMPLEADOS = ['empleados']

export function useEmpleados() {
  return useQuery({
    queryKey: CLAVE_EMPLEADOS,
    queryFn: getEmpleados,
  })
}

export function useCrearEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearEmpleado,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS }),
  })
}

export function useEditarEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: EmpleadoFormulario }) => editarEmpleado(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS }),
  })
}

export function useDesactivarEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarEmpleado,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS }),
  })
}

export function useReactivarEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarEmpleado,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS }),
  })
}
