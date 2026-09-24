import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { editarStockMinimo, getStock, type TipoItemInventario } from '../api/inventario'

export function useStock(tipo: TipoItemInventario, sucursalId: number | null) {
  return useQuery({
    queryKey: ['stock', tipo, sucursalId],
    queryFn: () => getStock(tipo, sucursalId as number),
    enabled: sucursalId !== null,
  })
}

export function useEditarStockMinimo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: editarStockMinimo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock'] }),
  })
}
