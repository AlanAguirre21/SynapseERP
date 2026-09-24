import { useQuery } from '@tanstack/react-query'

import { getAlertasStock } from '../api/inventario'

export function useAlertasStock() {
  return useQuery({
    queryKey: ['alertas-stock'],
    queryFn: getAlertasStock,
    staleTime: 60_000,
    retry: false,
  })
}
