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
<<<<<<< HEAD
}

=======
  // URL absoluta de la fotografía de perfil, o `null` (017 / 010).
  foto_usuario: string | null
}

// Cambio de fotografía en un formulario: archivo nuevo para subirla, `null`
// para quitarla. Sin cambio, la clave no se envía y la petición es la misma
// de siempre (JSON sin fotografía).
export type CambioFoto = File | null

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
export interface InformacionUsuarioFormulario {
  username: string
  email: string
  first_name: string
  last_name: string
  rol_usuario?: 'admin' | 'operador'
<<<<<<< HEAD
=======
  foto_usuario?: CambioFoto
}

export type RolUsuario = 'admin' | 'operador'

export const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  admin: 'Administrador',
  operador: 'Operador',
}

// Qué implica cada rol, al elegirlo o al consultarlo (Usuarios e Información
// de Usuario). Refleja `backend/core/modules.py` (la fuente de verdad es el
// backend): si cambian los módulos de un rol, se actualiza aquí a mano
// (checklist de mantenimiento de 021).
export const DESCRIPCIONES_ROL: Record<RolUsuario, string> = {
  admin:
    'Acceso a todos los módulos, incluidos Caja, Recursos Humanos, Usuarios, Contabilidad y Configuración Fiscal.',
  operador:
    'La operación diaria (ventas, compras, producción, inventario, facturación, catálogo, terceros y sucursales), sin Caja, Recursos Humanos, Usuarios, Contabilidad ni Configuración Fiscal.',
}

// Formatos y tamaño que acepta el backend (`apps/usuarios/validators.py`);
// en el navegador solo adelantan el aviso, la validación real es la del backend.
export const TIPOS_FOTO_USUARIO = ['image/jpeg', 'image/png', 'image/webp']
export const TAMANO_MAXIMO_FOTO_USUARIO = 2 * 1024 * 1024
export const MENSAJE_FOTO_INVALIDA = 'La fotografía debe ser JPG, PNG o WebP de hasta 2 MB.'

export function esFotoValida(archivo: File): boolean {
  return TIPOS_FOTO_USUARIO.includes(archivo.type) && archivo.size <= TAMANO_MAXIMO_FOTO_USUARIO
}

// Solo una fotografía nueva necesita multipart; quitarla (`null`) o no
// tocarla viaja como JSON. En multipart, `null` (ej. `empleado`) va vacío:
// DRF lo interpreta como `null` en campos relacionales.
function cuerpoConFoto<T extends { foto_usuario?: CambioFoto }>(datos: T): T | FormData {
  if (!(datos.foto_usuario instanceof File)) return datos
  const formData = new FormData()
  Object.entries(datos).forEach(([clave, valor]) => {
    if (valor === undefined) return
    formData.append(clave, valor instanceof File ? valor : valor === null ? '' : String(valor))
  })
  return formData
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
}

export async function getUsuarioActual(): Promise<Usuario> {
  const { data } = await apiClient.get<Usuario>('/usuarios/me/')
  return data
}

// --- Autogestión de la propia cuenta (feature 015 · Información de Usuario) —
// distinto del CRUD administrativo de más abajo, que gestiona cuentas de
// terceros y es exclusivo de admin.

export async function actualizarMiInformacion(datos: InformacionUsuarioFormulario): Promise<Usuario> {
<<<<<<< HEAD
  const { data } = await apiClient.patch<Usuario>('/usuarios/me/', datos)
=======
  const { data } = await apiClient.patch<Usuario>('/usuarios/me/', cuerpoConFoto(datos))
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
=======
  foto_usuario: string | null
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
}

export type UsuarioCuentaFormularioCreacion = Pick<
  UsuarioCuenta,
  'first_name' | 'last_name' | 'email' | 'rol_usuario' | 'empleado'
<<<<<<< HEAD
> & { password: string }
=======
> & { password: string; foto_usuario?: CambioFoto }
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

export type UsuarioCuentaFormularioEdicion = Pick<
  UsuarioCuenta,
  'first_name' | 'last_name' | 'email' | 'rol_usuario' | 'empleado'
<<<<<<< HEAD
>
=======
> & { foto_usuario?: CambioFoto }
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

export async function getUsuariosCuentas(): Promise<UsuarioCuenta[]> {
  const { data } = await apiClient.get<UsuarioCuenta[]>('/usuarios/')
  return data
}

export async function crearUsuarioCuenta(datos: UsuarioCuentaFormularioCreacion): Promise<UsuarioCuenta> {
<<<<<<< HEAD
  const { data } = await apiClient.post<UsuarioCuenta>('/usuarios/', datos)
=======
  const { data } = await apiClient.post<UsuarioCuenta>('/usuarios/', cuerpoConFoto(datos))
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  return data
}

export async function editarUsuarioCuenta(
  id: number,
  datos: UsuarioCuentaFormularioEdicion,
): Promise<UsuarioCuenta> {
<<<<<<< HEAD
  const { data } = await apiClient.patch<UsuarioCuenta>(`/usuarios/${id}/`, datos)
=======
  const { data } = await apiClient.patch<UsuarioCuenta>(`/usuarios/${id}/`, cuerpoConFoto(datos))
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
