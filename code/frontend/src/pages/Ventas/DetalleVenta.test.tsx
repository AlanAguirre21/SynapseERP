import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Factura } from '../../api/facturacion'
import type { Cliente } from '../../api/personas'
import type { Venta } from '../../api/ventas'
import { useClientes } from '../../hooks/useClientes'
import { useFacturaDeVenta, useGenerarFactura } from '../../hooks/useFacturas'
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
vi.mock('../../hooks/useFacturas')

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

const CLIENTE_CON_FISCALES_COMPLETOS: Cliente = {
  id: 1,
  nombre_cliente: 'Hospital San Rafael',
  telefono: '',
  email: '',
  direccion: '',
  activo: true,
  datos_fiscales: {
    rfc: 'HSR850101AA1',
    razon_social: 'Hospital San Rafael SA de CV',
    codigo_postal_fiscal: '64000',
    regimen_fiscal: '601',
    uso_cfdi_default: 'G03',
    requiere_factura: true,
  },
}

interface OpcionesMock {
  estado?: Venta['estado']
  cliente?: Cliente | null
  factura?: Factura
}

function mockearHooks({ estado = 'entregada', cliente = null, factura }: OpcionesMock = {}) {
  const venta = { ...ventaBase(estado), cliente: cliente?.id ?? null }
  vi.mocked(useVenta).mockReturnValue({ data: venta, isLoading: false } as unknown as ReturnType<typeof useVenta>)
  vi.mocked(useEntregarVenta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEntregarVenta>)
  vi.mocked(useCancelarVenta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCancelarVenta>)
  vi.mocked(useProductos).mockReturnValue(
    { data: [{ id: 1, nombre_producto: 'Suero fisiológico' }], isLoading: false } as unknown as ReturnType<typeof useProductos>,
  )
  vi.mocked(useClientes).mockReturnValue(
    { data: cliente ? [cliente] : [], isLoading: false } as unknown as ReturnType<typeof useClientes>,
  )
  vi.mocked(useFacturaDeVenta).mockReturnValue({ data: factura, isLoading: false } as unknown as ReturnType<typeof useFacturaDeVenta>)
  vi.mocked(useGenerarFactura).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useGenerarFactura>)
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
    mockearHooks({ estado: 'pendiente' })
    renderDetalle()

    expect(screen.getByRole('button', { name: /marcar como entregada/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar venta/i })).toBeInTheDocument()
  })

  it('una venta entregada solo muestra "Cancelar venta"', () => {
    mockearHooks({ estado: 'entregada' })
    renderDetalle()

    expect(screen.queryByRole('button', { name: /marcar como entregada/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar venta/i })).toBeInTheDocument()
  })

  it('una venta cancelada no muestra botones de entregar ni cancelar', () => {
    mockearHooks({ estado: 'cancelada' })
    renderDetalle()

    expect(screen.queryByRole('button', { name: /marcar como entregada/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar venta/i })).not.toBeInTheDocument()
  })

  it('siempre muestra el botón de imprimir/descargar ticket', () => {
    mockearHooks({ estado: 'entregada' })
    renderDetalle()

    expect(screen.getByRole('button', { name: /imprimir.*ticket/i })).toBeInTheDocument()
  })

  it('el botón de generar factura está deshabilitado si el cliente no tiene datos fiscales completos', () => {
    mockearHooks({ estado: 'entregada', cliente: null })
    renderDetalle()

    expect(screen.getByRole('button', { name: /generar factura/i })).toBeDisabled()
  })

  it('el botón de generar factura se habilita si el cliente tiene datos fiscales completos', () => {
    mockearHooks({ estado: 'entregada', cliente: CLIENTE_CON_FISCALES_COMPLETOS })
    renderDetalle()

    expect(screen.getByRole('button', { name: /generar factura/i })).toBeEnabled()
  })

  it('una venta cancelada deshabilita el botón de generar factura aunque el cliente tenga datos fiscales', () => {
    mockearHooks({ estado: 'cancelada', cliente: CLIENTE_CON_FISCALES_COMPLETOS })
    renderDetalle()

    expect(screen.getByRole('button', { name: /generar factura/i })).toBeDisabled()
  })

  it('una factura ya timbrada muestra "Ver factura" en vez de "Generar factura"', () => {
    mockearHooks({
      estado: 'entregada', cliente: CLIENTE_CON_FISCALES_COMPLETOS,
      factura: { id: 7, estado: 'timbrada' } as Factura,
    })
    renderDetalle()

    expect(screen.getByRole('button', { name: /ver factura/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generar factura/i })).not.toBeInTheDocument()
  })

  it('una factura en estado error permite reintentar', () => {
    mockearHooks({
      estado: 'entregada', cliente: CLIENTE_CON_FISCALES_COMPLETOS,
      factura: { id: 7, estado: 'error' } as Factura,
    })
    renderDetalle()

    expect(screen.getByRole('button', { name: /reintentar factura/i })).toBeEnabled()
  })
})
