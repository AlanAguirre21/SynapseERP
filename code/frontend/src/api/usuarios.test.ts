import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from './client'
import { actualizarMiInformacion, editarUsuarioCuenta, esFotoValida } from './usuarios'

vi.mock('./client', () => ({ apiClient: { patch: vi.fn(), post: vi.fn() } }))

const patchMock = vi.mocked(apiClient.patch)

const DATOS = { username: 'juanp', email: 'juanp@synapse.test', first_name: 'Juan', last_name: 'Pérez' }

describe('api/usuarios — fotografía de perfil', () => {
  beforeEach(() => {
    patchMock.mockReset()
    patchMock.mockResolvedValue({ data: {} })
  })

  it('sin cambio de fotografía envía el mismo JSON de siempre', async () => {
    await actualizarMiInformacion(DATOS)

    expect(patchMock).toHaveBeenCalledWith('/usuarios/me/', DATOS)
  })

  it('para quitarla envía JSON con foto_usuario: null', async () => {
    await actualizarMiInformacion({ ...DATOS, foto_usuario: null })

    expect(patchMock).toHaveBeenCalledWith('/usuarios/me/', { ...DATOS, foto_usuario: null })
  })

  it('con una fotografía nueva envía multipart con el archivo y los demás campos', async () => {
    const foto = new File([new Uint8Array(4)], 'foto.png', { type: 'image/png' })

    await actualizarMiInformacion({ ...DATOS, foto_usuario: foto })

    const cuerpo = patchMock.mock.calls[0]?.[1] as FormData
    expect(cuerpo).toBeInstanceOf(FormData)
    expect(cuerpo.get('foto_usuario')).toBe(foto)
    expect(cuerpo.get('username')).toBe('juanp')
  })

  it('en multipart, un empleado null viaja vacío', async () => {
    const foto = new File([new Uint8Array(4)], 'foto.png', { type: 'image/png' })

    await editarUsuarioCuenta(3, {
      first_name: 'Ana', last_name: 'Torres', email: 'ana@synapse.test', rol_usuario: 'operador',
      empleado: null, foto_usuario: foto,
    })

    const cuerpo = patchMock.mock.calls[0]?.[1] as FormData
    expect(cuerpo.get('empleado')).toBe('')
  })

  it('valida en el navegador formato y tamaño', () => {
    expect(esFotoValida(new File([new Uint8Array(4)], 'a.jpg', { type: 'image/jpeg' }))).toBe(true)
    expect(esFotoValida(new File([new Uint8Array(4)], 'a.gif', { type: 'image/gif' }))).toBe(false)
    expect(esFotoValida(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }))).toBe(false)
  })
})
