import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useClientes } from '../../hooks/useClientes'
import { useStock } from '../../hooks/useInventario'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { useCrearVenta } from '../../hooks/useVentas'
import { NuevaVenta } from './NuevaVenta'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../hooks/useVentas')
vi.mock('../../hooks/useClientes')
vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useInventario')

const CLIENTES = [
  { id: 1, nombre_cliente: 'Hospital San Rafael', telefono: '', email: '', direccion: '', activo: true, datos_fiscales: null },
]
const SUCURSALES = [{ id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: '', telefono_sucursal: '', activo: true }]
const PRODUCTOS = [
  { id: 1, nombre_producto: 'Suero fisiológico', sku: 'SKU-1', descripcion_producto: '', categoria: 1, unidad_medida: 'pza', precio_venta: '45.00', costo_produccion: '0', activo: true },
]
const STOCK = [{ id: 1, nombre: 'Suero fisiológico', stock_actual: '5.00', stock_minimo: '2.00', stock_bajo: false }]

function mockearHooks() {
  vi.mocked(useClientes).mockReturnValue({ data: CLIENTES, isLoading: false } as unknown as ReturnType<typeof useClientes>)
  vi.mocked(useSucursales).mockReturnValue({ data: SUCURSALES, isLoading: false } as unknown as ReturnType<typeof useSucursales>)
  vi.mocked(useProductos).mockReturnValue({ data: PRODUCTOS, isLoading: false } as unknown as ReturnType<typeof useProductos>)
  vi.mocked(useStock).mockReturnValue({ data: STOCK, isLoading: false } as unknown as ReturnType<typeof useStock>)
  vi.mocked(useCrearVenta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearVenta>)
}

function renderNuevaVenta() {
  return render(
    <MemoryRouter>
      <NuevaVenta />
    </MemoryRouter>,
  )
}

function seleccionarSucursal() {
  fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: '1' } })
}

describe('NuevaVenta', () => {
  it('calcula el total en vivo usando el precio_venta del producto', () => {
    mockearHooks()
    renderNuevaVenta()
    seleccionarSucursal()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))

    // 2 * 45.00 = 90.00
    expect(screen.getByTestId('total-venta')).toHaveTextContent('90.00')
  })

  it('recalcula el total al quitar una línea', () => {
    mockearHooks()
    renderNuevaVenta()
    seleccionarSucursal()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))
    expect(screen.getByTestId('total-venta')).toHaveTextContent('90.00')

    fireEvent.click(screen.getByRole('button', { name: /quitar/i }))
    expect(screen.getByTestId('total-venta')).toHaveTextContent('0.00')
  })

  it('muestra el stock disponible del producto seleccionado', () => {
    mockearHooks()
    renderNuevaVenta()
    seleccionarSucursal()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '1' } })

    expect(screen.getByText('Disponible: 5')).toBeInTheDocument()
  })

  it('rechaza agregar una línea con cantidad mayor al stock disponible', () => {
    mockearHooks()
    renderNuevaVenta()
    seleccionarSucursal()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/stock insuficiente/i)
    expect(screen.getByTestId('total-venta')).toHaveTextContent('0.00')
  })

  it('rechaza agregar una línea con cantidad fraccionaria', () => {
    mockearHooks()
    renderNuevaVenta()
    seleccionarSucursal()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '0.5' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/número entero/i)
    expect(screen.getByTestId('total-venta')).toHaveTextContent('0.00')
  })
})
