import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { solicitarRecuperacion, verificarCodigo } from '../../api/auth'
import { RecuperarContrasena } from './RecuperarContrasena'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../api/auth')

const solicitarRecuperacionMock = vi.mocked(solicitarRecuperacion)
const verificarCodigoMock = vi.mocked(verificarCodigo)

function renderPantalla({ state }: { state?: unknown } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/recuperar-contrasena', state }]}>
      <RecuperarContrasena />
    </MemoryRouter>,
  )
}

async function avanzarAlPasoDeCodigo(email = 'ana@flebosil.test') {
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: /enviar código/i }))
  await waitFor(() => expect(screen.getByLabelText(/código de 6 dígitos/i)).toBeInTheDocument())
}

afterEach(() => {
  navigateMock.mockClear()
  solicitarRecuperacionMock.mockClear()
  verificarCodigoMock.mockClear()
})

describe('RecuperarContrasena', () => {
  it('muestra el mensaje explicativo recibido tras un redirect (ej. contexto de cambio expirado)', () => {
    renderPantalla({
      state: { mensaje: 'Tu sesión de recuperación expiró o no es válida. Solicita un nuevo código.' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tu sesión de recuperación expiró o no es válida.',
    )
  })

  it('paso 1: solicita únicamente el correo electrónico', () => {
    renderPantalla()

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar código/i })).toBeInTheDocument()
  })

  it('tras enviar el correo, muestra el paso de verificación con el mensaje genérico', async () => {
    solicitarRecuperacionMock.mockResolvedValue({
      detail: 'Si el correo está registrado, te enviamos un código de verificación.',
    })

    renderPantalla()
    await avanzarAlPasoDeCodigo()

    expect(solicitarRecuperacionMock).toHaveBeenCalledWith('ana@flebosil.test')
    expect(
      screen.getByText(/si el correo está registrado, te enviamos un código/i),
    ).toBeInTheDocument()
  })

  it('reenviar código vuelve a llamar a solicitarRecuperacion con el mismo correo', async () => {
    solicitarRecuperacionMock.mockResolvedValue({ detail: 'ok' })

    renderPantalla()
    await avanzarAlPasoDeCodigo()
    fireEvent.click(screen.getByRole('button', { name: /reenviar código/i }))

    await waitFor(() => expect(solicitarRecuperacionMock).toHaveBeenCalledTimes(2))
  })

  it('redirige a /cambiar-contrasena con el correo tras un código correcto', async () => {
    solicitarRecuperacionMock.mockResolvedValue({ detail: 'ok' })
    verificarCodigoMock.mockResolvedValue({ detail: 'Código verificado correctamente.' })

    renderPantalla()
    await avanzarAlPasoDeCodigo('ana@flebosil.test')
    fireEvent.change(screen.getByLabelText(/código de 6 dígitos/i), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/cambiar-contrasena', {
        replace: true,
        state: { email: 'ana@flebosil.test' },
      }),
    )
  })

  it('muestra un mensaje de error si el código es inválido o expiró', async () => {
    solicitarRecuperacionMock.mockResolvedValue({ detail: 'ok' })
    verificarCodigoMock.mockRejectedValue({
      response: { data: { detail: 'Código inválido o expirado.' } },
    })

    renderPantalla()
    await avanzarAlPasoDeCodigo()
    fireEvent.change(screen.getByLabelText(/código de 6 dígitos/i), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Código inválido o expirado.'),
    )
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
