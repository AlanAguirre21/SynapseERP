import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { ResumenDashboard } from '../../api/reportes'
import { useResumenDashboard } from '../../hooks/useResumenDashboard'
import { Dashboard } from './Dashboard'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../hooks/useResumenDashboard')

function resumenBase(overrides: Partial<ResumenDashboard> = {}): ResumenDashboard {
  return {
    periodo: 'dia',
    ventas_total: '500.00',
    compras_total: '200.00',
    ganancia: '300.00',
    serie: [
      { fecha: '2026-08-25T08:00:00-06:00', ganancia: '100.00' },
      { fecha: '2026-08-25T09:00:00-06:00', ganancia: '200.00' },
    ],
    ...overrides,
  }
}

function mockearResumen(resumen: ResumenDashboard | undefined, isLoading = false) {
  vi.mocked(useResumenDashboard).mockReturnValue(
    { data: resumen, isLoading } as unknown as ReturnType<typeof useResumenDashboard>,
  )
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('muestra el título "Resumen FleboSil"', () => {
    mockearResumen(resumenBase())
    renderDashboard()

    expect(screen.getByRole('heading', { name: 'Resumen FleboSil' })).toBeInTheDocument()
  })

  it('muestra los totales de ventas, compras y ganancia uno junto al otro', () => {
    mockearResumen(resumenBase())
    renderDashboard()

    expect(screen.getByText('Ventas totales')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText('Compras totales')).toBeInTheDocument()
    expect(screen.getByText('$200.00')).toBeInTheDocument()
    expect(screen.getByText('Ganancia del periodo')).toBeInTheDocument()
    expect(screen.getByText('$300.00')).toBeInTheDocument()
  })

  it('cambia de periodo sin recargar la página', () => {
    mockearResumen(resumenBase())
    renderDashboard()

    fireEvent.click(screen.getByRole('tab', { name: 'Semana' }))

    expect(useResumenDashboard).toHaveBeenLastCalledWith('semana')
  })

  it('muestra un estado vacío claro cuando no hay datos suficientes en el periodo', () => {
    mockearResumen(resumenBase({ ventas_total: '0.00', compras_total: '0.00', ganancia: '0.00', serie: [] }))
    renderDashboard()

    expect(screen.getByText(/todavía no hay suficientes datos/i)).toBeInTheDocument()
  })

  it('no muestra el estado vacío cuando sí hay movimientos en el periodo', () => {
    mockearResumen(resumenBase())
    renderDashboard()

    expect(screen.queryByText(/todavía no hay suficientes datos/i)).not.toBeInTheDocument()
  })

  it('el acceso directo "Nueva venta" navega al formulario de Ventas', () => {
    mockearResumen(resumenBase())
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Nueva venta' }))
    expect(navigateMock).toHaveBeenCalledWith('/ventas/nueva')
  })

  it('el acceso directo "Nueva compra" navega al formulario de Compras', () => {
    mockearResumen(resumenBase())
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Nueva compra' }))
    expect(navigateMock).toHaveBeenCalledWith('/compras/nueva')
  })
})
