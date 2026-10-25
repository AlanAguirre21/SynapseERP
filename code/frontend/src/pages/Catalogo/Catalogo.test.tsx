import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  useCategorias,
  useCrearCategoria,
  useDesactivarCategoria,
  useEditarCategoria,
  useReactivarCategoria,
} from '../../hooks/useCategorias'
import {
  useCrearMateriaPrima,
  useDesactivarMateriaPrima,
  useEditarMateriaPrima,
  useMateriaPrima,
  useReactivarMateriaPrima,
} from '../../hooks/useMateriaPrima'
import {
  useCrearProducto,
  useDesactivarProducto,
  useEditarProducto,
  useProductos,
  useReactivarProducto,
} from '../../hooks/useProductos'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Catalogo } from './Catalogo'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useCategorias')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useMateriaPrima')

const useCategoriasMock = vi.mocked(useCategorias)
const useProductosMock = vi.mocked(useProductos)
const useMateriaPrimaMock = vi.mocked(useMateriaPrima)

function mockUsuarioActual(rol: 'admin' | 'operador') {
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

const CATEGORIAS = [
  { id: 1, nombre_categoria: 'Insumos médicos', descripcion_categoria: '', tipo: 'producto' as const, activo: true },
  { id: 2, nombre_categoria: 'Químicos', descripcion_categoria: '', tipo: 'materia_prima' as const, activo: true },
  { id: 3, nombre_categoria: 'General', descripcion_categoria: '', tipo: 'ambos' as const, activo: true },
  { id: 4, nombre_categoria: 'Descontinuados', descripcion_categoria: '', tipo: 'ambos' as const, activo: false },
]

const PRODUCTOS = [
  {
    id: 1, nombre_producto: 'Suero fisiológico', sku: 'SKU-1', descripcion_producto: '', categoria: 1,
    unidad_medida: 'pza', precio_venta: '45.00', costo_produccion: '10.00', activo: true,
  },
  {
    id: 2, nombre_producto: 'Vendas', sku: 'SKU-2', descripcion_producto: '', categoria: 1,
    unidad_medida: 'pza', precio_venta: '20.00', costo_produccion: '5.00', activo: false,
  },
]

const MATERIA_PRIMA = [
  { id: 1, nombre_item: 'Cloruro de sodio', categoria: 2, unidad_medida: 'kg', costo_promedio: '30.00', activo: true },
  { id: 2, nombre_item: 'Agua destilada', categoria: 2, unidad_medida: 'L', costo_promedio: '5.00', activo: false },
]

interface ReactivarMocks {
  categoria?: ReturnType<typeof vi.fn>
  producto?: ReturnType<typeof vi.fn>
  materiaPrima?: ReturnType<typeof vi.fn>
}

function mockearHooks(reactivarMocks: ReactivarMocks = {}) {
  useCategoriasMock.mockReturnValue(
    { data: CATEGORIAS, isLoading: false } as unknown as ReturnType<typeof useCategorias>,
  )
  useProductosMock.mockReturnValue(
    { data: PRODUCTOS, isLoading: false } as unknown as ReturnType<typeof useProductos>,
  )
  useMateriaPrimaMock.mockReturnValue(
    { data: MATERIA_PRIMA, isLoading: false } as unknown as ReturnType<typeof useMateriaPrima>,
  )
  vi.mocked(useCrearCategoria).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearCategoria>,
  )
  vi.mocked(useEditarCategoria).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarCategoria>,
  )
  vi.mocked(useDesactivarCategoria).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarCategoria>,
  )
  vi.mocked(useReactivarCategoria).mockReturnValue(
    { mutateAsync: reactivarMocks.categoria ?? vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarCategoria>,
  )
  vi.mocked(useCrearProducto).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearProducto>,
  )
  vi.mocked(useEditarProducto).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarProducto>,
  )
  vi.mocked(useDesactivarProducto).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarProducto>,
  )
  vi.mocked(useReactivarProducto).mockReturnValue(
    { mutateAsync: reactivarMocks.producto ?? vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarProducto>,
  )
  vi.mocked(useCrearMateriaPrima).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearMateriaPrima>,
  )
  vi.mocked(useEditarMateriaPrima).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarMateriaPrima>,
  )
  vi.mocked(useDesactivarMateriaPrima).mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarMateriaPrima>,
  )
  vi.mocked(useReactivarMateriaPrima).mockReturnValue(
    { mutateAsync: reactivarMocks.materiaPrima ?? vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarMateriaPrima>,
  )
}

describe('Catalogo', () => {
  it('muestra la pestaña de Productos por defecto', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)

    expect(screen.getByText('Suero fisiológico')).toBeInTheDocument()
    expect(screen.queryByText('Cloruro de sodio')).not.toBeInTheDocument()
  })

  it('cambia entre pestañas sin recargar la página', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)

    fireEvent.click(screen.getByRole('tab', { name: 'Materia Prima' }))
    expect(screen.getByText('Cloruro de sodio')).toBeInTheDocument()
    expect(screen.queryByText('Suero fisiológico')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))
    expect(screen.getByText('Insumos médicos')).toBeInTheDocument()
    expect(screen.getByText('Químicos')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Productos' }))
    expect(screen.getByText('Suero fisiológico')).toBeInTheDocument()
  })

  it('rol operador no ve botones de crear, editar, desactivar ni reactivar en ninguna pestaña', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)

    expect(screen.queryByRole('button', { name: /nuevo producto/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Desactivar')).not.toBeInTheDocument()
    expect(screen.queryByText('Reactivar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Materia Prima' }))
    expect(screen.queryByRole('button', { name: /nueva materia prima/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Reactivar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))
    expect(screen.queryByRole('button', { name: /nueva categoría/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Reactivar')).not.toBeInTheDocument()
  })

  it('rol admin ve los botones de escritura, y Reactivar solo en filas inactivas', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Catalogo />)

    expect(screen.getByRole('button', { name: /nuevo producto/i })).toBeInTheDocument()
    // Suero fisiológico (activo) + Vendas (inactivo) → ambos editables.
    expect(screen.getAllByText('Editar')).toHaveLength(2)
    // Solo Suero fisiológico está activo.
    expect(screen.getAllByText('Desactivar')).toHaveLength(1)
    // Solo Vendas está inactivo.
    expect(screen.getAllByText('Reactivar')).toHaveLength(1)
  })

  it('filtra las categorías del formulario de producto a tipo producto o ambos', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo producto/i }))

    const dialogo = screen.getByRole('dialog', { name: /nuevo producto/i })
    const select = within(dialogo).getByLabelText('Categoría') as HTMLSelectElement
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent)

    expect(opciones).toContain('Insumos médicos')
    expect(opciones).toContain('General')
    expect(opciones).not.toContain('Químicos')
    expect(opciones).not.toContain('Descontinuados')
  })

  it('filtra las categorías del formulario de materia prima a tipo materia_prima o ambos', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('tab', { name: 'Materia Prima' }))
    fireEvent.click(screen.getByRole('button', { name: /nueva materia prima/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva materia prima/i })
    const select = within(dialogo).getByLabelText('Categoría') as HTMLSelectElement
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent)

    expect(opciones).toContain('Químicos')
    expect(opciones).toContain('General')
    expect(opciones).not.toContain('Insumos médicos')
    expect(opciones).not.toContain('Descontinuados')
  })

  it('reactivar un producto pide confirmación con su nombre y llama al hook al confirmar', async () => {
    const reactivarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks({ producto: reactivarMock })
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByText('Reactivar'))

    expect(screen.getByText(/¿confirmas que quieres reactivar "vendas"\?/i)).toBeInTheDocument()

    const dialogo = screen.getByRole('dialog', { name: /reactivar producto/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^reactivar$/i }))

    await waitFor(() => expect(reactivarMock).toHaveBeenCalledWith(2))
  })

  it('reactivar una materia prima pide confirmación con su nombre y llama al hook al confirmar', async () => {
    const reactivarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks({ materiaPrima: reactivarMock })
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('tab', { name: 'Materia Prima' }))
    fireEvent.click(screen.getByText('Reactivar'))

    expect(screen.getByText(/¿confirmas que quieres reactivar "agua destilada"\?/i)).toBeInTheDocument()

    const dialogo = screen.getByRole('dialog', { name: /reactivar materia prima/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^reactivar$/i }))

    await waitFor(() => expect(reactivarMock).toHaveBeenCalledWith(2))
  })

  it('reactivar una categoría pide confirmación con su nombre y llama al hook al confirmar', async () => {
    const reactivarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks({ categoria: reactivarMock })
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))
    fireEvent.click(screen.getByText('Reactivar'))

    expect(screen.getByText(/¿confirmas que quieres reactivar "descontinuados"\?/i)).toBeInTheDocument()

    const dialogo = screen.getByRole('dialog', { name: /reactivar categoría/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^reactivar$/i }))

    await waitFor(() => expect(reactivarMock).toHaveBeenCalledWith(4))
  })

  it('la acción del encabezado corresponde a la pestaña activa y abre su formulario (solo admin)', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    fireEvent.click(screen.getByRole('tab', { name: 'Materia Prima' }))
    expect(screen.queryByRole('button', { name: 'Nuevo producto' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva materia prima' }))
    expect(screen.getByRole('dialog', { name: 'Nueva materia prima' })).toBeInTheDocument()
  })

  it('cambiar de pestaña no abre el formulario de alta de la pestaña nueva', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Productos' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('busca productos por nombre sin importar acentos, y por SKU', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)
    const buscar = screen.getByLabelText('Buscar')

    fireEvent.change(buscar, { target: { value: 'fisiologico' } })
    expect(screen.getByText('Suero fisiológico')).toBeInTheDocument()
    expect(screen.queryByText('Vendas')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 2')).toBeInTheDocument()

    fireEvent.change(buscar, { target: { value: 'sku-2' } })
    expect(screen.getByText('Vendas')).toBeInTheDocument()
    expect(screen.queryByText('Suero fisiológico')).not.toBeInTheDocument()
  })

  it('filtra por estado y por categoría, y "Limpiar filtros" los restablece', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactivos' } })
    expect(screen.getByText('Vendas')).toBeInTheDocument()
    expect(screen.queryByText('Suero fisiológico')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'todos' } })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '3' } })
    expect(screen.getByText('Ningún producto coincide con los filtros.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByText('Mostrando 2 de 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Categoría')).toHaveValue('')
  })

  it('filtra las categorías por tipo', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'materia_prima' } })

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByText('Químicos')).toBeInTheDocument()
    expect(tabla.queryByText('Insumos médicos')).not.toBeInTheDocument()
  })

  it('la tabla de productos muestra categoría, precio y costo en moneda y el margen', () => {
    mockearHooks()
    useProductosMock.mockReturnValue({
      data: [
        ...PRODUCTOS,
        {
          id: 3, nombre_producto: 'Gasa', sku: 'SKU-3', descripcion_producto: '', categoria: 3,
          unidad_medida: 'pza', precio_venta: '12.00', costo_produccion: '0', activo: true,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useProductos>)
    mockUsuarioActual('operador')

    render(<Catalogo />)

    const filaSuero = screen.getByText('Suero fisiológico').closest('tr') as HTMLElement
    expect(filaSuero).toHaveTextContent('Insumos médicos')
    expect(filaSuero).toHaveTextContent('$45.00')
    expect(filaSuero).toHaveTextContent('$10.00')
    // (45 − 10) / 45
    expect(filaSuero).toHaveTextContent('77.8%')

    // Sin costo capturado no hay margen que mostrar.
    const filaGasa = screen.getByText('Gasa').closest('tr') as HTMLElement
    expect(within(filaGasa).getAllByRole('cell').map((c) => c.textContent)).toContain('—')
  })

  it('la tabla de materia prima muestra la categoría y el costo en moneda', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('tab', { name: 'Materia Prima' }))

    const fila = screen.getByText('Cloruro de sodio').closest('tr') as HTMLElement
    expect(fila).toHaveTextContent('Químicos')
    expect(fila).toHaveTextContent('$30.00')
  })

  it('muestra cuántos productos y materias primas usan cada categoría', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByText('Insumos médicos').closest('tr')).toHaveTextContent('2 productos · 0 materias primas')
    expect(tabla.getByText('Químicos').closest('tr')).toHaveTextContent('0 productos · 2 materias primas')
  })

  it('el formulario de producto anticipa el margen con los valores capturados', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Catalogo />)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Nuevo producto' }))

    expect(dialogo.getByTestId('margen-vista-previa')).toHaveTextContent('—')

    fireEvent.change(dialogo.getByLabelText('Precio de venta'), { target: { value: '100' } })
    fireEvent.change(dialogo.getByLabelText('Costo de producción'), { target: { value: '60' } })
    expect(dialogo.getByTestId('margen-vista-previa')).toHaveTextContent('40.0%')
  })
})
