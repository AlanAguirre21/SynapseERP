import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  cancelarVenta,
  crearVenta,
  entregarVenta,
  getVenta,
  getVentas,
  type FiltrosVentas,
} from '../api/ventas'

export function useVentas(filtros: FiltrosVentas) {
  return useQuery({
    queryKey: ['ventas', filtros],
    queryFn: () => getVentas(filtros),
  })
}

export function useVenta(id: number) {
  return useQuery({
    queryKey: ['venta', id],
    queryFn: () => getVenta(id),
  })
}

// Crear/cancelar una venta cambia stock y caja de inmediato (a diferencia
// de Compras, donde solo "recibir" lo hace) — invalida también las
// cachés de 009 · Inventario para que se reflejen sin recargar la página.
function invalidarInventario(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['stock'] })
  queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
}

export function useCrearVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearVenta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      invalidarInventario(queryClient)
    },
  })
}

export function useEntregarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: entregarVenta,
    onSuccess: (venta) => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      queryClient.invalidateQueries({ queryKey: ['venta', venta.id] })
    },
  })
}

export function useCancelarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelarVenta,
    onSuccess: (venta) => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      queryClient.invalidateQueries({ queryKey: ['venta', venta.id] })
      invalidarInventario(queryClient)
    },
  })
}
