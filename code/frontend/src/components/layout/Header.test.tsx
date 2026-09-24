import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '../../context/AuthContext'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import {
  useAprobarSolicitudNomina,
  useRechazarSolicitudNomina,
  useSolicitudesNominaPendientes,
} from '../../hooks/useSolicitudesNomina'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Header } from './Header'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useAlertasStock')
vi.mock('../../hooks/useSolicitudesNomina')
vi.mock('../../context/AuthContext')

// Los mocks solo necesitan el subconjunto de campos que Header realmente lee;
// completar todo el tipo UseQueryResult en cada test sería ruido sin valor real.
function mockUsuarioActual(data: unknown) {
  vi.mocked(useUsuarioActual).mockReturnValue(data as ReturnType<typeof useUsuarioActual>)
}

function mockAlertasStock(data: unknown) {
  vi.mocked(useAlertasStock).mockReturnValue(data as ReturnType<typeof useAlertasStock>)
}

// Por defecto sin solicitudes pendientes — los tests que sí las necesitan
// llaman esta misma función con datos propios antes de `renderHeader()`.
function mockSolicitudesNomina(data: unknown = { data: [], isLoading: false }) {
  vi.mocked(useSolicitudesNominaPendientes).mockReturnValue(
    data as ReturnType<typeof useSolicitudesNominaPendientes>,
  )
  vi.mocked(useAprobarSolicitudNomina).mockReturnValue(
    { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useAprobarSolicitudNomina>,
  )
  vi.mocked(useRechazarSolicitudNomina).mockReturnValue(
    { mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRechazarSolicitudNomina>,
  )
}

function renderHeader() {
  const logoutMock = vi.fn()
  vi.mocked(useAuth).mockReturnValue({
    autenticado: true,
    login: vi.fn(),
    logout: logoutMock,
    iniciarSesionConTokens: vi.fn(),
  })
  render(
    <MemoryRouter>
      <Header onToggleSidebar={() => {}} />
    </MemoryRouter>,
  )
  return { logoutMock }
}

describe('Header', () => {
  // Sin solicitudes pendientes por defecto — los tests de nómina lo
  // sobreescriben explícitamente antes de renderizar.
  beforeEach(() => mockSolicitudesNomina())

  it('el logo enlaza al Dashboard', () => {
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({ data: [] })

    renderHeader()

    expect(screen.getByRole('link', { name: /SynapseERP/i })).toHaveAttribute('href', '/dashboard')
  })

  it('muestra el contador de notificaciones cuando hay alertas de stock', () => {
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({
      data: [
        { tipo: 'producto', nombre: 'Suero', sucursal: 'Matriz', stock_actual: 1, stock_minimo: 5 },
        { tipo: 'materia_prima', nombre: 'Cloruro', sucursal: 'Matriz', stock_actual: 1, stock_minimo: 5 },
      ],
    })

    renderHeader()

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('no muestra contador cuando no hay alertas', () => {
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({ data: [] })

    renderHeader()

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('el dropdown lista nombre y sucursal de cada ítem en alerta', () => {
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({
      data: [
        { tipo: 'producto', nombre: 'Suero', sucursal: 'Matriz', stock_actual: 1, stock_minimo: 5 },
        { tipo: 'materia_prima', nombre: 'Cloruro', sucursal: 'Norte', stock_actual: 1, stock_minimo: 5 },
      ],
    })

    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /alertas de stock/i }))

    expect(screen.getByText('Suero')).toBeInTheDocument()
    expect(screen.getByText('Matriz')).toBeInTheDocument()
    expect(screen.getByText('Cloruro')).toBeInTheDocument()
    expect(screen.getByText('Norte')).toBeInTheDocument()
  })

  it('muestra estado de carga en vez de afirmar que no hay alertas', () => {
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({ data: undefined, isLoading: true })

    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /alertas de stock/i }))

    expect(screen.getByText(/cargando alertas/i)).toBeInTheDocument()
    expect(screen.queryByText(/sin alertas de stock/i)).not.toBeInTheDocument()
  })

  it('cerrar sesión invalida la sesión activa', () => {
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({ data: [] })

    const { logoutMock } = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /ana/i }))
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))

    expect(logoutMock).toHaveBeenCalled()
  })

  it('admin ve las solicitudes de nómina pendientes y puede aprobarlas/rechazarlas', () => {
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({ data: [] })
    mockSolicitudesNomina({
      data: [
        {
          id: 1, empleado: 3, periodo_inicio: '2026-01-01', periodo_fin: '2026-01-15',
          monto: '4500.00', estado: 'pendiente', fecha_solicitud: '2026-01-16', fecha_resolucion: null,
          resuelto_por: null,
        },
      ],
    })

    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /alertas de stock/i }))

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Solicitudes de nómina')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
  })

  it('operador no ve la sección de solicitudes de nómina', () => {
    mockUsuarioActual({ data: { nombre: 'Beto', rol: 'operador', modulos: [] } })
    mockAlertasStock({ data: [] })

    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /alertas de stock/i }))

    expect(screen.queryByText('Solicitudes de nómina')).not.toBeInTheDocument()
  })
})
