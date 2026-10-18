import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Usuario } from '../../api/usuarios'
import { useActualizarMiInformacion, useUsuarioActual } from '../../hooks/useUsuarioActual'
import { InformacionUsuario } from './InformacionUsuario'

vi.mock('../../hooks/useUsuarioActual')

const useUsuarioActualMock = vi.mocked(useUsuarioActual)
const useActualizarMiInformacionMock = vi.mocked(useActualizarMiInformacion)

const USUARIO: Usuario = {
  id: 1,
  username: 'juanp',
  email: 'juanp@flebosil.test',
  first_name: 'Juan',
  last_name: 'Pérez López',
  nombre: 'Juan Pérez López',
  rol: 'operador',
  modulos: [],
  foto_usuario: null,
}

const USUARIO_ADMIN: Usuario = { ...USUARIO, id: 2, username: 'admin1', rol: 'admin' }

function mockearHooks(actualizarMock: ReturnType<typeof vi.fn> = vi.fn(), usuario: Usuario = USUARIO) {
  useUsuarioActualMock.mockReturnValue(
    { data: usuario, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
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
      expect(actualizarMock).toHaveBeenCalledWith({
        username: 'juan_editado', email: 'juanp@flebosil.test', first_name: 'Juan', last_name: 'Pérez López',
      }),
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

  it('un operador no ve un selector de rol', () => {
    mockearHooks(vi.fn(), USUARIO)

    renderPagina()

    expect(screen.queryByLabelText(/^rol$/i)).not.toBeInTheDocument()
    expect(screen.getByText('Operador')).toBeInTheDocument()
  })

  it('un admin ve un selector de rol y puede cambiarlo, pasando por el mismo modal de confirmación', async () => {
    const actualizarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks(actualizarMock, USUARIO_ADMIN)

    renderPagina()
    fireEvent.change(screen.getByLabelText(/^rol$/i), { target: { value: 'operador' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(screen.getByRole('dialog', { name: /¿estás seguro\?/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() =>
      expect(actualizarMock).toHaveBeenCalledWith(
        expect.objectContaining({ rol_usuario: 'operador' }),
      ),
    )
  })
})

describe('InformacionUsuario — página de cuenta', () => {
  const MODULOS = [
    { slug: 'ventas', nombre: 'Ventas', ruta: '/ventas' },
    { slug: 'inventario', nombre: 'Inventario', ruta: '/inventario' },
  ]

  it('la cabecera de perfil muestra iniciales, nombre y "@usuario · rol" con los datos guardados', () => {
    mockearHooks()

    renderPagina()
    fireEvent.change(screen.getByDisplayValue('Juan'), { target: { value: 'Pedro' } })

    const perfil = screen.getByRole('region', { name: 'Perfil' })
    expect(within(perfil).getByText('JP')).toBeInTheDocument()
    expect(within(perfil).getByText('Juan Pérez López')).toBeInTheDocument()
    expect(within(perfil).getByText('@juanp · Operador')).toBeInTheDocument()
  })

  it('el correo tiene su ayuda enlazada sin cambiar el nombre del campo', () => {
    mockearHooks()

    renderPagina()

    const correo = screen.getByLabelText(/^correo electrónico$/i)
    expect(correo).toHaveAccessibleDescription(/con este correo inicias sesión/i)
  })

  it('el operador ve su rol como etiqueta, la descripción y sus módulos', () => {
    mockearHooks(vi.fn(), { ...USUARIO, modulos: MODULOS })

    renderPagina()

    expect(screen.getByText('Operador')).toHaveClass('status')
    expect(screen.getByText(/la operación diaria/i)).toBeInTheDocument()
    expect(screen.getByText('Módulos con acceso (2)')).toBeInTheDocument()
    const lista = screen.getByRole('list')
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ventas', 'Inventario'])
  })

  it('sin módulos muestra "—"', () => {
    mockearHooks()

    renderPagina()

    expect(screen.getByText('Módulos con acceso (0)')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('para admin, la descripción sigue al selector y avisa al cambiar el rol propio a operador', () => {
    mockearHooks(vi.fn(), USUARIO_ADMIN)

    renderPagina()

    const rol = screen.getByLabelText(/^rol$/i)
    expect(rol).toHaveAccessibleDescription(/acceso a todos los módulos/i)
    expect(screen.queryByText(/perderás el acceso/i)).not.toBeInTheDocument()

    fireEvent.change(rol, { target: { value: 'operador' } })

    expect(rol).toHaveAccessibleDescription(/la operación diaria.*perderás el acceso/i)
    expect(screen.getByText(/al guardar perderás el acceso a caja/i)).toBeInTheDocument()
    // El aviso no bloquea: el guardado sigue pasando por la confirmación.
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    expect(screen.getByRole('dialog', { name: /¿estás seguro\?/i })).toBeInTheDocument()
  })

  it('marca los cambios sin guardar y "Descartar cambios" restablece los valores guardados', () => {
    mockearHooks()

    renderPagina()

    expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /descartar cambios/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('juanp'), { target: { value: 'juan_editado' } })

    expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /descartar cambios/i }))

    expect(screen.getByDisplayValue('juanp')).toBeInTheDocument()
    expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument()
  })

  it('volver a escribir el valor guardado quita la marca de cambios', () => {
    mockearHooks()

    renderPagina()
    const usuario = screen.getByDisplayValue('juanp')
    fireEvent.change(usuario, { target: { value: 'otro' } })
    fireEvent.change(usuario, { target: { value: 'juanp' } })

    expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument()
  })
})

describe('InformacionUsuario — fotografía de perfil', () => {
  function archivo(nombre = 'foto.png', tipo = 'image/png', bytes = 10) {
    return new File([new Uint8Array(bytes)], nombre, { type: tipo })
  }

  function elegir(foto: File) {
    fireEvent.change(screen.getByLabelText('Fotografía de perfil'), { target: { files: [foto] } })
  }

  function imagenDelPerfil() {
    return screen.getByRole('region', { name: 'Perfil' }).querySelector('img')
  }

  it('elegir una fotografía muestra la vista previa y cuenta como cambio sin guardar', () => {
    mockearHooks()

    renderPagina()
    expect(screen.getByRole('button', { name: 'Agregar fotografía' })).toBeInTheDocument()

    elegir(archivo())

    expect(imagenDelPerfil()?.getAttribute('src')).toMatch(/^blob:/)
    expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar fotografía' })).toBeInTheDocument()
  })

  it('la fotografía solo se envía al confirmar, junto con el resto del formulario', async () => {
    const actualizarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks(actualizarMock)
    const foto = archivo()

    renderPagina()
    elegir(foto)
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    expect(actualizarMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() =>
      expect(actualizarMock).toHaveBeenCalledWith({
        username: 'juanp', email: 'juanp@flebosil.test', first_name: 'Juan', last_name: 'Pérez López',
        foto_usuario: foto,
      }),
    )
  })

  it('rechaza en el navegador un formato o tamaño no permitido, sin marcar cambios', () => {
    mockearHooks()

    renderPagina()
    elegir(archivo('foto.gif', 'image/gif'))

    expect(screen.getByRole('alert')).toHaveTextContent('La fotografía debe ser JPG, PNG o WebP de hasta 2 MB.')
    expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument()

    elegir(archivo('grande.jpg', 'image/jpeg', 2 * 1024 * 1024 + 1))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(imagenDelPerfil()).toBeNull()
  })

  it('con fotografía guardada, "Quitar fotografía" vuelve a las iniciales y envía null al confirmar', async () => {
    const actualizarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooks(actualizarMock, { ...USUARIO, foto_usuario: 'http://servidor/fotos-usuarios/a.png' })

    renderPagina()
    expect(imagenDelPerfil()).toHaveAttribute('src', 'http://servidor/fotos-usuarios/a.png')

    fireEvent.click(screen.getByRole('button', { name: 'Quitar fotografía' }))

    expect(imagenDelPerfil()).toBeNull()
    expect(screen.getByText('Tienes cambios sin guardar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() => expect(actualizarMock).toHaveBeenCalledWith(expect.objectContaining({ foto_usuario: null })))
  })

  it('"Descartar cambios" restablece la fotografía guardada', () => {
    mockearHooks(vi.fn(), { ...USUARIO, foto_usuario: 'http://servidor/fotos-usuarios/a.png' })

    renderPagina()
    elegir(archivo())
    expect(imagenDelPerfil()?.getAttribute('src')).toMatch(/^blob:/)

    fireEvent.click(screen.getByRole('button', { name: /descartar cambios/i }))

    expect(imagenDelPerfil()).toHaveAttribute('src', 'http://servidor/fotos-usuarios/a.png')
    expect(screen.queryByText('Tienes cambios sin guardar')).not.toBeInTheDocument()
  })
})
