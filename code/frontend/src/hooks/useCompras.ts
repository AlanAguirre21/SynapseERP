import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  cancelarCompra,
  crearCompra,
  getCompra,
  getCompras,
  recibirCompra,
  type FiltrosCompras,
} from '../api/compras'

export function useCompras(filtros: FiltrosCompras) {
  return useQuery({
    queryKey: ['compras', filtros],
    queryFn: () => getCompras(filtros),
  })
}

export function useCompra(id: number) {
  return useQuery({
    queryKey: ['compra', id],
    queryFn: () => getCompra(id),
  })
}

export function useCrearCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearCompra,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['compras'] }),
  })
}

// Recibir/cancelar una compra cambia stock y genera movimientos — invalida
// también las cachés de la feature 009 · Inventario (`stock`,
// `movimientos-inventario`) para que se reflejen sin recargar la página.
// También invalida 014 · Dashboard: a diferencia de Ventas, una compra
// solo cuenta para "compras totales" al quedar `recibida` (nunca al
// crearse `pendiente`) — por eso `useCrearCompra` no la invalida, pero
// `recibir()`/`cancelar()` sí, que son los que cambian ese estado.
function invalidarComprasEInventario(queryClient: QueryClient, idCompra: number) {
  queryClient.invalidateQueries({ queryKey: ['compras'] })
  queryClient.invalidateQueries({ queryKey: ['compra', idCompra] })
  queryClient.invalidateQueries({ queryKey: ['stock'] })
  queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
  queryClient.invalidateQueries({ queryKey: ['resumen-dashboard'] })
}

export function useRecibirCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recibirCompra,
    onSuccess: (compra) => invalidarComprasEInventario(queryClient, compra.id),
  })
}

export function useCancelarCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelarCompra,
    onSuccess: (compra) => invalidarComprasEInventario(queryClient, compra.id),
  })
}
