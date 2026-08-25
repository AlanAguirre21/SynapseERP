import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Compra } from '../../api/compras'
import { useCancelarCompra, useCompra, useRecibirCompra } from '../../hooks/useCompras'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useProductos } from '../../hooks/useProductos'
import { DetalleCompra } from './DetalleCompra'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock, useParams: () => ({ id: '1' }) }
})

vi.mock('../../hooks/useCompras')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useMateriaPrima')

function compraBase(estado: Compra['estado']): Compra {
  return {
    id: 1,
    proveedor: 1,
    proveedor_nombre: 'Distribuidora Médica',
    sucursal: 1,
    sucursal_nombre: 'Matriz',
    usuario: 1,
    usuario_nombre: 'admin1',
    fecha: '2026-08-20T10:00:00Z',
    fecha_entrega: null,
    total: '55.00',
    estado,
    detalles_producto: [{ id: 1, producto: 1, cantidad: '10.00', costo_unitario: '5.50', subtotal: '55.00' }],
    detalles_materia_prima: [],
  }
}

function mockearHooks(estado: Compra['estado']) {
  vi.mocked(useCompra).mockReturnValue({ data: compraBase(estado), isLoading: false } as unknown as ReturnType<typeof useCompra>)
  vi.mocked(useRecibirCompra).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRecibirCompra>)
  vi.mocked(useCancelarCompra).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCancelarCompra>)
  vi.mocked(useProductos).mockReturnValue(
    { data: [{ id: 1, nombre_producto: 'Suero fisiológico' }], isLoading: false } as unknown as ReturnType<typeof useProductos>,
  )
  vi.mocked(useMateriaPrima).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useMateriaPrima>)
}

function renderDetalle() {
  return render(
    <MemoryRouter>
      <DetalleCompra />
    </MemoryRouter>,
  )
}

describe('DetalleCompra', () => {
  it('una compra pendiente muestra "Marcar como recibida" y "Cancelar compra"', () => {
    mockearHooks('pendiente')
    renderDetalle()

    expect(screen.getByRole('button', { name: /marcar como recibida/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar compra/i })).toBeInTheDocument()
  })

  it('una compra recibida solo muestra "Cancelar compra"', () => {
    mockearHooks('recibida')
    renderDetalle()

    expect(screen.queryByRole('button', { name: /marcar como recibida/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar compra/i })).toBeInTheDocument()
  })

  it('una compra cancelada no muestra ningún botón de acción', () => {
    mockearHooks('cancelada')
    renderDetalle()

    expect(screen.queryByRole('button', { name: /marcar como recibida/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar compra/i })).not.toBeInTheDocument()
  })

  it('muestra las líneas con el nombre del ítem resuelto', () => {
    mockearHooks('pendiente')
    renderDetalle()

    expect(screen.getByText('Suero fisiológico')).toBeInTheDocument()
    expect(screen.getByTestId('total-compra')).toHaveTextContent('55.00')
  })
})
