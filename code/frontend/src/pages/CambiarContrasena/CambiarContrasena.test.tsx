import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { cambiarContrasena } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { CambiarContrasena } from './CambiarContrasena'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../api/auth')
vi.mock('../../context/AuthContext')

const cambiarContrasenaMock = vi.mocked(cambiarContrasena)

function mockAuth(data: unknown) {
  vi.mocked(useAuth).mockReturnValue(data as ReturnType<typeof useAuth>)
}

function renderPantalla({ state }: { state?: unknown } = {}) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/cambiar-contrasena', state }]}
    >
      <Routes>
        <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
        <Route path="/recuperar-contrasena" element={<div>Pantalla de recuperación</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  navigateMock.mockClear()
})

describe('CambiarContrasena', () => {
  it('redirige a /recuperar-contrasena si no hay correo en el estado de navegación', () => {
    mockAuth({ iniciarSesionConTokens: vi.fn() })

    renderPantalla()

    expect(screen.getByText('Pantalla de recuperación')).toBeInTheDocument()
  })

  it('renderiza el formulario cuando hay un correo validado en el estado', () => {
    mockAuth({ iniciarSesionConTokens: vi.fn() })

    renderPantalla({ state: { email: 'ana@flebosil.test' } })

    expect(screen.getByLabelText(/^nueva contraseña$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirmar nueva contraseña/i)).toBeInTheDocument()
  })

  it('muestra un error si las contraseñas no coinciden, sin llamar al backend', () => {
    const cambiarMock = vi.fn()
    cambiarContrasenaMock.mockImplementation(cambiarMock)
    mockAuth({ iniciarSesionConTokens: vi.fn() })

    renderPantalla({ state: { email: 'ana@flebosil.test' } })
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), {
      target: { value: 'clave-nueva-456' },
    })
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: 'otra-cosa-789' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.')
    expect(cambiarMock).not.toHaveBeenCalled()
  })

  it('inicia sesión con los tokens recibidos y redirige al Dashboard tras éxito', async () => {
    cambiarContrasenaMock.mockResolvedValue({ access: 'token-acceso', refresh: 'token-refresh' })
    const iniciarSesionConTokensMock = vi.fn()
    mockAuth({ iniciarSesionConTokens: iniciarSesionConTokensMock })

    renderPantalla({ state: { email: 'ana@flebosil.test' } })
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), {
      target: { value: 'clave-nueva-456' },
    })
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: 'clave-nueva-456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))

    await waitFor(() =>
      expect(iniciarSesionConTokensMock).toHaveBeenCalledWith('token-acceso', 'token-refresh'),
    )
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true })
    expect(cambiarContrasenaMock).toHaveBeenCalledWith(
      'ana@flebosil.test',
      'clave-nueva-456',
      'clave-nueva-456',
    )
  })

  it('muestra el mensaje específico del backend ante una contraseña que no cumple requisitos', async () => {
    cambiarContrasenaMock.mockRejectedValue({
      response: { data: { password: ['Esta contraseña es demasiado corta.'] } },
    })
    mockAuth({ iniciarSesionConTokens: vi.fn() })

    renderPantalla({ state: { email: 'ana@flebosil.test' } })
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: '123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Esta contraseña es demasiado corta.'),
    )
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
