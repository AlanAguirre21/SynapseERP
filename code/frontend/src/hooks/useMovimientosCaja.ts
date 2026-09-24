import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearMovimientoCaja,
  getMovimientosCaja,
  getSaldoCaja,
  type FiltrosMovimientosCaja,
} from '../api/caja'

export function useMovimientosCaja(filtros: FiltrosMovimientosCaja) {
  return useQuery({
    queryKey: ['movimientos-caja', filtros],
    queryFn: () => getMovimientosCaja(filtros),
  })
}

export function useSaldoCaja() {
  return useQuery({
    queryKey: ['saldo-caja'],
    queryFn: getSaldoCaja,
  })
}

export function useCrearMovimientoCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearMovimientoCaja,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos-caja'] })
      queryClient.invalidateQueries({ queryKey: ['saldo-caja'] })
    },
  })
}
