import { useQuery } from '@tanstack/react-query'

import { getProductosTop, type OrdenTop, type PeriodoDashboard } from '../api/reportes'

export function useProductosTop(periodo: PeriodoDashboard, orden: OrdenTop) {
  return useQuery({
    queryKey: ['productos-top', periodo, orden],
    queryFn: () => getProductosTop(periodo, orden),
    staleTime: 30_000,
  })
}
