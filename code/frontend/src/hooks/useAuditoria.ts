import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  ajustarDiscrepancia,
  crearConteoFisico,
  crearCorteCaja,
  descartarConteoFisico,
  ejecutarAuditoria,
  getConteosFisicos,
  getCortesCaja,
  getDiscrepancias,
  getEjecucionesAuditoria,
  getResumenAuditoria,
  justificarDiscrepancia,
  type FiltrosDiscrepancias,
  type TipoAuditoria,
} from '../api/auditoria'

// Prefijo común: invalidarlo refresca ejecuciones, discrepancias, cortes,
// conteos y el resumen de las vistas vinculadas (Caja, Inventario, Header,
// Dashboard) a la vez.
const CLAVE_AUDITORIA = ['auditoria']

function invalidarAuditoria(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: CLAVE_AUDITORIA })
}

export function useEjecucionesAuditoria(tipo?: TipoAuditoria) {
  return useQuery({
    queryKey: [...CLAVE_AUDITORIA, 'ejecuciones', tipo ?? 'todas'],
    queryFn: () => getEjecucionesAuditoria(tipo),
  })
}

export function useEjecutarAuditoria() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ejecutarAuditoria, onSuccess: () => invalidarAuditoria(queryClient) })
}

export function useDiscrepancias(filtros: FiltrosDiscrepancias) {
  return useQuery({
    queryKey: [...CLAVE_AUDITORIA, 'discrepancias', filtros],
    queryFn: () => getDiscrepancias(filtros),
  })
}

export function useJustificarDiscrepancia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comentario }: { id: number; comentario: string }) => justificarDiscrepancia(id, comentario),
    onSuccess: () => invalidarAuditoria(queryClient),
  })
}

// Ajustar mueve el stock: también cambian el inventario, su historial y las
// alertas de stock del Header.
export function useAjustarDiscrepancia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comentario }: { id: number; comentario: string }) => ajustarDiscrepancia(id, comentario),
    onSuccess: () =>
      Promise.all([
        invalidarAuditoria(queryClient),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] }),
        queryClient.invalidateQueries({ queryKey: ['alertas-stock'] }),
      ]),
  })
}

export function useCortesCaja() {
  return useQuery({ queryKey: [...CLAVE_AUDITORIA, 'cortes'], queryFn: getCortesCaja })
}

export function useCrearCorteCaja() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: crearCorteCaja, onSuccess: () => invalidarAuditoria(queryClient) })
}

export function useConteosFisicos() {
  return useQuery({ queryKey: [...CLAVE_AUDITORIA, 'conteos'], queryFn: getConteosFisicos })
}

export function useCrearConteoFisico() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: crearConteoFisico, onSuccess: () => invalidarAuditoria(queryClient) })
}

export function useDescartarConteoFisico() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: descartarConteoFisico, onSuccess: () => invalidarAuditoria(queryClient) })
}

// Admin-only en el backend: las vistas vinculadas pasan `habilitado = esAdmin`
// para que el operador ni siquiera dispare la consulta.
export function useResumenAuditoria(habilitado = true) {
  return useQuery({
    queryKey: [...CLAVE_AUDITORIA, 'resumen'],
    queryFn: getResumenAuditoria,
    enabled: habilitado,
    staleTime: 60_000,
  })
}
