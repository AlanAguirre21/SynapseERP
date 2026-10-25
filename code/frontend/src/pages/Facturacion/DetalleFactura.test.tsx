import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Factura } from '../../api/facturacion'
import {
  useCancelarFactura,
  useComplementosPago,
  useDescargarPdfFactura,
  useDescargarXmlFactura,
  useFactura,
  useRegistrarComplementoPago,
} from '../../hooks/useFacturas'
import { DetalleFactura } from './DetalleFactura'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ id: '1' }) }
})

vi.mock('../../hooks/useFacturas')

function facturaBase(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 1, venta: 10, venta_total: '90.00', cliente_nombre: 'Hospital San Rafael', usuario: 1, usuario_nombre: 'admin1',
    folio_fiscal: 'uuid-1', serie: 'A', folio_interno: 1, uso_cfdi: 'G03', forma_pago: '03', metodo_pago: 'PUE',
    estado: 'timbrada', mensaje_error: '', motivo_cancelacion: '', fecha_solicitud_cancelacion: null,
    fecha_creacion: '2026-08-20T10:00:00Z', fecha_timbrado: '2026-08-20T10:00:05Z',
    ...overrides,
  }
}

const cancelarMock = vi.fn()

function mockearHooks(factura: Factura) {
  vi.mocked(useFactura).mockReturnValue({ data: factura, isLoading: false } as unknown as ReturnType<typeof useFactura>)
  vi.mocked(useComplementosPago).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useComplementosPago>)
  vi.mocked(useCancelarFactura).mockReturnValue(
    { mutateAsync: cancelarMock, isPending: false } as unknown as ReturnType<typeof useCancelarFactura>,
  )
  vi.mocked(useDescargarXmlFactura).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDescargarXmlFactura>)
  vi.mocked(useDescargarPdfFactura).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDescargarPdfFactura>)
  vi.mocked(useRegistrarComplementoPago).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRegistrarComplementoPago>)
}

function renderDetalle() {
  return render(
    <MemoryRouter>
      <DetalleFactura />
    </MemoryRouter>,
  )
}

describe('DetalleFactura', () => {
  it('una factura timbrada muestra el botón de cancelar', () => {
    mockearHooks(facturaBase())
    renderDetalle()

    expect(screen.getByRole('button', { name: /cancelar factura/i })).toBeInTheDocument()
  })

  it('una factura cancelada no muestra el botón de cancelar', () => {
    mockearHooks(facturaBase({ estado: 'cancelada' }))
    renderDetalle()

    expect(screen.queryByRole('button', { name: /cancelar factura/i })).not.toBeInTheDocument()
  })

  it('confirmar la cancelación envía el motivo seleccionado', async () => {
    cancelarMock.mockClear()
    mockearHooks(facturaBase())
    renderDetalle()

    fireEvent.click(screen.getByRole('button', { name: /cancelar factura/i }))
    fireEvent.change(screen.getByLabelText('Motivo de cancelación'), { target: { value: '03' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelación/i }))

    expect(cancelarMock).toHaveBeenCalledWith({ id: 1, motivo: '03' })
  })

  it('una factura con método de pago PUE no muestra la sección de complementos de pago', () => {
    mockearHooks(facturaBase({ metodo_pago: 'PUE' }))
    renderDetalle()

    expect(screen.queryByRole('heading', { name: /complementos de pago/i })).not.toBeInTheDocument()
  })

  it('una factura con método de pago PPD muestra la sección de complementos de pago', () => {
    mockearHooks(facturaBase({ metodo_pago: 'PPD' }))
    renderDetalle()

    expect(screen.getByRole('heading', { name: /complementos de pago/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /registrar pago/i })).toBeEnabled()
  })

  it('una factura PPD que no está timbrada deshabilita "Registrar pago"', () => {
    mockearHooks(facturaBase({ metodo_pago: 'PPD', estado: 'error' }))
    renderDetalle()

    expect(screen.getByRole('button', { name: /registrar pago/i })).toBeDisabled()
  })

  it('muestra los códigos del SAT con su descripción y el total en moneda', () => {
    mockearHooks(facturaBase({ uso_cfdi: 'G03', forma_pago: '99', metodo_pago: 'PUE' }))
    renderDetalle()

    expect(screen.getByText('G03 — Gastos en general')).toBeInTheDocument()
    expect(screen.getByText('99 — Por definir')).toBeInTheDocument()
    expect(screen.getByText('PUE — Pago en una sola exhibición')).toBeInTheDocument()
    expect(screen.getByTestId('total-factura')).toHaveTextContent('$90.00')
    expect(screen.getByRole('button', { name: 'Venta #10' })).toBeInTheDocument()
  })

  it('un código del SAT fuera del catálogo se muestra tal cual', () => {
    mockearHooks(facturaBase({ uso_cfdi: 'CP01' }))
    renderDetalle()

    expect(screen.getByText('CP01')).toBeInTheDocument()
  })

  it('en PPD resume lo pagado y el saldo, contando solo complementos timbrados', () => {
    mockearHooks(facturaBase({ metodo_pago: 'PPD', venta_total: '1000.00' }))
    vi.mocked(useComplementosPago).mockReturnValue({
      data: [
        { id: 1, factura: 1, monto_pagado: '400.00', fecha_pago: '2026-10-10', folio_fiscal_rep: 'rep-1', estado: 'timbrada' },
        { id: 2, factura: 1, monto_pagado: '300.00', fecha_pago: '2026-10-15', folio_fiscal_rep: '', estado: 'error' },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useComplementosPago>)
    renderDetalle()

    expect(screen.getByTestId('pagado-factura')).toHaveTextContent('$400.00')
    expect(screen.getByTestId('saldo-factura')).toHaveTextContent('$600.00')
    // La fecha "AAAA-MM-DD" se muestra en el mismo día, sin correrse por zona horaria.
    expect(screen.getByText('10/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Timbrado')).toBeInTheDocument()
  })

  it('"Copiar" copia el folio fiscal al portapapeles y lo confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mockearHooks(facturaBase({ folio_fiscal: '3F2504E0-4F89-41D3-9A0C-0305E82C3301' }))
    renderDetalle()

    fireEvent.click(screen.getByRole('button', { name: 'Copiar folio fiscal' }))

    expect(writeText).toHaveBeenCalledWith('3F2504E0-4F89-41D3-9A0C-0305E82C3301')
    expect(await screen.findByText('Copiado')).toBeInTheDocument()
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  })

  it('sin folio fiscal no se ofrece el botón "Copiar"', () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })
    mockearHooks(facturaBase({ folio_fiscal: '', estado: 'error' }))
    renderDetalle()

    expect(screen.queryByRole('button', { name: 'Copiar folio fiscal' })).not.toBeInTheDocument()
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  })
})
