import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Factura } from '../../api/facturacion'
import { useClientes } from '../../hooks/useClientes'
import { useFacturas } from '../../hooks/useFacturas'
import { Facturacion } from './Facturacion'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../../hooks/useFacturas')
vi.mock('../../hooks/useClientes')

const CLIENTES = [
  { id: 1, nombre_cliente: 'Hospital San Rafael', telefono: '', email: '', direccion: '', activo: true, datos_fiscales: null },
]

const FACTURAS: Factura[] = [
  {
    id: 1, venta: 10, venta_total: '90.00', cliente_nombre: 'Hospital San Rafael', usuario: 1, usuario_nombre: 'admin1',
    folio_fiscal: 'uuid-1', serie: 'A', folio_interno: 1, uso_cfdi: 'G03', forma_pago: '03', metodo_pago: 'PUE',
    estado: 'timbrada', mensaje_error: '', motivo_cancelacion: '', fecha_solicitud_cancelacion: null,
    fecha_creacion: '2026-08-20T10:00:00Z', fecha_timbrado: '2026-08-20T10:00:05Z',
  },
]

function mockearHooks() {
  vi.mocked(useClientes).mockReturnValue({ data: CLIENTES, isLoading: false } as unknown as ReturnType<typeof useClientes>)
  vi.mocked(useFacturas).mockReturnValue({ data: FACTURAS, isLoading: false } as unknown as ReturnType<typeof useFacturas>)
}

function renderFacturacion() {
  return render(
    <MemoryRouter>
      <Facturacion />
    </MemoryRouter>,
  )
}

describe('Facturacion', () => {
  it('muestra las facturas en la tabla', () => {
    mockearHooks()
    renderFacturacion()

    expect(screen.getByRole('cell', { name: 'Hospital San Rafael' })).toBeInTheDocument()
    expect(screen.getByText('A-1')).toBeInTheDocument()
  })

  it('filtra por estado', () => {
    mockearHooks()
    renderFacturacion()

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'error' } })

    const ultimaLlamada = vi.mocked(useFacturas).mock.calls.at(-1)?.[0]
    expect(ultimaLlamada).toMatchObject({ estado: 'error' })
  })

  it('filtra por cliente', () => {
    mockearHooks()
    renderFacturacion()

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '1' } })

    const ultimaLlamada = vi.mocked(useFacturas).mock.calls.at(-1)?.[0]
    expect(ultimaLlamada).toMatchObject({ cliente: 1 })
  })

  it('filtra por rango de fechas', () => {
    mockearHooks()
    renderFacturacion()

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-08-31' } })

    const ultimaLlamada = vi.mocked(useFacturas).mock.calls.at(-1)?.[0]
    expect(ultimaLlamada).toMatchObject({ fecha_desde: '2026-08-01', fecha_hasta: '2026-08-31' })
  })

  it('muestra un mensaje cuando no hay facturas', () => {
    mockearHooks()
    vi.mocked(useFacturas).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useFacturas>)
    renderFacturacion()

    expect(screen.getByText(/todavía no hay facturas/i)).toBeInTheDocument()
  })
})
