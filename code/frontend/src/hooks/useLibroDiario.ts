import { useMutation, useQuery } from '@tanstack/react-query'

import { exportarContabilidad, getLibroDiario, type FiltrosLibroDiario, type TipoExportacion } from '../api/contabilidad'

export function useLibroDiario(filtros: FiltrosLibroDiario) {
  return useQuery({
    queryKey: ['contabilidad', 'libro-diario', filtros],
    queryFn: () => getLibroDiario(filtros),
  })
}

// Compartido con `useBalanceComprobacion` — ambas vistas (libro diario y
// balance) exportan a través del mismo endpoint, solo cambia `tipo`.
export function useExportarContabilidad() {
  return useMutation({
    mutationFn: ({ tipo, filtros }: { tipo: TipoExportacion; filtros?: FiltrosLibroDiario }) =>
      exportarContabilidad(tipo, filtros),
  })
}
