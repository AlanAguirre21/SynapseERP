import { useQuery } from '@tanstack/react-query'

import { getMovimientosCajaReporte, type LimiteMovimientos, type PeriodoDashboard } from '../api/reportes'

export function useMovimientosCajaDashboard(periodo: PeriodoDashboard, limite: LimiteMovimientos) {
  return useQuery({
    queryKey: ['movimientos-caja-dashboard', periodo, limite],
    queryFn: () => getMovimientosCajaReporte(periodo, limite),
    staleTime: 30_000,
  })
}
