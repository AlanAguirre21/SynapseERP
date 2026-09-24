import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  actualizarConfiguracionPAC,
  actualizarDatosFiscalesEmpresa,
  crearSerieFolio,
  desactivarSerieFolio,
  editarSerieFolio,
  getConfiguracionPAC,
  getDatosFiscalesEmpresa,
  getSeriesFolio,
  reactivarSerieFolio,
  type SerieFolioFormulario,
} from '../api/configuracionFiscal'

const CLAVE_DATOS_FISCALES = ['configuracion-fiscal', 'datos-empresa']
const CLAVE_PAC = ['configuracion-fiscal', 'pac']
const CLAVE_SERIES = ['configuracion-fiscal', 'series']

export function useDatosFiscalesEmpresa() {
  return useQuery({ queryKey: CLAVE_DATOS_FISCALES, queryFn: getDatosFiscalesEmpresa })
}

export function useActualizarDatosFiscalesEmpresa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: actualizarDatosFiscalesEmpresa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_DATOS_FISCALES }),
  })
}

export function useConfiguracionPAC() {
  return useQuery({ queryKey: CLAVE_PAC, queryFn: getConfiguracionPAC })
}

export function useActualizarConfiguracionPAC() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: actualizarConfiguracionPAC,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PAC }),
  })
}

export function useSeriesFolio() {
  return useQuery({ queryKey: CLAVE_SERIES, queryFn: getSeriesFolio })
}

export function useCrearSerieFolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearSerieFolio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SERIES }),
  })
}

export function useEditarSerieFolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: SerieFolioFormulario }) => editarSerieFolio(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SERIES }),
  })
}

export function useDesactivarSerieFolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarSerieFolio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SERIES }),
  })
}

export function useReactivarSerieFolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarSerieFolio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_SERIES }),
  })
}
