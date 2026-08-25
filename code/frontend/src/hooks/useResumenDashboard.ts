import { useQuery } from '@tanstack/react-query'

import { getResumenDashboard, type PeriodoDashboard } from '../api/reportes'

export function useResumenDashboard(periodo: PeriodoDashboard) {
  return useQuery({
    queryKey: ['resumen-dashboard', periodo],
    queryFn: () => getResumenDashboard(periodo),
    // Corto a propósito (a diferencia de módulos más estáticos como
    // Catálogo/Sucursales): el dashboard debe reflejar una venta/compra
    // recién registrada al volver a esta pantalla, sin recarga manual.
    staleTime: 30_000,
  })
}
