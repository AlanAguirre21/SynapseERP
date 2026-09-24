import { useQuery } from '@tanstack/react-query'

import { getMovimientosInventario, type FiltrosMovimientosInventario } from '../api/inventario'

export function useMovimientosInventario(filtros: FiltrosMovimientosInventario) {
  return useQuery({
    queryKey: ['movimientos-inventario', filtros],
    queryFn: () => getMovimientosInventario(filtros),
  })
}
