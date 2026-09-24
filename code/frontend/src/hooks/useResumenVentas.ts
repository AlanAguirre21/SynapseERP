import { useQuery } from '@tanstack/react-query'

import { getResumenVentas, type PeriodoDashboard } from '../api/reportes'

export function useResumenVentas(periodo: PeriodoDashboard) {
  return useQuery({
    queryKey: ['resumen-ventas', periodo],
    queryFn: () => getResumenVentas(periodo),
    staleTime: 30_000,
  })
}
