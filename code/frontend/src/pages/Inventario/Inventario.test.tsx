import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useEditarStockMinimo, useStock } from '../../hooks/useInventario'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useMovimientosInventario } from '../../hooks/useMovimientosInventario'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Inventario } from './Inventario'

vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useInventario')
vi.mock('../../hooks/useMovimientosInventario')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useMateriaPrima')
vi.mock('../../hooks/useUsuarioActual')

const useSucursalesMock = vi.mocked(useSucursales)
const useStockMock = vi.mocked(useStock)
const useMovimientosInventarioMock = vi.mocked(useMovimientosInventario)
const useEditarStockMinimoMock = vi.mocked(useEditarStockMinimo)

const SUCURSALES = [
  { id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: '', telefono_sucursal: '', activo: true },
  { id: 2, nombre_sucursal: 'Norte', ubicacion_sucursal: '', telefono_sucursal: '', activo: true },
]

const STOCK_PRODUCTOS = [
  { id: 1, nombre: 'Suero fisiológico', stock_actual: '2.00', stock_minimo: '10.00', stock_bajo: true },
  { id: 2, nombre: 'Gasa estéril', stock_actual: '50.00', stock_minimo: '10.00', stock_bajo: false },
]

const STOCK_MATERIA_PRIMA = [
  { id: 1, nombre: 'Cloruro de sodio', stock_actual: '1.00', stock_minimo: '5.00', stock_bajo: true },
]

const MOVIMIENTOS = [
  {
    id: 1, fecha: '2026-08-20T10:00:00Z', sucursal: 1, sucursal_nombre: 'Matriz', tipo_item: 'producto' as const,
    item_id: 1, item_nombre: 'Suero fisiológico', tipo_movimiento: 'entrada' as const, cantidad: '20.00',
    motivo: 'compra' as const, referencia_id: null, stock_resultante: '20.00', usuario: 1,
    usuario_nombre: 'admin1',
  },
]

function mockearHooks(rol: 'admin' | 'operador' = 'operador') {
  useSucursalesMock.mockReturnValue({ data: SUCURSALES, isLoading: false } as unknown as ReturnType<typeof useSucursales>)
  useStockMock.mockImplementation(
    (tipo) =>
      ({
        data: tipo === 'producto' ? STOCK_PRODUCTOS : STOCK_MATERIA_PRIMA,
        isLoading: false,
      }) as unknown as ReturnType<typeof useStock>,
  )
  useMovimientosInventarioMock.mockReturnValue(
    { data: MOVIMIENTOS, isLoading: false } as unknown as ReturnType<typeof useMovimientosInventario>,
  )
  vi.mocked(useProductos).mockReturnValue(
    { data: [{ id: 1, nombre_producto: 'Suero fisiológico' }], isLoading: false } as unknown as ReturnType<typeof useProductos>,
  )
  vi.mocked(useMateriaPrima).mockReturnValue(
    { data: [{ id: 1, nombre_item: 'Cloruro de sodio' }], isLoading: false } as unknown as ReturnType<typeof useMateriaPrima>,
  )
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>,
  )
  useEditarStockMinimoMock.mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarStockMinimo>,
  )
}

function primero<T>(elementos: T[]): T {
  const elemento = elementos[0]
  if (!elemento) throw new Error('Se esperaba al menos un elemento.')
  return elemento
}

describe('Inventario', () => {
  it('muestra el inventario de productos por defecto', () => {
    mockearHooks()
    render(<Inventario />)

    const tablaStock = within(primero(screen.getAllByRole('table')))
    expect(tablaStock.getByText('Suero fisiológico')).toBeInTheDocument()
    expect(tablaStock.getByText('Gasa estéril')).toBeInTheDocument()
    expect(tablaStock.queryByText('Cloruro de sodio')).not.toBeInTheDocument()
  })

  it('cambia a inventario de materia prima sin recargar la página', () => {
    mockearHooks()
    render(<Inventario />)

    fireEvent.click(screen.getByRole('tab', { name: 'Inventario de materia prima' }))

    expect(useStockMock).toHaveBeenLastCalledWith('materia_prima', expect.any(Number))
  })

  it('marca visualmente los ítems bajo el stock mínimo', () => {
    mockearHooks()
    render(<Inventario />)

    const tablaStock = within(primero(screen.getAllByRole('table')))
    const filaSuero = tablaStock.getByText('Suero fisiológico').closest('tr')
    const filaGasa = tablaStock.getByText('Gasa estéril').closest('tr')

    expect(filaSuero).toHaveTextContent('Bajo mínimo')
    expect(filaGasa).toHaveTextContent('OK')
  })

  it('permite filtrar el stock por sucursal', () => {
    mockearHooks()
    render(<Inventario />)

    const selectSucursal = primero(screen.getAllByLabelText('Sucursal'))
    fireEvent.change(selectSucursal, { target: { value: '2' } })

    expect(useStockMock).toHaveBeenLastCalledWith('producto', 2)
  })

  it('el historial no tiene botones de acción', () => {
    mockearHooks()
    render(<Inventario />)

    expect(screen.queryByRole('button', { name: /nuevo|crear|editar|eliminar/i })).not.toBeInTheDocument()
  })

  it('un admin ve un control de edición de stock mínimo y puede guardar un nuevo valor', async () => {
    mockearHooks('admin')
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    useEditarStockMinimoMock.mockReturnValue(
      { mutateAsync, isPending: false } as unknown as ReturnType<typeof useEditarStockMinimo>,
    )
    render(<Inventario />)

    const input = screen.getByLabelText('Stock mínimo de Suero fisiológico') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.value).toBe('10.00')

    fireEvent.change(input, { target: { value: '15' } })
    fireEvent.blur(input)

    expect(mutateAsync).toHaveBeenCalledWith({ tipo: 'producto', sucursal: 1, item_id: 1, stock_minimo: '15' })
  })

  it('un operador no ve ningún control de edición de stock mínimo', () => {
    mockearHooks('operador')
    render(<Inventario />)

    expect(screen.queryByLabelText(/Stock mínimo de/)).not.toBeInTheDocument()
    const tablaStock = within(primero(screen.getAllByRole('table')))
    expect(tablaStock.getAllByText('10.00')).toHaveLength(2)
  })
})
