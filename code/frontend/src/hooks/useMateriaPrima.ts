import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearMateriaPrima,
  desactivarMateriaPrima,
  editarMateriaPrima,
  getMateriaPrima,
  reactivarMateriaPrima,
  type MateriaPrimaFormulario,
} from '../api/catalogo'

const CLAVE_MATERIA_PRIMA = ['materia-prima']

export function useMateriaPrima() {
  return useQuery({
    queryKey: CLAVE_MATERIA_PRIMA,
    queryFn: getMateriaPrima,
  })
}

export function useCrearMateriaPrima() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearMateriaPrima,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_MATERIA_PRIMA }),
  })
}

export function useEditarMateriaPrima() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: MateriaPrimaFormulario }) => editarMateriaPrima(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_MATERIA_PRIMA }),
  })
}

export function useDesactivarMateriaPrima() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarMateriaPrima,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_MATERIA_PRIMA }),
  })
}

export function useReactivarMateriaPrima() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarMateriaPrima,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_MATERIA_PRIMA }),
  })
}
