import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearCuentaContable,
  desactivarCuentaContable,
  editarCuentaContable,
  getCuentasContables,
  reactivarCuentaContable,
  type CuentaContableFormulario,
  type TipoCuenta,
} from '../api/contabilidad'

const CLAVE_CUENTAS = ['contabilidad', 'cuentas']

export function useCuentasContables(filtros: { tipo?: TipoCuenta } = {}) {
  return useQuery({
    queryKey: [...CLAVE_CUENTAS, filtros],
    queryFn: () => getCuentasContables(filtros),
  })
}

export function useCrearCuentaContable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearCuentaContable,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CUENTAS }),
  })
}

export function useEditarCuentaContable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: CuentaContableFormulario }) => editarCuentaContable(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CUENTAS }),
  })
}

export function useDesactivarCuentaContable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarCuentaContable,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CUENTAS }),
  })
}

export function useReactivarCuentaContable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarCuentaContable,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_CUENTAS }),
  })
}
