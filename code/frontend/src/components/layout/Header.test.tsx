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

    expect(screen.getByRole('link', { name: /FleboSil/i })).toHaveAttribute('href', '/dashboard')
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

  it('el avatar del menú de usuario muestra la fotografía si la tiene', () => {
    mockUsuarioActual({
      data: { nombre: 'Ana', rol: 'admin', modulos: [], foto_usuario: 'http://servidor/fotos-usuarios/a.png' },
    })
    mockAlertasStock({ data: [] })

    renderHeader()

    expect(document.querySelector('img[src="http://servidor/fotos-usuarios/a.png"]')).toBeInTheDocument()
  })

  it('sin fotografía, el avatar del menú de usuario muestra las iniciales', () => {
    mockUsuarioActual({ data: { nombre: 'Ana Torres', rol: 'admin', modulos: [], foto_usuario: null } })
    mockAlertasStock({ data: [] })

    renderHeader()

    expect(screen.getByText('AT')).toBeInTheDocument()
  })
})

describe('Header — cierre de los menús desplegables', () => {
  const SOLICITUD = {
    id: 1, empleado: 3, periodo_inicio: '2026-01-01', periodo_fin: '2026-01-15',
    monto: '4500.00', estado: 'pendiente', fecha_solicitud: '2026-01-16', fecha_resolucion: null,
    resuelto_por: null,
  }

  beforeEach(() => {
    mockSolicitudesNomina()
    mockUsuarioActual({ data: { nombre: 'Ana', rol: 'admin', modulos: [] } })
    mockAlertasStock({ data: [] })
  })

  const campana = () => screen.getByRole('button', { name: /alertas de stock/i })
  const botonUsuario = () => screen.getByRole('button', { name: /ana/i })

  it('un clic fuera cierra el desplegable abierto', () => {
    renderHeader()
    fireEvent.click(campana())
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(campana()).toHaveAttribute('aria-expanded', 'false')
  })

  it('un clic dentro del desplegable no lo cierra', () => {
    renderHeader()
    fireEvent.click(campana())

    fireEvent.pointerDown(screen.getByText('Stock bajo el mínimo'))

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Escape cierra el desplegable y devuelve el foco a su botón', () => {
    renderHeader()
    fireEvent.click(botonUsuario())
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(botonUsuario()).toHaveFocus()
  })

  it('se cierra cuando el foco del teclado sale del desplegable', () => {
    renderHeader()
    fireEvent.click(botonUsuario())

    fireEvent.focusOut(screen.getByRole('button', { name: /cerrar sesión/i }), { relatedTarget: campana() })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('solo un desplegable abierto a la vez', () => {
    renderHeader()
    fireEvent.click(campana())
    fireEvent.click(botonUsuario())

    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(campana()).toHaveAttribute('aria-expanded', 'false')
    expect(botonUsuario()).toHaveAttribute('aria-expanded', 'true')
  })

  it('al navegar desde el menú de usuario, el menú se cierra', () => {
    renderHeader()
    fireEvent.click(botonUsuario())

    fireEvent.click(screen.getByRole('link', { name: /información de usuario/i }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('aprobar una solicitud de nómina no cierra las notificaciones', () => {
    mockSolicitudesNomina({ data: [SOLICITUD], isLoading: false })
    renderHeader()
    fireEvent.click(campana())

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('con todo cerrado, un clic fuera o Escape no cambian nada', () => {
    renderHeader()

    fireEvent.pointerDown(document.body)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(campana())
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})

