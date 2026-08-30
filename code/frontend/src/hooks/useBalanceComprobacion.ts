import { useQuery } from '@tanstack/react-query'

import { getBalanceComprobacion, type FiltrosBalance } from '../api/contabilidad'

export function useBalanceComprobacion(filtros: FiltrosBalance) {
  return useQuery({
    queryKey: ['contabilidad', 'balance', filtros],
    queryFn: () => getBalanceComprobacion(filtros),
  })
}
