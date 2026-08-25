import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useCrearCompra } from '../../hooks/useCompras'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useProductos } from '../../hooks/useProductos'
import { useProveedores } from '../../hooks/useProveedores'
import { useSucursales } from '../../hooks/useSucursales'
import { NuevaCompra } from './NuevaCompra'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../hooks/useCompras')
vi.mock('../../hooks/useProveedores')
vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useMateriaPrima')

const PROVEEDORES = [{ id: 1, nombre_proveedor: 'Distribuidora Médica', rfc: '', contacto_nombre: '', telefono: '', email: '', direccion: '', activo: true }]
const SUCURSALES = [{ id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: '', telefono_sucursal: '', activo: true }]
const PRODUCTOS = [
  { id: 1, nombre_producto: 'Suero fisiológico', sku: 'SKU-1', descripcion_producto: '', categoria: 1, unidad_medida: 'pza', precio_venta: '45.00', costo_produccion: '0', activo: true },
]
const MATERIA_PRIMA = [
  { id: 1, nombre_item: 'Cloruro de sodio', categoria: 1, unidad_medida: 'kg', costo_promedio: '0', activo: true },
]

function mockearHooks() {
  vi.mocked(useProveedores).mockReturnValue({ data: PROVEEDORES, isLoading: false } as unknown as ReturnType<typeof useProveedores>)
  vi.mocked(useSucursales).mockReturnValue({ data: SUCURSALES, isLoading: false } as unknown as ReturnType<typeof useSucursales>)
  vi.mocked(useProductos).mockReturnValue({ data: PRODUCTOS, isLoading: false } as unknown as ReturnType<typeof useProductos>)
  vi.mocked(useMateriaPrima).mockReturnValue({ data: MATERIA_PRIMA, isLoading: false } as unknown as ReturnType<typeof useMateriaPrima>)
  vi.mocked(useCrearCompra).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearCompra>)
}

function renderNuevaCompra() {
  return render(
    <MemoryRouter>
      <NuevaCompra />
    </MemoryRouter>,
  )
}

describe('NuevaCompra', () => {
  it('calcula el total en vivo al agregar líneas', () => {
    mockearHooks()
    renderNuevaCompra()

    fireEvent.change(screen.getByLabelText('Ítem'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Costo unitario'), { target: { value: '5.50' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))

    // Aparece en el <option> del selector y en la fila de la línea agregada.
    expect(screen.getAllByText('Suero fisiológico')).toHaveLength(2)
    expect(screen.getByTestId('total-compra')).toHaveTextContent('55.00')
  })

  it('recalcula el total al quitar una línea', () => {
    mockearHooks()
    renderNuevaCompra()

    fireEvent.change(screen.getByLabelText('Ítem'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Costo unitario'), { target: { value: '5.50' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))

    expect(screen.getByTestId('total-compra')).toHaveTextContent('55.00')

    fireEvent.click(screen.getByRole('button', { name: /quitar/i }))

    // Solo debe quedar el <option> del selector, no la fila de la línea.
    expect(screen.getAllByText('Suero fisiológico')).toHaveLength(1)
    expect(screen.getByTestId('total-compra')).toHaveTextContent('0.00')
  })

  it('suma varias líneas de distinto tipo en el total', () => {
    mockearHooks()
    renderNuevaCompra()

    fireEvent.change(screen.getByLabelText('Ítem'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Costo unitario'), { target: { value: '5.50' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'materia_prima' } })
    fireEvent.change(screen.getByLabelText('Ítem'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Costo unitario'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))

    // 10 * 5.50 = 55.00 ; 3 * 20 = 60.00 ; total = 115.00
    expect(screen.getByTestId('total-compra')).toHaveTextContent('115.00')
  })
})
