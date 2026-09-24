import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '../../context/AuthContext'
import { Login } from './Login'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../context/AuthContext')

function mockAuth(data: unknown) {
  vi.mocked(useAuth).mockReturnValue(data as ReturnType<typeof useAuth>)
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

afterEach(() => {
  navigateMock.mockClear()
})

describe('Login', () => {
  it('renderiza el formulario con correo, contraseña y enlace de recuperación', () => {
    mockAuth({ login: vi.fn() })

    renderLogin()

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /olvidaste tu contraseña/i })).toHaveAttribute(
      'href',
      '/recuperar-contrasena',
    )
  })

  it('no muestra ningún enlace ni formulario de autorregistro', () => {
    mockAuth({ login: vi.fn() })

    renderLogin()

    expect(screen.queryByText(/crear cuenta|regístrate|registrarse/i)).not.toBeInTheDocument()
  })

  it('no envía el formulario si los campos están vacíos', () => {
    const loginMock = vi.fn()
    mockAuth({ login: loginMock })

    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(loginMock).not.toHaveBeenCalled()
  })

  it('redirige al Dashboard tras un login exitoso', async () => {
    const loginMock = vi.fn().mockResolvedValue(undefined)
    mockAuth({ login: loginMock })

    renderLogin()
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@flebosil.test' },
    })
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: 'clave-super-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }),
    )
    expect(loginMock).toHaveBeenCalledWith('ana@flebosil.test', 'clave-super-123')
  })

  it('alterna la visibilidad de la contraseña al hacer clic en el botón de ojo', () => {
    mockAuth({ login: vi.fn() })

    renderLogin()
    const input = screen.getByLabelText(/^contraseña$/i)
    fireEvent.change(input, { target: { value: 'clave-super-123' } })
    expect(input).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }))
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('clave-super-123')

    fireEvent.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('muestra el mensaje de error genérico devuelto por el backend ante credenciales inválidas', async () => {
    const loginMock = vi.fn().mockRejectedValue({
      response: { data: { detail: 'Correo o contraseña incorrectos.' } },
    })
    mockAuth({ login: loginMock })

    renderLogin()
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@flebosil.test' },
    })
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'mal' } })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.'),
    )
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
