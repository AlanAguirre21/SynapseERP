import { apiClient } from './client'

// --- Clientes --------------------------------------------------------------

export interface DatosFiscalesCliente {
  rfc: string
  razon_social: string
  codigo_postal_fiscal: string
  regimen_fiscal: string
  uso_cfdi_default: string
  requiere_factura: boolean
}

export interface Cliente {
  id: number
  nombre_cliente: string
  telefono: string
  email: string
  direccion: string
  activo: boolean
  datos_fiscales: DatosFiscalesCliente | null
}

export interface ClienteFormulario {
  nombre_cliente: string
  telefono: string
  email: string
  direccion: string
  datos_fiscales: DatosFiscalesCliente
}

export async function getClientes(): Promise<Cliente[]> {
  const { data } = await apiClient.get<Cliente[]>('/personas/clientes/')
  return data
}

export async function crearCliente(datos: ClienteFormulario): Promise<Cliente> {
  const { data } = await apiClient.post<Cliente>('/personas/clientes/', datos)
  return data
}

export async function editarCliente(id: number, datos: ClienteFormulario): Promise<Cliente> {
  const { data } = await apiClient.patch<Cliente>(`/personas/clientes/${id}/`, datos)
  return data
}

export async function desactivarCliente(id: number): Promise<void> {
  await apiClient.delete(`/personas/clientes/${id}/`)
}

export async function reactivarCliente(id: number): Promise<Cliente> {
  const { data } = await apiClient.post<Cliente>(`/personas/clientes/${id}/reactivar/`)
  return data
}

// --- Proveedores -------------------------------------------------------------

export interface Proveedor {
  id: number
  nombre_proveedor: string
  rfc: string
  contacto_nombre: string
  telefono: string
  email: string
  direccion: string
  activo: boolean
}

export type ProveedorFormulario = Pick<
  Proveedor,
  'nombre_proveedor' | 'rfc' | 'contacto_nombre' | 'telefono' | 'email' | 'direccion'
>

export async function getProveedores(): Promise<Proveedor[]> {
  const { data } = await apiClient.get<Proveedor[]>('/personas/proveedores/')
  return data
}

export async function crearProveedor(datos: ProveedorFormulario): Promise<Proveedor> {
  const { data } = await apiClient.post<Proveedor>('/personas/proveedores/', datos)
  return data
}

export async function editarProveedor(id: number, datos: ProveedorFormulario): Promise<Proveedor> {
  const { data } = await apiClient.patch<Proveedor>(`/personas/proveedores/${id}/`, datos)
  return data
}

export async function desactivarProveedor(id: number): Promise<void> {
  await apiClient.delete(`/personas/proveedores/${id}/`)
}

export async function reactivarProveedor(id: number): Promise<Proveedor> {
  const { data } = await apiClient.post<Proveedor>(`/personas/proveedores/${id}/reactivar/`)
  return data
}

// --- Empleados -----------------------------------------------------------

export interface Empleado {
  id: number
  nombre_completo: string
  puesto: string
  telefono: string
  email: string
  fecha_contratacion: string | null
  salario: string
  activo: boolean
}

export type EmpleadoFormulario = Pick<
  Empleado,
  'nombre_completo' | 'puesto' | 'telefono' | 'email' | 'fecha_contratacion' | 'salario'
>

export async function getEmpleados(): Promise<Empleado[]> {
  const { data } = await apiClient.get<Empleado[]>('/personas/empleados/')
  return data
}

export async function crearEmpleado(datos: EmpleadoFormulario): Promise<Empleado> {
  const { data } = await apiClient.post<Empleado>('/personas/empleados/', datos)
  return data
}

export async function editarEmpleado(id: number, datos: EmpleadoFormulario): Promise<Empleado> {
  const { data } = await apiClient.patch<Empleado>(`/personas/empleados/${id}/`, datos)
  return data
}

export async function desactivarEmpleado(id: number): Promise<void> {
  await apiClient.delete(`/personas/empleados/${id}/`)
}

export async function reactivarEmpleado(id: number): Promise<Empleado> {
  const { data } = await apiClient.post<Empleado>(`/personas/empleados/${id}/reactivar/`)
  return data
}
