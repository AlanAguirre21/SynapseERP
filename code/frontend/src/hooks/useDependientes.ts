import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearDependiente,
  eliminarDependiente,
  getDependientes,
  type DependienteFormulario,
} from '../api/rrhh'

export function useDependientes(empleadoId: number | null) {
  return useQuery({
    queryKey: ['dependientes', empleadoId],
    queryFn: () => getDependientes(empleadoId as number),
    enabled: empleadoId !== null,
  })
}

export function useCrearDependiente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: DependienteFormulario) => crearDependiente(datos),
    onSuccess: (dependiente) =>
      queryClient.invalidateQueries({ queryKey: ['dependientes', dependiente.empleado] }),
  })
}

export function useEliminarDependiente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: eliminarDependiente,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dependientes'] }),
  })
}
