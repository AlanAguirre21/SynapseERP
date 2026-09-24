import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import {
  useCrearSucursal,
  useDesactivarSucursal,
  useEditarSucursal,
  useReactivarSucursal,
  useSucursales,
} from '../../hooks/useSucursales'
import { Sucursales } from './Sucursales'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useSucursales')

const useSucursalesMock = vi.mocked(useSucursales)
const useCrearSucursalMock = vi.mocked(useCrearSucursal)
const useEditarSucursalMock = vi.mocked(useEditarSucursal)
const useDesactivarSucursalMock = vi.mocked(useDesactivarSucursal)
const useReactivarSucursalMock = vi.mocked(useReactivarSucursal)

function mockUsuarioActual(data: unknown) {
  vi.mocked(useUsuarioActual).mockReturnValue(data as ReturnType<typeof useUsuarioActual>)
}

const SUCURSALES = [
  { id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: 'Centro', telefono_sucursal: '555-0001', activo: true },
  { id: 2, nombre_sucursal: 'Norte', ubicacion_sucursal: 'Av. Norte', telefono_sucursal: '555-0002', activo: false },
]

function mockearHooksSucursales(reactivarMock: ReturnType<typeof vi.fn> = vi.fn()) {
  useSucursalesMock.mockReturnValue(
    { data: SUCURSALES, isLoading: false } as unknown as ReturnType<typeof useSucursales>,
  )
  useCrearSucursalMock.mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearSucursal>,
  )
  useEditarSucursalMock.mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarSucursal>,
  )
  useDesactivarSucursalMock.mockReturnValue(
    { mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarSucursal>,
  )
  useReactivarSucursalMock.mockReturnValue(
    { mutateAsync: reactivarMock, isPending: false } as unknown as ReturnType<typeof useReactivarSucursal>,
  )
}

describe('Sucursales', () => {
  it('renderiza la tabla con los datos de cada sucursal', () => {
    mockearHooksSucursales()
    mockUsuarioActual({ data: { rol: 'operador' } })

    render(<Sucursales />)

    expect(screen.getByText('Matriz')).toBeInTheDocument()
    expect(screen.getByText('Centro')).toBeInTheDocument()
    expect(screen.getByText('555-0001')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getByText('Norte')).toBeInTheDocument()
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
  })

  it('rol operador no ve botones de crear, editar, desactivar ni reactivar', () => {
    mockearHooksSucursales()
    mockUsuarioActual({ data: { rol: 'operador' } })

    render(<Sucursales />)

    expect(screen.queryByRole('button', { name: /nueva sucursal/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Desactivar')).not.toBeInTheDocument()
    expect(screen.queryByText('Reactivar')).not.toBeInTheDocument()
  })

  it('rol admin ve botones de crear, editar, desactivar y reactivar', () => {
    mockearHooksSucursales()
    mockUsuarioActual({ data: { rol: 'admin' } })

    render(<Sucursales />)

    expect(screen.getByRole('button', { name: /nueva sucursal/i })).toBeInTheDocument()
    expect(screen.getAllByText('Editar')).toHaveLength(2)
    // Solo la sucursal activa (Matriz) muestra el botón de desactivar.
    expect(screen.getAllByText('Desactivar')).toHaveLength(1)
    // Solo la sucursal inactiva (Norte) muestra el botón de reactivar.
    expect(screen.getAllByText('Reactivar')).toHaveLength(1)
  })

  it('reactivar pide confirmación con el nombre de la sucursal y llama al hook al confirmar', async () => {
    const reactivarMock = vi.fn().mockResolvedValue(undefined)
    mockearHooksSucursales(reactivarMock)
    mockUsuarioActual({ data: { rol: 'admin' } })

    render(<Sucursales />)
    fireEvent.click(screen.getByText('Reactivar'))

    expect(
      screen.getByText(/¿confirmas que quieres reactivar la sucursal "Norte"\?/i),
    ).toBeInTheDocument()

    const dialogo = screen.getByRole('dialog', { name: /reactivar sucursal/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^reactivar$/i }))

    await waitFor(() => expect(reactivarMock).toHaveBeenCalledWith(2))
  })

  it('muestra el error del backend si la reactivación es rechazada', async () => {
    const reactivarMock = vi.fn().mockRejectedValue({
      response: { data: { nombre_sucursal: ['Ya existe una sucursal activa con este nombre.'] } },
    })
    mockearHooksSucursales(reactivarMock)
    mockUsuarioActual({ data: { rol: 'admin' } })

    render(<Sucursales />)
    fireEvent.click(screen.getByText('Reactivar'))

    const dialogo = screen.getByRole('dialog', { name: /reactivar sucursal/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^reactivar$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una sucursal activa con este nombre.'),
    )
  })
})
