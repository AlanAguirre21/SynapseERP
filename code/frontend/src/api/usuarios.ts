import { apiClient } from './client'

export interface ModuloMenu {
  slug: string
  nombre: string
  ruta: string
}

export interface Usuario {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  nombre: string
  rol: 'admin' | 'operador'
  modulos: ModuloMenu[]
}

export interface InformacionUsuarioFormulario {
  username: string
  email: string
  first_name: string
  last_name: string
  rol_usuario?: 'admin' | 'operador'
}

export async function getUsuarioActual(): Promise<Usuario> {
  const { data } = await apiClient.get<Usuario>('/usuarios/me/')
  return data
}

// --- Autogestión de la propia cuenta (feature 015 · Información de Usuario) —
// distinto del CRUD administrativo de más abajo, que gestiona cuentas de
// terceros y es exclusivo de admin.

export async function actualizarMiInformacion(datos: InformacionUsuarioFormulario): Promise<Usuario> {
  const { data } = await apiClient.patch<Usuario>('/usuarios/me/', datos)
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

// --- Historial de accesos (feature 010 · Usuarios) --------------------------

export interface RegistroAcceso {
  id: number
  tipo: 'exitoso' | 'cierre_sesion' | 'fallido'
  ip: string | null
  creado_en: string
}

export type LimiteAccesos = '5' | '10' | 'todos'

export async function getAccesosUsuario(id: number, limite: LimiteAccesos): Promise<RegistroAcceso[]> {
  const { data } = await apiClient.get(`/usuarios/${id}/accesos/`, { params: { limite } })
  // `limite=todos` pagina en el backend (ver plan.md): la respuesta trae
  // `{count, next, previous, results}` en vez del arreglo plano que
  // devuelven `limite=5`/`10` — se normaliza acá para que el hook/página no
  // tengan que distinguir entre ambas formas.
  return Array.isArray(data) ? data : data.results
}

// --- Cierre de sesión (feature 010 · Usuarios) -------------------------------

export async function logout(refresh: string | null): Promise<void> {
  await apiClient.post('/auth/logout/', refresh ? { refresh } : {})
}

// --- Generación de contraseña aleatoria (feature 010 · Usuarios) ------------
// Utilidad de frontend, no endpoint — ver plan.md, Decisiones: solo rellena
// el campo del formulario, la validación real de fuerza sigue en el backend
// (`UsuarioSerializer.validate_password`) al guardar.

const ALFABETO_PASSWORD = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'

export function generarPasswordAleatoria(longitud = 14): string {
  const valores = new Uint32Array(longitud)
  crypto.getRandomValues(valores)
  return Array.from(valores, (v) => ALFABETO_PASSWORD[v % ALFABETO_PASSWORD.length]).join('')
}
