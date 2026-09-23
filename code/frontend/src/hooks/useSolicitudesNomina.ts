import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  aprobarSolicitudNomina,
  crearSolicitudNomina,
  getSolicitudesNominaPendientes,
  rechazarSolicitudNomina,
} from '../api/rrhh'

const CLAVE_SOLICITUDES_PENDIENTES = ['solicitudes-nomina-pendientes']

export function useCrearSolicitudNomina() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearSolicitudNomina,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SOLICITUDES_PENDIENTES }),
  })
}

// Consumido tanto por `RRHH.tsx` como por el dropdown de notificaciones del
// Header (spec.md: "se muestra como notificación en el dropdown del
// Header"). `staleTime` corto porque es información operativa que otro
// admin puede resolver en cualquier momento.
export function useSolicitudesNominaPendientes(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_SOLICITUDES_PENDIENTES,
    queryFn: getSolicitudesNominaPendientes,
    enabled: habilitado,
    staleTime: 30_000,
  })
}

export function useAprobarSolicitudNomina() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: aprobarSolicitudNomina,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SOLICITUDES_PENDIENTES }),
  })
}

export function useRechazarSolicitudNomina() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rechazarSolicitudNomina,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SOLICITUDES_PENDIENTES }),
  })
}
