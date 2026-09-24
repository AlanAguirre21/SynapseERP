import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { crearProduccion, getProduccion, getProducciones, type FiltrosProducciones } from '../api/produccion'

export function useProducciones(filtros: FiltrosProducciones) {
  return useQuery({
    queryKey: ['producciones', filtros],
    queryFn: () => getProducciones(filtros),
  })
}

export function useProduccion(id: number) {
  return useQuery({
    queryKey: ['produccion', id],
    queryFn: () => getProduccion(id),
  })
}

export function useCrearProduccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearProduccion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producciones'] })
      // Una producción confirmada consume materia prima y genera producto
      // terminado de inmediato — invalida también las cachés de
      // 009 · Inventario para que se reflejen sin recargar la página.
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
    },
  })
}
