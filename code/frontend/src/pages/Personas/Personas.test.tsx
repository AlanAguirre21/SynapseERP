import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useClientes, useCrearCliente, useDesactivarCliente, useEditarCliente, useReactivarCliente } from '../../hooks/useClientes'
import { useCrearEmpleado, useDesactivarEmpleado, useEditarEmpleado, useEmpleados, useReactivarEmpleado } from '../../hooks/useEmpleados'
import { useCrearProveedor, useDesactivarProveedor, useEditarProveedor, useProveedores, useReactivarProveedor } from '../../hooks/useProveedores'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { useCrearUsuario, useDesactivarUsuario, useEditarUsuario, useReactivarUsuario, useUsuarios } from '../../hooks/useUsuarios'
import { Personas } from './Personas'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useClientes')
vi.mock('../../hooks/useProveedores')
vi.mock('../../hooks/useEmpleados')
vi.mock('../../hooks/useUsuarios')

const useClientesMock = vi.mocked(useClientes)
const useProveedoresMock = vi.mocked(useProveedores)
const useEmpleadosMock = vi.mocked(useEmpleados)
const useUsuariosMock = vi.mocked(useUsuarios)

function mockUsuarioActual(rol: 'admin' | 'operador') {
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

const CLIENTES = [
  {
    id: 1, nombre_cliente: 'Hospital San Rafael', telefono: '', email: '', direccion: '', activo: true,
    datos_fiscales: null,
  },
  {
    id: 2, nombre_cliente: 'Farmacia del Centro', telefono: '', email: '', direccion: '', activo: false,
    datos_fiscales: {
      rfc: 'XAXX010101000', razon_social: 'Farmacia del Centro SA', codigo_postal_fiscal: '01000',
      regimen_fiscal: '601', uso_cfdi_default: 'G03', requiere_factura: true,
    },
  },
]

const PROVEEDORES = [
  { id: 1, nombre_proveedor: 'Distribuidora Médica', rfc: '', contacto_nombre: '', telefono: '', email: '', direccion: '', activo: true },
]

const EMPLEADOS = [
  { id: 1, nombre_completo: 'Laura Gómez', puesto: 'Almacén', telefono: '', email: '', fecha_contratacion: null, salario: '8000.00', activo: true },
]

const USUARIOS = [
  { id: 1, username: 'laura', first_name: 'Laura', last_name: 'Gómez', email: 'laura@flebosil.test', rol_usuario: 'operador' as const, empleado: 1, activo: true },
]

function mockearHooks() {
  useClientesMock.mockReturnValue({ data: CLIENTES, isLoading: false } as unknown as ReturnType<typeof useClientes>)
  useProveedoresMock.mockReturnValue({ data: PROVEEDORES, isLoading: false } as unknown as ReturnType<typeof useProveedores>)
  useEmpleadosMock.mockReturnValue({ data: EMPLEADOS, isLoading: false } as unknown as ReturnType<typeof useEmpleados>)
  useUsuariosMock.mockReturnValue({ data: USUARIOS, isLoading: false } as unknown as ReturnType<typeof useUsuarios>)

  vi.mocked(useCrearCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearCliente>)
  vi.mocked(useEditarCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarCliente>)
  vi.mocked(useDesactivarCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarCliente>)
  vi.mocked(useReactivarCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarCliente>)

  vi.mocked(useCrearProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearProveedor>)
  vi.mocked(useEditarProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarProveedor>)
  vi.mocked(useDesactivarProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarProveedor>)
  vi.mocked(useReactivarProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarProveedor>)

  vi.mocked(useCrearEmpleado).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearEmpleado>)
  vi.mocked(useEditarEmpleado).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarEmpleado>)
  vi.mocked(useDesactivarEmpleado).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarEmpleado>)
  vi.mocked(useReactivarEmpleado).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarEmpleado>)

  vi.mocked(useCrearUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearUsuario>)
  vi.mocked(useEditarUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarUsuario>)
  vi.mocked(useDesactivarUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarUsuario>)
  vi.mocked(useReactivarUsuario).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarUsuario>)
}

describe('Personas', () => {
  it('muestra la pestaña de Clientes por defecto', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Personas />)

    expect(screen.getByText('Hospital San Rafael')).toBeInTheDocument()
    expect(screen.queryByText('Distribuidora Médica')).not.toBeInTheDocument()
  })

  it('cambia entre las cuatro pestañas sin recargar la página', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Personas />)

    fireEvent.click(screen.getByRole('tab', { name: 'Proveedores' }))
    expect(screen.getByText('Distribuidora Médica')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Empleados' }))
    expect(screen.getByText('Laura Gómez')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Usuarios' }))
    expect(screen.getByText('laura@flebosil.test')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Clientes' }))
    expect(screen.getByText('Hospital San Rafael')).toBeInTheDocument()
  })

  it('operador ve escritura habilitada en Clientes y Proveedores', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Personas />)
    expect(screen.getByRole('button', { name: /nuevo cliente/i })).toBeInTheDocument()
    expect(screen.getAllByText('Editar').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: 'Proveedores' }))
    expect(screen.getByRole('button', { name: /nuevo proveedor/i })).toBeInTheDocument()
  })

  it('operador no ve botones de escritura en Empleados ni Usuarios', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Personas />)

    fireEvent.click(screen.getByRole('tab', { name: 'Empleados' }))
    expect(screen.queryByRole('button', { name: /nuevo empleado/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Usuarios' }))
    expect(screen.queryByRole('button', { name: /nuevo usuario/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
  })

  it('admin ve botones de escritura en Empleados y Usuarios', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Personas />)

    fireEvent.click(screen.getByRole('tab', { name: 'Empleados' }))
    expect(screen.getByRole('button', { name: /nuevo empleado/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Usuarios' }))
    expect(screen.getByRole('button', { name: /nuevo usuario/i })).toBeInTheDocument()
  })

  it('la sección de datos fiscales del cliente aparece solo si se marca "requiere factura"', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    render(<Personas />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo cliente/i }))

    const dialogo = screen.getByRole('dialog', { name: /nuevo cliente/i })
    expect(within(dialogo).queryByLabelText('RFC')).not.toBeInTheDocument()

    fireEvent.click(within(dialogo).getByLabelText(/requiere factura/i))
    expect(within(dialogo).getByLabelText('RFC')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Razón social')).toBeInTheDocument()

    fireEvent.click(within(dialogo).getByLabelText(/requiere factura/i))
    expect(within(dialogo).queryByLabelText('RFC')).not.toBeInTheDocument()
  })

  it('el campo de contraseña solo aparece al crear un usuario, no al editar', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    render(<Personas />)
    fireEvent.click(screen.getByRole('tab', { name: 'Usuarios' }))

    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }))
    expect(
      within(screen.getByRole('dialog', { name: /nuevo usuario/i })).getByLabelText(/contraseña inicial/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    fireEvent.click(screen.getByText('Editar'))
    expect(
      within(screen.getByRole('dialog', { name: /editar usuario/i })).queryByLabelText(/contraseña inicial/i),
    ).not.toBeInTheDocument()
  })
})
