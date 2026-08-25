import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearUsuarioCuenta,
  desactivarUsuarioCuenta,
  editarUsuarioCuenta,
  getUsuariosCuentas,
  reactivarUsuarioCuenta,
  type UsuarioCuentaFormularioEdicion,
} from '../api/usuarios'

const CLAVE_USUARIOS = ['usuarios-cuentas']

export function useUsuarios() {
  return useQuery({
    queryKey: CLAVE_USUARIOS,
    queryFn: getUsuariosCuentas,
  })
}

export function useCrearUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: crearUsuarioCuenta,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_USUARIOS }),
  })
}

export function useEditarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: UsuarioCuentaFormularioEdicion }) =>
      editarUsuarioCuenta(id, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_USUARIOS }),
  })
}

export function useDesactivarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: desactivarUsuarioCuenta,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_USUARIOS }),
  })
}

export function useReactivarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarUsuarioCuenta,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_USUARIOS }),
  })
}
