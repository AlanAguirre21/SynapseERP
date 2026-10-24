import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { crearTraslado, editarStockMinimo, getStock, type TipoItemInventario } from '../api/inventario'

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

export function useCrearTraslado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearTraslado,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] }),
        queryClient.invalidateQueries({ queryKey: ['alertas-stock'] }),
      ]),
  })
}
