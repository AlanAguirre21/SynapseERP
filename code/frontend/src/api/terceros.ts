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
  const { data } = await apiClient.get<Cliente[]>('/terceros/clientes/')
  return data
}

export async function crearCliente(datos: ClienteFormulario): Promise<Cliente> {
  const { data } = await apiClient.post<Cliente>('/terceros/clientes/', datos)
  return data
}

export async function editarCliente(id: number, datos: ClienteFormulario): Promise<Cliente> {
  const { data } = await apiClient.patch<Cliente>(`/terceros/clientes/${id}/`, datos)
  return data
}

export async function desactivarCliente(id: number): Promise<void> {
  await apiClient.delete(`/terceros/clientes/${id}/`)
}

export async function reactivarCliente(id: number): Promise<Cliente> {
  const { data } = await apiClient.post<Cliente>(`/terceros/clientes/${id}/reactivar/`)
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
  const { data } = await apiClient.get<Proveedor[]>('/terceros/proveedores/')
  return data
}

export async function crearProveedor(datos: ProveedorFormulario): Promise<Proveedor> {
  const { data } = await apiClient.post<Proveedor>('/terceros/proveedores/', datos)
  return data
}

export async function editarProveedor(id: number, datos: ProveedorFormulario): Promise<Proveedor> {
  const { data } = await apiClient.patch<Proveedor>(`/terceros/proveedores/${id}/`, datos)
  return data
}

export async function desactivarProveedor(id: number): Promise<void> {
  await apiClient.delete(`/terceros/proveedores/${id}/`)
}

export async function reactivarProveedor(id: number): Promise<Proveedor> {
  const { data } = await apiClient.post<Proveedor>(`/terceros/proveedores/${id}/reactivar/`)
  return data
}
