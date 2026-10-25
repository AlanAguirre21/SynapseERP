import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { MovimientoCaja as MovimientoCajaApi, SaldosCaja } from '../../api/caja'
import { useCrearMovimientoCaja, useMovimientosCaja, useSaldoCaja } from '../../hooks/useMovimientosCaja'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Caja } from './Caja'

vi.mock('../../hooks/useUsuarioActual')
// 022: el resumen de auditoría no es el objeto de estas pruebas; sin datos por defecto.
vi.mock('../../hooks/useAuditoria', () => ({
  useResumenAuditoria: vi.fn(() => ({ data: undefined, isLoading: false })),
}))
vi.mock('../../hooks/useMovimientosCaja')

function mockUsuarioActual(rol: 'admin' | 'operador') {
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol }, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

const MOVIMIENTOS: MovimientoCajaApi[] = [
  {
    id: 1, fecha: '2026-08-25T10:00:00Z', tipo_movimiento: 'ingreso', monto: '300.00', motivo: 'venta',
    referencia_id: 7, observacion: 'Venta #7', usuario: 1, usuario_nombre: 'admin1', saldo_resultante: '300.00',
  },
  {
    id: 2, fecha: '2026-08-26T10:00:00Z', tipo_movimiento: 'retiro', monto: '80.00', motivo: 'compra',
    referencia_id: 12, observacion: 'Compra #12', usuario: 1, usuario_nombre: 'admin1', saldo_resultante: '220.00',
  },
]

const SALDO_POR_DEFECTO: SaldosCaja = { saldo_actual: '300.00', saldo_adicional: '0.00', saldo_total: '300.00' }

function mockearHooks(saldo: SaldosCaja = SALDO_POR_DEFECTO, crearMock = vi.fn()) {
  vi.mocked(useMovimientosCaja).mockReturnValue(
    { data: MOVIMIENTOS, isLoading: false } as unknown as ReturnType<typeof useMovimientosCaja>,
  )
  vi.mocked(useSaldoCaja).mockReturnValue(
    { data: saldo, isLoading: false } as unknown as ReturnType<typeof useSaldoCaja>,
  )
  vi.mocked(useCrearMovimientoCaja).mockReturnValue(
    { mutateAsync: crearMock, isPending: false } as unknown as ReturnType<typeof useCrearMovimientoCaja>,
  )
}

function renderCaja() {
  return render(
    <MemoryRouter>
      <Caja />
    </MemoryRouter>,
  )
}

// Recuadro completo de un indicador (etiqueta + cifra) a partir de su etiqueta.
function indicador(etiqueta: string): HTMLElement {
  const recuadro = screen.getByText(etiqueta, { selector: '.statLabel' }).parentElement
  if (!recuadro) throw new Error(`Indicador "${etiqueta}" sin contenedor`)
  return recuadro
}

describe('Caja', () => {
  it('un operador no ve el contenido del módulo de Caja', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    renderCaja()

    expect(screen.queryByRole('heading', { name: 'Caja' })).not.toBeInTheDocument()
    expect(screen.queryByText('Saldo actual de la caja')).not.toBeInTheDocument()
  })

  it('un admin ve los tres indicadores de saldo', () => {
    mockearHooks({ saldo_actual: '450.00', saldo_adicional: '50.00', saldo_total: '500.00' })
    mockUsuarioActual('admin')

    renderCaja()

    expect(screen.getByText('Saldo actual de la caja')).toBeInTheDocument()
    expect(screen.getByText('$450.00')).toBeInTheDocument()

    expect(screen.getByText('Saldo adicional (Costo de envíos)')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()

    expect(screen.getByText('Saldo de la caja')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
  })

  it('muestra la referencia a la venta en un movimiento automático', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    renderCaja()

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByRole('link', { name: /ver venta #7/i })).toBeInTheDocument()
  })

  it('muestra la referencia a la compra en un movimiento de motivo compra', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    renderCaja()

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByRole('link', { name: /ver compra #12/i })).toBeInTheDocument()
  })

  it('muestra un error claro cuando el backend rechaza un retiro por saldo insuficiente', async () => {
    const crearMock = vi.fn().mockRejectedValue({
      response: { data: { monto: ['Este retiro dejaría el saldo de caja en -50.00 — el saldo nunca puede ser negativo.'] } },
    })
    mockearHooks(SALDO_POR_DEFECTO, crearMock)
    mockUsuarioActual('admin')

    renderCaja()
    fireEvent.click(screen.getByRole('button', { name: /registrar movimiento/i }))

    const dialogo = screen.getByRole('dialog', { name: /registrar movimiento de caja/i })
    fireEvent.change(within(dialogo).getByLabelText('Tipo de movimiento'), { target: { value: 'retiro' } })
    fireEvent.change(within(dialogo).getByLabelText('Monto'), { target: { value: '350.00' } })
    fireEvent.change(within(dialogo).getByLabelText(/descripción/i), { target: { value: 'Retiro de prueba' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^registrar$/i }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/el saldo nunca puede ser negativo/i)
    // El formulario no se limpia ni se cierra tras el error.
    expect(within(dialogo).getByLabelText('Monto')).toHaveValue(350)
  })

  it('exige monto y descripción antes de enviar', () => {
    const crearMock = vi.fn()
    mockearHooks(SALDO_POR_DEFECTO, crearMock)
    mockUsuarioActual('admin')

    renderCaja()
    fireEvent.click(screen.getByRole('button', { name: /registrar movimiento/i }))

    const dialogo = screen.getByRole('dialog', { name: /registrar movimiento de caja/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^registrar$/i }))

    expect(within(dialogo).getByRole('alert')).toHaveTextContent(/monto mayor a cero/i)
    expect(crearMock).not.toHaveBeenCalled()
  })

  it('el panel muestra el saldo de la caja como cifra principal y su desglose', () => {
    mockearHooks({ saldo_actual: '450.00', saldo_adicional: '50.00', saldo_total: '500.00' })
    mockUsuarioActual('admin')

    renderCaja()

    const panel = within(screen.getByRole('region', { name: 'Saldo de la caja' }))
    expect(panel.getByText('$500.00')).toBeInTheDocument()
    expect(panel.getByText('Saldo actual de la caja').closest('div')).toHaveTextContent('$450.00')
    expect(panel.getByText('Saldo adicional (Costo de envíos)').closest('div')).toHaveTextContent('$50.00')
  })

  it('resume ingresos, retiros y flujo neto de los movimientos listados', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    renderCaja()

    expect(indicador('Movimientos')).toHaveTextContent('2')
    expect(indicador('Ingresos')).toHaveTextContent('$300.00')
    expect(indicador('Retiros')).toHaveTextContent('$80.00')
    expect(indicador('Flujo neto')).toHaveTextContent('+$220.00')
  })

  it('muestra el monto con signo y el retiro en tono neutro', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    renderCaja()

    const tabla = within(screen.getByRole('table'))
    const filaVenta = tabla.getByText('Venta #7').closest('tr')
    expect(filaVenta).toHaveTextContent('+$300.00')

    const filaCompra = tabla.getByText('Compra #12').closest('tr') as HTMLElement
    // Signo menos tipográfico (U+2212).
    expect(filaCompra).toHaveTextContent('−$80.00')
    expect(within(filaCompra).getByText('Retiro')).toHaveClass('statusNeutral')
  })

  it('limita la tabla a 10 movimientos por defecto, con selector 5 / 10 / Todos', () => {
    mockearHooks()
    const muchos = Array.from({ length: 12 }, (_, i) => ({ ...(MOVIMIENTOS[0] as MovimientoCajaApi), id: 100 + i }))
    vi.mocked(useMovimientosCaja).mockReturnValue(
      { data: muchos, isLoading: false } as unknown as ReturnType<typeof useMovimientosCaja>,
    )
    mockUsuarioActual('admin')

    renderCaja()

    const filas = () => within(screen.getByRole('table')).getAllByRole('row').length - 1
    expect(filas()).toBe(10)
    expect(screen.getByText('Mostrando 10 de 12')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(filas()).toBe(5)

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(filas()).toBe(12)
  })

  it('"Limpiar filtros" aparece con un filtro aplicado y lo restablece', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    renderCaja()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()

    const tipo = screen.getByLabelText('Tipo')
    fireEvent.change(tipo, { target: { value: 'retiro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(tipo).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('el modal anticipa el saldo después del movimiento y avisa de un sobregiro sin bloquear el envío', () => {
    const crearMock = vi.fn().mockResolvedValue({})
    mockearHooks(SALDO_POR_DEFECTO, crearMock)
    mockUsuarioActual('admin')

    renderCaja()
    fireEvent.click(screen.getByRole('button', { name: /registrar movimiento/i }))
    const dialogo = within(screen.getByRole('dialog', { name: /registrar movimiento de caja/i }))

    expect(dialogo.getByTestId('saldo-disponible')).toHaveTextContent('$300.00')

    fireEvent.change(dialogo.getByLabelText('Monto'), { target: { value: '100' } })
    expect(dialogo.getByTestId('saldo-despues')).toHaveTextContent('$400.00')
    expect(dialogo.queryByText(/supera el saldo disponible/i)).not.toBeInTheDocument()

    fireEvent.change(dialogo.getByLabelText('Tipo de movimiento'), { target: { value: 'retiro' } })
    fireEvent.change(dialogo.getByLabelText('Monto'), { target: { value: '350' } })
    expect(dialogo.getByTestId('saldo-despues')).toHaveTextContent('−$50.00')
    expect(dialogo.getByText(/supera el saldo disponible/i)).toBeInTheDocument()

    // El aviso no bloquea: el backend decide.
    fireEvent.change(dialogo.getByLabelText(/descripción/i), { target: { value: 'Retiro grande' } })
    fireEvent.click(dialogo.getByRole('button', { name: /^registrar$/i }))
    expect(crearMock).toHaveBeenCalledWith({ tipo_movimiento: 'retiro', monto: '350', observacion: 'Retiro grande' })
  })

  it('un movimiento de nómina se etiqueta "Nómina" y enlaza a la pestaña Nóminas de RRHH', () => {
    mockearHooks()
    vi.mocked(useMovimientosCaja).mockReturnValue({
      data: [{
        id: 3, fecha: '2026-08-27T10:00:00Z', tipo_movimiento: 'retiro', monto: '4500.00', motivo: 'nomina',
        referencia_id: 21, observacion: 'Nómina de Ana Ruiz (01/08/2026 – 15/08/2026)', usuario: 1,
        usuario_nombre: 'admin1', saldo_resultante: '0.00',
      }],
      isLoading: false,
    } as unknown as ReturnType<typeof useMovimientosCaja>)
    mockUsuarioActual('admin')

    renderCaja()

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByText('Nómina')).toHaveClass('status')
    expect(tabla.getByRole('link', { name: /ver nómina #21/i })).toHaveAttribute('href', '/rrhh?pestana=nominas')
  })
})

