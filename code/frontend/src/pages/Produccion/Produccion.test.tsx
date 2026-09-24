import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useStock } from '../../hooks/useInventario'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import {
  useCrearProduccion,
  useProduccion,
  useProducciones,
} from '../../hooks/useProducciones'
import { useProductos } from '../../hooks/useProductos'
import {
  useCrearReceta,
  useDesactivarReceta,
  useEditarReceta,
  useReactivarReceta,
  useRecetas,
} from '../../hooks/useRecetas'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Produccion } from './Produccion'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useProducciones')
vi.mock('../../hooks/useRecetas')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useMateriaPrima')
vi.mock('../../hooks/useInventario')

function mockUsuarioActual(rol: 'admin' | 'operador') {
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

const SUCURSALES = [{ id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: '', telefono_sucursal: '', activo: true }]
const PRODUCTOS = [
  { id: 1, nombre_producto: 'Suero fisiológico', sku: 'SKU-1', descripcion_producto: '', categoria: 1, unidad_medida: 'pza', precio_venta: '45.00', costo_produccion: '0', activo: true },
]
const MATERIA_PRIMA = [
  { id: 1, nombre_item: 'Cloruro de sodio', categoria: 1, unidad_medida: 'kg', costo_promedio: '10.00', activo: true },
]
const RECETAS = [
  { id: 1, producto: 1, producto_nombre: 'Suero fisiológico', materia_prima: 1, materia_prima_nombre: 'Cloruro de sodio', cantidad_requerida: '0.50', activo: true },
]
const PRODUCCIONES = [
  { id: 1, producto: 1, producto_nombre: 'Suero fisiológico', sucursal: 1, sucursal_nombre: 'Matriz', usuario: 1, usuario_nombre: 'admin1', fecha: '2026-08-25T10:00:00Z', cantidad_producida: '10.00', costo_total: '50.00', detalles: [] },
]

function mockearHooks() {
  vi.mocked(useProducciones).mockReturnValue({ data: PRODUCCIONES, isLoading: false } as unknown as ReturnType<typeof useProducciones>)
  vi.mocked(useProduccion).mockReturnValue({ data: undefined, isLoading: false } as unknown as ReturnType<typeof useProduccion>)
  vi.mocked(useCrearProduccion).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearProduccion>)
  vi.mocked(useRecetas).mockReturnValue({ data: RECETAS, isLoading: false } as unknown as ReturnType<typeof useRecetas>)
  vi.mocked(useCrearReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearReceta>)
  vi.mocked(useEditarReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarReceta>)
  vi.mocked(useDesactivarReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarReceta>)
  vi.mocked(useReactivarReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarReceta>)
  vi.mocked(useProductos).mockReturnValue({ data: PRODUCTOS, isLoading: false } as unknown as ReturnType<typeof useProductos>)
  vi.mocked(useSucursales).mockReturnValue({ data: SUCURSALES, isLoading: false } as unknown as ReturnType<typeof useSucursales>)
  vi.mocked(useMateriaPrima).mockReturnValue({ data: MATERIA_PRIMA, isLoading: false } as unknown as ReturnType<typeof useMateriaPrima>)
}

function mockearStock(stockActual: string) {
  vi.mocked(useStock).mockReturnValue(
    { data: [{ id: 1, nombre: 'Cloruro de sodio', stock_actual: stockActual, stock_minimo: '5.00', stock_bajo: false }], isLoading: false } as unknown as ReturnType<typeof useStock>,
  )
}

describe('Produccion', () => {
  it('muestra la pestaña de Producciones registradas por defecto', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByText('Suero fisiológico')).toBeInTheDocument()
    expect(tabla.getByText('10.00')).toBeInTheDocument()
  })

  it('cambia a Gestión de recetas sin recargar la página', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('admin')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))

    expect(screen.getByText('Cloruro de sodio')).toBeInTheDocument()
    expect(screen.getByText('0.50')).toBeInTheDocument()
  })

  it('operador ve las recetas en solo lectura, sin botones de escritura', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))

    expect(screen.queryByRole('button', { name: /nueva línea de receta/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
  })

  it('admin ve botones de escritura en recetas', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('admin')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))

    expect(screen.getByRole('button', { name: /nueva línea de receta/i })).toBeInTheDocument()
    expect(screen.getByText('Editar')).toBeInTheDocument()
  })

  it('muestra en vivo la materia prima requerida y el stock disponible al elegir producto/sucursal', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva producción/i })
    fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Sucursal'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Cantidad a producir'), { target: { value: '10' } })

    // 0.50 requerido por unidad * 10 = 5.00
    expect(within(dialogo).getByText('5.00')).toBeInTheDocument()
    expect(within(dialogo).getByText('100.00')).toBeInTheDocument()
  })

  it('bloquea confirmar si no hay stock suficiente de materia prima', () => {
    mockearHooks()
    mockearStock('1.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva producción/i })
    fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Sucursal'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Cantidad a producir'), { target: { value: '10' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /confirmar producción/i }))

    expect(within(dialogo).getByRole('alert')).toHaveTextContent(/no hay stock suficiente/i)
  })

  it('avisa si el producto no tiene receta activa configurada', () => {
    mockearHooks()
    vi.mocked(useRecetas).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useRecetas>)
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva producción/i })
    fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Sucursal'), { target: { value: '1' } })

    expect(within(dialogo).getByText(/no tiene una receta activa configurada/i)).toBeInTheDocument()
  })
})
