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

// Recuadro completo de un indicador (etiqueta + cifra) a partir de su etiqueta.
function indicador(etiqueta: string): HTMLElement {
  const recuadro = screen.getByText(etiqueta, { selector: '.statLabel' }).parentElement
  if (!recuadro) throw new Error(`Indicador "${etiqueta}" sin contenedor`)
  return recuadro
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

  it('muestra el total con formato de moneda y el enlace a la venta de origen', () => {
    mockearHooks()
    renderFacturacion()

    const fila = screen.getByRole('cell', { name: 'Hospital San Rafael' }).closest('tr')
    expect(fila).toHaveTextContent('$90.00')
    expect(screen.getByRole('button', { name: 'Venta #10' })).toBeInTheDocument()
  })

  it('los indicadores cuentan solo facturas vigentes en el importe y tiñen las alertas con valor', () => {
    const conEstado = (id: number, estado: Factura['estado'], total: string): Factura => ({
      ...(FACTURAS[0] as Factura), id, venta: 10 + id, estado, venta_total: total,
    })
    mockearHooks()
    vi.mocked(useFacturas).mockReturnValue({
      data: [
        conEstado(1, 'timbrada', '100.00'),
        conEstado(2, 'pendiente_cancelacion', '50.00'),
        conEstado(3, 'cancelada', '999.00'),
        conEstado(4, 'error', '999.00'),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useFacturas>)
    renderFacturacion()

    expect(indicador('Facturas')).toHaveTextContent('4')
    // Timbrada + pendiente de cancelación; cancelada y con error no cuentan.
    expect(indicador('Importe facturado')).toHaveTextContent('$150.00')
    expect(indicador('Con error')).toHaveTextContent('1')
    expect(indicador('Con error')).toHaveClass('statTileDanger')
    expect(indicador('Pendientes de cancelación')).toHaveClass('statTileWarning')
  })

  it('sin alertas, los indicadores de error y cancelación no se tiñen', () => {
    mockearHooks()
    renderFacturacion()

    expect(indicador('Con error')).not.toHaveClass('statTileDanger')
    expect(indicador('Pendientes de cancelación')).not.toHaveClass('statTileWarning')
  })

  it('"Limpiar filtros" aparece con un filtro aplicado y lo restablece', () => {
    mockearHooks()
    renderFacturacion()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()

    const estado = screen.getByLabelText('Estado')
    fireEvent.change(estado, { target: { value: 'error' } })
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(estado).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('con filtros y sin resultados, el mensaje lo distingue de "todavía no hay facturas"', () => {
    mockearHooks()
    vi.mocked(useFacturas).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useFacturas>)
    renderFacturacion()

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'error' } })

    expect(screen.getByText('Ninguna factura coincide con los filtros.')).toBeInTheDocument()
  })
})
