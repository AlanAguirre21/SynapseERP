import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Empleado } from '../../api/rrhh'
import type { RegistroAcceso, UsuarioCuenta } from '../../api/usuarios'
import { useEmpleado, useEmpleadosDisponibles } from '../../hooks/useEmpleadosRRHH'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import {
  useAccesosUsuario,
  useCrearUsuario,
  useDesactivarUsuario,
  useEditarUsuario,
  useReactivarUsuario,
  useUsuarios,
} from '../../hooks/useUsuarios'
import { Usuarios } from './Usuarios'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useUsuarios')
vi.mock('../../hooks/useEmpleadosRRHH')

const useUsuarioActualMock = vi.mocked(useUsuarioActual)
const useUsuariosMock = vi.mocked(useUsuarios)
const useAccesosUsuarioMock = vi.mocked(useAccesosUsuario)
const useEmpleadosDisponiblesMock = vi.mocked(useEmpleadosDisponibles)
const useEmpleadoMock = vi.mocked(useEmpleado)

const USUARIOS: UsuarioCuenta[] = [
  {
    id: 1, username: 'ana', first_name: 'Ana', last_name: 'Torres', email: 'ana@flebosil.test',
    rol_usuario: 'admin', empleado: 2, activo: true,
  },
  {
    id: 2, username: 'luis', first_name: 'Luis', last_name: 'Pérez', email: 'luis@flebosil.test',
    rol_usuario: 'operador', empleado: null, activo: false,
  },
]

const EMPLEADOS_DISPONIBLES: Empleado[] = [
  {
    id: 5, nombre_completo: 'Empleado Libre', curp: '', rfc: '', nss: '', telefono: '', email: '',
    fotografia: null, cuenta_bancaria: '', activo: true,
  },
]

const EMPLEADO_VINCULADO: Empleado = {
  id: 2, nombre_completo: 'Empleado Ya Vinculado', curp: '', rfc: '', nss: '', telefono: '', email: '',
  fotografia: null, cuenta_bancaria: '', activo: true,
}

function registrosDePrueba(cantidad: number): RegistroAcceso[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: i + 1,
    tipo: 'exitoso' as const,
    ip: '127.0.0.1',
    creado_en: `2026-0${(i % 9) + 1}-01T10:00:00Z`,
  }))
}

function mockearHooks({ accesos = [] }: { accesos?: RegistroAcceso[] } = {}) {
  useUsuarioActualMock.mockReturnValue(
    { data: { rol: 'admin' }, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
  )
  useUsuariosMock.mockReturnValue({ data: USUARIOS, isLoading: false } as unknown as ReturnType<typeof useUsuarios>)
  useAccesosUsuarioMock.mockReturnValue(
    { data: accesos, isLoading: false } as unknown as ReturnType<typeof useAccesosUsuario>,
  )
  useEmpleadosDisponiblesMock.mockReturnValue(
    { data: EMPLEADOS_DISPONIBLES, isLoading: false } as unknown as ReturnType<typeof useEmpleadosDisponibles>,
  )
  useEmpleadoMock.mockReturnValue(
    { data: undefined, isLoading: false } as unknown as ReturnType<typeof useEmpleado>,
  )

  vi.mocked(useCrearUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearUsuario>)
  vi.mocked(useEditarUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarUsuario>)
  vi.mocked(useDesactivarUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarUsuario>)
  vi.mocked(useReactivarUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarUsuario>)
}

function renderUsuarios() {
  return render(
    <MemoryRouter>
      <Usuarios />
    </MemoryRouter>,
  )
}

describe('Usuarios', () => {
  it('redirige a /dashboard si el usuario autenticado no es admin', () => {
    mockearHooks()
    useUsuarioActualMock.mockReturnValue(
      { data: { rol: 'operador' }, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
    )

    renderUsuarios()
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument()
  })

  it('oculta a los usuarios inactivos por default, con un toggle para mostrarlos', () => {
    mockearHooks()

    renderUsuarios()
    expect(screen.getByText('ana')).toBeInTheDocument()
    expect(screen.queryByText('luis')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/mostrar inactivos/i))
    expect(screen.getByText('luis')).toBeInTheDocument()
  })

  it('el selector de empleado del alta no lista empleados ya vinculados a otro usuario', () => {
    mockearHooks()

    renderUsuarios()
    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }))

    const dialogo = screen.getByRole('dialog', { name: /nuevo usuario/i })
    const selector = within(dialogo).getByLabelText(/empleado vinculado/i)
    expect(within(selector).getByText('Empleado Libre')).toBeInTheDocument()
    expect(within(selector).queryByText('Empleado Ya Vinculado')).not.toBeInTheDocument()
  })

  it('al editar un usuario con empleado ya vinculado, ese empleado sí aparece como opción', () => {
    mockearHooks()
    useEmpleadoMock.mockReturnValue(
      { data: EMPLEADO_VINCULADO, isLoading: false } as unknown as ReturnType<typeof useEmpleado>,
    )

    renderUsuarios()
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]!)

    const dialogo = screen.getByRole('dialog', { name: /editar usuario/i })
    const selector = within(dialogo).getByLabelText(/empleado vinculado/i)
    expect(within(selector).getByText('Empleado Ya Vinculado')).toBeInTheDocument()
  })

  it('el campo de contraseña solo aparece al crear, no al editar', () => {
    mockearHooks()

    renderUsuarios()
    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Contraseña')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]!)
    expect(within(screen.getByRole('dialog')).queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })

  it('al hacer click en el nombre de usuario, expande el panel de historial de accesos', () => {
    mockearHooks({ accesos: registrosDePrueba(3) })

    renderUsuarios()
    fireEvent.click(screen.getByRole('button', { name: /ana/i }))

    expect(screen.getByText('Historial de accesos de ana')).toBeInTheDocument()
    expect(useAccesosUsuarioMock).toHaveBeenCalledWith(1, '5')
  })

  it('el panel de accesos ofrece los selectores 5/10/todos', () => {
    mockearHooks({ accesos: registrosDePrueba(3) })

    renderUsuarios()
    fireEvent.click(screen.getByRole('button', { name: /ana/i }))

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(useAccesosUsuarioMock).toHaveBeenCalledWith(1, '10')

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(useAccesosUsuarioMock).toHaveBeenCalledWith(1, 'todos')
  })

  it('un usuario sin accesos registrados muestra un mensaje vacío', () => {
    mockearHooks({ accesos: [] })

    renderUsuarios()
    fireEvent.click(screen.getByRole('button', { name: /ana/i }))

    expect(screen.getByText('Este usuario todavía no tiene accesos registrados.')).toBeInTheDocument()
  })
})
