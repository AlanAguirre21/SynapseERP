import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  aprobarSolicitudNomina,
  crearSolicitudNomina,
  editarMontoSolicitudNomina,
  generarNomina,
  getSolicitudesNomina,
  getSolicitudesNominaPendientes,
  pagarSolicitudesNomina,
  rechazarSolicitudNomina,
  revertirPagoNomina,
  type FiltrosSolicitudesNomina,
} from '../api/rrhh'

// Prefijo común: invalidarlo refresca la lista de la pestaña "Nóminas" y las
// pendientes de la campana del Header a la vez.
const CLAVE_NOMINA = ['solicitudes-nomina']

function invalidarNomina(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: CLAVE_NOMINA })
}

// Pagar o revertir mueve la caja: también cambian el saldo, los movimientos
// de Caja, el resumen del Dashboard y los asientos de Contabilidad.
function invalidarNominaYCaja(queryClient: QueryClient) {
  return Promise.all([
    invalidarNomina(queryClient),
    queryClient.invalidateQueries({ queryKey: ['saldo-caja'] }),
    queryClient.invalidateQueries({ queryKey: ['movimientos-caja'] }),
    queryClient.invalidateQueries({ queryKey: ['movimientos-caja-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['resumen-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['contabilidad'] }),
  ])
}

export function useSolicitudesNomina(filtros: FiltrosSolicitudesNomina) {
  return useQuery({
    queryKey: [...CLAVE_NOMINA, 'lista', filtros],
    queryFn: () => getSolicitudesNomina(filtros),
  })
}

// Consumido por la campana del Header (solo admin). `staleTime` corto porque
// otro admin puede resolverlas en cualquier momento.
export function useSolicitudesNominaPendientes(habilitado = true) {
  return useQuery({
    queryKey: [...CLAVE_NOMINA, 'pendientes'],
    queryFn: getSolicitudesNominaPendientes,
    enabled: habilitado,
    staleTime: 30_000,
  })
}

export function useCrearSolicitudNomina() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: crearSolicitudNomina, onSuccess: () => invalidarNomina(queryClient) })
}

export function useGenerarNomina() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: generarNomina, onSuccess: () => invalidarNomina(queryClient) })
}

export function useEditarMontoNomina() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: string }) => editarMontoSolicitudNomina(id, monto),
    onSuccess: () => invalidarNomina(queryClient),
  })
}

// Aprueba y paga una solicitud (retiro de Caja).
export function useAprobarSolicitudNomina() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: aprobarSolicitudNomina, onSuccess: () => invalidarNominaYCaja(queryClient) })
}

export function usePagarSolicitudesNomina() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: pagarSolicitudesNomina, onSuccess: () => invalidarNominaYCaja(queryClient) })
}

export function useRechazarSolicitudNomina() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: rechazarSolicitudNomina, onSuccess: () => invalidarNomina(queryClient) })
}

export function useRevertirPagoNomina() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) => revertirPagoNomina(id, motivo),
    onSuccess: () => invalidarNominaYCaja(queryClient),
  })
}
