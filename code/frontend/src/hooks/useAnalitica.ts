import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  generarPronosticos,
  getDemandaPronosticada,
  getGeneracionesPronostico,
  getPronosticos,
  getProyeccionDashboard,
  getVistaPronostico,
  type FiltrosVistaPronostico,
  type HorizonteEstandar,
  type HorizontePronostico,
  type MetricaPronostico,
  type PeriodoProyeccion,
} from '../api/analitica'

// Prefijo común: una generación nueva invalida pestaña, vistas vinculadas y
// proyección del Dashboard a la vez. Todo `023` es solo admin en el backend:
// cada hook recibe `habilitado` (= esAdmin) para que el operador ni siquiera
// dispare las consultas en módulos que sí ve.
const CLAVE_ANALITICA = ['analitica']
const UNA_HORA = 60 * 60 * 1000

export function useVistaPronostico(filtros: FiltrosVistaPronostico, habilitado = true) {
  return useQuery({
    queryKey: [...CLAVE_ANALITICA, 'vista', filtros],
    queryFn: () => getVistaPronostico(filtros),
    enabled: habilitado,
    // Los pronósticos cambian una vez por semana (o al generar a mano).
    staleTime: UNA_HORA,
  })
}

export function useGeneracionesPronostico(horizonte?: HorizontePronostico, habilitado = true) {
  return useQuery({
    queryKey: [...CLAVE_ANALITICA, 'generaciones', horizonte ?? 'todas'],
    queryFn: () => getGeneracionesPronostico(horizonte),
    enabled: habilitado,
  })
}

export function usePronosticosDeGeneracion(generacion: number | undefined, metrica: MetricaPronostico) {
  return useQuery({
    queryKey: [...CLAVE_ANALITICA, 'pronosticos', generacion, metrica],
    queryFn: () => getPronosticos({ generacion: generacion as number, metrica }),
    enabled: generacion !== undefined,
    staleTime: UNA_HORA,
  })
}

export function useGenerarPronosticos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generarPronosticos,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_ANALITICA }),
  })
}

export function useProyeccionDashboard(periodo: PeriodoProyeccion | null, habilitado = true) {
  return useQuery({
    queryKey: [...CLAVE_ANALITICA, 'proyeccion-dashboard', periodo],
    queryFn: () => getProyeccionDashboard(periodo as PeriodoProyeccion),
    enabled: habilitado && periodo !== null,
  })
}

export function useDemandaPronosticada(
  horizonte: HorizonteEstandar,
  limite?: number,
  habilitado = true,
  generacion?: number,
) {
  return useQuery({
    queryKey: [...CLAVE_ANALITICA, 'demanda', horizonte, limite ?? 'todos', generacion ?? 'vigente'],
    queryFn: () => getDemandaPronosticada(horizonte, limite, generacion),
    enabled: habilitado,
    staleTime: UNA_HORA,
  })
}
