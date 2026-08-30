import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useActualizarMiInformacion, useUsuarioActual } from '../../hooks/useUsuarioActual'
import { InformacionUsuario } from './InformacionUsuario'

vi.mock('../../hooks/useUsuarioActual')

const useUsuarioActualMock = vi.mocked(useUsuarioActual)
const useActualizarMiInformacionMock = vi.mocked(useActualizarMiInformacion)

const USUARIO = {
  id: 1,
  username: 'juanp',
  email: 'juanp@flebosil.test',
  nombre: 'Juan Pérez',
  rol: 'operador' as const,
  modulos: [],
}

function mockearHooks(actualizarMock: ReturnType<typeof vi.fn> = vi.fn()) {
  useUsuarioActualMock.mockReturnValue(
    { data: USUARIO, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
  )
  useActualizarMiInformacionMock.mockReturnValue(
    { mutateAsync: actualizarMock, isPending: false } as unknown as ReturnType<typeof useActualizarMiInformacion>,
  )
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <InformacionUsuario />
    </MemoryRouter>,
  )
}

describe('InformacionUsuario', () => {
  it('precarga el formulario con los datos actuales y muestra el rol de solo lectura', () => {
    mockearHooks()

    renderPagina()

    expect(screen.getByDisplayValue('juanp')).toBeInTheDocument()
    expect(screen.getByDisplayValue('juanp@flebosil.test')).toBeInTheDocument()
    expect(screen.getByText('Operador')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /rol/i })).not.toBeInTheDocument()
  })

  it('al guardar, primero pide confirmación sin llamar al backend', () => {
    const actualizarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks(actualizarMock)

    renderPagina()
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(screen.getByRole('dialog', { name: /¿estás seguro\?/i })).toBeInTheDocument()
    expect(actualizarMock).not.toHaveBeenCalled()
  })

  it('cancelar en el modal no guarda y conserva los valores editados', () => {
    mockearHooks()

    renderPagina()
    fireEvent.change(screen.getByDisplayValue('juanp'), { target: { value: 'juan_editado' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('juan_editado')).toBeInTheDocument()
  })

  it('confirmar guarda los cambios y muestra confirmación visual de éxito', async () => {
    const actualizarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks(actualizarMock)

    renderPagina()
    fireEvent.change(screen.getByDisplayValue('juanp'), { target: { value: 'juan_editado' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() =>
      expect(actualizarMock).toHaveBeenCalledWith({ username: 'juan_editado', email: 'juanp@flebosil.test' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('se actualizó correctamente')
  })

  it('muestra el error del backend si el email ya está en uso', async () => {
    const actualizarMock = vi.fn().mockRejectedValue({
      response: { data: { email: ['Ya existe un usuario con este correo.'] } },
    })
    mockearHooks(actualizarMock)

    renderPagina()
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un usuario con este correo.'),
    )
  })

  it('el enlace "Cambiar contraseña" apunta a /recuperar-contrasena y está debajo del correo electrónico', () => {
    mockearHooks()

    renderPagina()

    const campoCorreo = screen.getByLabelText(/correo electrónico/i)
    const enlace = screen.getByRole('link', { name: /cambiar contraseña/i })

    expect(enlace).toHaveAttribute('href', '/recuperar-contrasena')
    expect(
      campoCorreo.compareDocumentPosition(enlace) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
