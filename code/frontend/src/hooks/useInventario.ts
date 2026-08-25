import { useQuery } from '@tanstack/react-query'

import { getStock, type TipoItemInventario } from '../api/inventario'

export function useStock(tipo: TipoItemInventario, sucursalId: number | null) {
  return useQuery({
    queryKey: ['stock', tipo, sucursalId],
    queryFn: () => getStock(tipo, sucursalId as number),
    enabled: sucursalId !== null,
  })
}
