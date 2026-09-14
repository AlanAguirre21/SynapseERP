import { useQuery } from '@tanstack/react-query'

import { getClientesTop, type OrdenTop, type PeriodoDashboard } from '../api/reportes'

export function useClientesTop(periodo: PeriodoDashboard, orden: OrdenTop) {
  return useQuery({
    queryKey: ['clientes-top', periodo, orden],
    queryFn: () => getClientesTop(periodo, orden),
    staleTime: 30_000,
  })
}
