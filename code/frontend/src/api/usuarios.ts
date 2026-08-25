import { apiClient } from './client'

export interface ModuloMenu {
  slug: string
  nombre: string
  ruta: string
}

export interface Usuario {
  nombre: string
  rol: 'admin' | 'operador'
  modulos: ModuloMenu[]
}

export async function getUsuarioActual(): Promise<Usuario> {
  const { data } = await apiClient.get<Usuario>('/usuarios/me/')
  return data
}

// --- CRUD administrativo de cuentas de usuario (feature 008 · Personas) ----
// Nombrado `UsuarioCuenta` para no chocar con `Usuario` (la forma que expone
// `/usuarios/me/` para el usuario actualmente logueado).

export interface UsuarioCuenta {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  rol_usuario: 'admin' | 'operador'
  empleado: number | null
  activo: boolean
}

export type UsuarioCuentaFormularioCreacion = Pick<
  UsuarioCuenta,
  'first_name' | 'last_name' | 'email' | 'rol_usuario' | 'empleado'
> & { password: string }

export type UsuarioCuentaFormularioEdicion = Pick<
  UsuarioCuenta,
  'first_name' | 'last_name' | 'email' | 'rol_usuario' | 'empleado'
>

export async function getUsuariosCuentas(): Promise<UsuarioCuenta[]> {
  const { data } = await apiClient.get<UsuarioCuenta[]>('/usuarios/')
  return data
}

export async function crearUsuarioCuenta(datos: UsuarioCuentaFormularioCreacion): Promise<UsuarioCuenta> {
  const { data } = await apiClient.post<UsuarioCuenta>('/usuarios/', datos)
  return data
}

export async function editarUsuarioCuenta(
  id: number,
  datos: UsuarioCuentaFormularioEdicion,
): Promise<UsuarioCuenta> {
  const { data } = await apiClient.patch<UsuarioCuenta>(`/usuarios/${id}/`, datos)
  return data
}

export async function desactivarUsuarioCuenta(id: number): Promise<void> {
  await apiClient.delete(`/usuarios/${id}/`)
}

export async function reactivarUsuarioCuenta(id: number): Promise<UsuarioCuenta> {
  const { data } = await apiClient.post<UsuarioCuenta>(`/usuarios/${id}/reactivar/`)
  return data
}
