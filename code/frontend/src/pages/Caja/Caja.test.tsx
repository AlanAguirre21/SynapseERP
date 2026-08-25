import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { MovimientoCaja as MovimientoCajaApi } from '../../api/caja'
import { useCrearMovimientoCaja, useMovimientosCaja, useSaldoCaja } from '../../hooks/useMovimientosCaja'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Caja } from './Caja'

vi.mock('../../hooks/useUsuarioActual')
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
]

function mockearHooks(saldo = '300.00', crearMock = vi.fn()) {
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

describe('Caja', () => {
  it('un operador no ve el contenido del módulo de Caja', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    renderCaja()

    expect(screen.queryByRole('heading', { name: 'Caja' })).not.toBeInTheDocument()
    expect(screen.queryByText('Saldo actual de caja')).not.toBeInTheDocument()
  })

  it('un admin ve el saldo actual destacado', () => {
    mockearHooks('450.00')
    mockUsuarioActual('admin')

    renderCaja()

    expect(screen.getByText('Saldo actual de caja')).toBeInTheDocument()
    expect(screen.getByText('$450.00')).toBeInTheDocument()
  })

  it('muestra la referencia a la venta en un movimiento automático', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    renderCaja()

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByRole('link', { name: /ver venta #7/i })).toBeInTheDocument()
  })

  it('muestra un error claro cuando el backend rechaza un retiro por saldo insuficiente', async () => {
    const crearMock = vi.fn().mockRejectedValue({
      response: { data: { monto: ['Este retiro dejaría el saldo de caja en -50.00 — el saldo nunca puede ser negativo.'] } },
    })
    mockearHooks('300.00', crearMock)
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
    mockearHooks('300.00', crearMock)
    mockUsuarioActual('admin')

    renderCaja()
    fireEvent.click(screen.getByRole('button', { name: /registrar movimiento/i }))

    const dialogo = screen.getByRole('dialog', { name: /registrar movimiento de caja/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^registrar$/i }))

    expect(within(dialogo).getByRole('alert')).toHaveTextContent(/monto mayor a cero/i)
    expect(crearMock).not.toHaveBeenCalled()
  })
})
