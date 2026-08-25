import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Venta } from '../../api/ventas'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { useCancelarVenta, useEntregarVenta, useVenta } from '../../hooks/useVentas'
import { DetalleVenta } from './DetalleVenta'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ id: '1' }) }
})

vi.mock('../../hooks/useVentas')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useClientes')

function ventaBase(estado: Venta['estado']): Venta {
  return {
    id: 1,
    cliente: null,
    cliente_nombre: 'Sin cliente',
    sucursal: 1,
    sucursal_nombre: 'Matriz',
    usuario: 1,
    usuario_nombre: 'admin1',
    fecha: '2026-08-20T10:00:00Z',
    fecha_entrega: null,
    fecha_entrega_real: null,
    total: '90.00',
    estado,
    detalles: [{ id: 1, producto: 1, cantidad: '2.00', precio_unitario: '45.00', subtotal: '90.00' }],
  }
}

function mockearHooks(estado: Venta['estado']) {
  vi.mocked(useVenta).mockReturnValue({ data: ventaBase(estado), isLoading: false } as unknown as ReturnType<typeof useVenta>)
  vi.mocked(useEntregarVenta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEntregarVenta>)
  vi.mocked(useCancelarVenta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCancelarVenta>)
  vi.mocked(useProductos).mockReturnValue(
    { data: [{ id: 1, nombre_producto: 'Suero fisiológico' }], isLoading: false } as unknown as ReturnType<typeof useProductos>,
  )
  vi.mocked(useClientes).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useClientes>)
}

function renderDetalle() {
  return render(
    <MemoryRouter>
      <DetalleVenta />
    </MemoryRouter>,
  )
}

describe('DetalleVenta', () => {
  it('una venta pendiente muestra "Marcar como entregada" y "Cancelar venta"', () => {
    mockearHooks('pendiente')
    renderDetalle()

    expect(screen.getByRole('button', { name: /marcar como entregada/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar venta/i })).toBeInTheDocument()
  })

  it('una venta entregada solo muestra "Cancelar venta"', () => {
    mockearHooks('entregada')
    renderDetalle()

    expect(screen.queryByRole('button', { name: /marcar como entregada/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar venta/i })).toBeInTheDocument()
  })

  it('una venta cancelada no muestra botones de entregar ni cancelar', () => {
    mockearHooks('cancelada')
    renderDetalle()

    expect(screen.queryByRole('button', { name: /marcar como entregada/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar venta/i })).not.toBeInTheDocument()
  })

  it('siempre muestra el botón de imprimir/descargar ticket', () => {
    mockearHooks('entregada')
    renderDetalle()

    expect(screen.getByRole('button', { name: /imprimir.*ticket/i })).toBeInTheDocument()
  })

  it('el botón de generar factura está deshabilitado', () => {
    mockearHooks('entregada')
    renderDetalle()

    expect(screen.getByRole('button', { name: /generar factura/i })).toBeDisabled()
  })
})
