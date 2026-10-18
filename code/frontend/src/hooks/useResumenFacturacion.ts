import { useQuery } from '@tanstack/react-query'

import { getResumenFacturacion, type PeriodoDashboard } from '../api/reportes'

export function useResumenFacturacion(periodo: PeriodoDashboard) {
  return useQuery({
    queryKey: ['resumen-facturacion', periodo],
    queryFn: () => getResumenFacturacion(periodo),
    staleTime: 30_000,
  })
}
