import { useQuery } from '@tanstack/react-query'

import { getResumenCompras, type PeriodoDashboard } from '../api/reportes'

export function useResumenCompras(periodo: PeriodoDashboard) {
  return useQuery({
    queryKey: ['resumen-compras', periodo],
    queryFn: () => getResumenCompras(periodo),
    staleTime: 30_000,
  })
}
