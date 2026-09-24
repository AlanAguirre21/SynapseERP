import { apiClient } from './client'

export type TipoCategoria = 'producto' | 'materia_prima' | 'ambos'

export interface Categoria {
  id: number
  nombre_categoria: string
  descripcion_categoria: string
  tipo: TipoCategoria
  activo: boolean
}

export type CategoriaFormulario = Pick<Categoria, 'nombre_categoria' | 'descripcion_categoria' | 'tipo'>

export interface Producto {
  id: number
  nombre_producto: string
  sku: string
  descripcion_producto: string
  categoria: number
  unidad_medida: string
  precio_venta: string
  costo_produccion: string
  activo: boolean
}

export type ProductoFormulario = Pick<
  Producto,
  'nombre_producto' | 'sku' | 'descripcion_producto' | 'categoria' | 'unidad_medida' | 'precio_venta' | 'costo_produccion'
>

export interface MateriaPrima {
  id: number
  nombre_item: string
  categoria: number
  unidad_medida: string
  costo_promedio: string
  activo: boolean
}

export type MateriaPrimaFormulario = Pick<
  MateriaPrima,
  'nombre_item' | 'categoria' | 'unidad_medida' | 'costo_promedio'
>

// --- Categorías --------------------------------------------------------

export async function getCategorias(): Promise<Categoria[]> {
  const { data } = await apiClient.get<Categoria[]>('/catalogo/categorias/')
  return data
}

export async function crearCategoria(datos: CategoriaFormulario): Promise<Categoria> {
  const { data } = await apiClient.post<Categoria>('/catalogo/categorias/', datos)
  return data
}

export async function editarCategoria(id: number, datos: CategoriaFormulario): Promise<Categoria> {
  const { data } = await apiClient.patch<Categoria>(`/catalogo/categorias/${id}/`, datos)
  return data
}

export async function desactivarCategoria(id: number): Promise<void> {
  await apiClient.delete(`/catalogo/categorias/${id}/`)
}

export async function reactivarCategoria(id: number): Promise<Categoria> {
  const { data } = await apiClient.post<Categoria>(`/catalogo/categorias/${id}/reactivar/`)
  return data
}

// --- Productos -----------------------------------------------------------

export async function getProductos(): Promise<Producto[]> {
  const { data } = await apiClient.get<Producto[]>('/catalogo/productos/')
  return data
}

export async function crearProducto(datos: ProductoFormulario): Promise<Producto> {
  const { data } = await apiClient.post<Producto>('/catalogo/productos/', datos)
  return data
}

export async function editarProducto(id: number, datos: ProductoFormulario): Promise<Producto> {
  const { data } = await apiClient.patch<Producto>(`/catalogo/productos/${id}/`, datos)
  return data
}

export async function desactivarProducto(id: number): Promise<void> {
  await apiClient.delete(`/catalogo/productos/${id}/`)
}

export async function reactivarProducto(id: number): Promise<Producto> {
  const { data } = await apiClient.post<Producto>(`/catalogo/productos/${id}/reactivar/`)
  return data
}

// --- Materia prima --------------------------------------------------------

export async function getMateriaPrima(): Promise<MateriaPrima[]> {
  const { data } = await apiClient.get<MateriaPrima[]>('/catalogo/materia-prima/')
  return data
}

export async function crearMateriaPrima(datos: MateriaPrimaFormulario): Promise<MateriaPrima> {
  const { data } = await apiClient.post<MateriaPrima>('/catalogo/materia-prima/', datos)
  return data
}

export async function editarMateriaPrima(id: number, datos: MateriaPrimaFormulario): Promise<MateriaPrima> {
  const { data } = await apiClient.patch<MateriaPrima>(`/catalogo/materia-prima/${id}/`, datos)
  return data
}

export async function desactivarMateriaPrima(id: number): Promise<void> {
  await apiClient.delete(`/catalogo/materia-prima/${id}/`)
}

export async function reactivarMateriaPrima(id: number): Promise<MateriaPrima> {
  const { data } = await apiClient.post<MateriaPrima>(`/catalogo/materia-prima/${id}/reactivar/`)
  return data
}
