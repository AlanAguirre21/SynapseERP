import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearContactoEmergencia,
  eliminarContactoEmergencia,
  getContactosEmergencia,
  type ContactoEmergenciaFormulario,
} from '../api/rrhh'

export function useContactosEmergencia(empleadoId: number | null) {
  return useQuery({
    queryKey: ['contactos-emergencia', empleadoId],
    queryFn: () => getContactosEmergencia(empleadoId as number),
    enabled: empleadoId !== null,
  })
}

export function useCrearContactoEmergencia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: ContactoEmergenciaFormulario) => crearContactoEmergencia(datos),
    onSuccess: (contacto) =>
      queryClient.invalidateQueries({ queryKey: ['contactos-emergencia', contacto.empleado] }),
  })
}

export function useEliminarContactoEmergencia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: eliminarContactoEmergencia,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactos-emergencia'] }),
  })
}
