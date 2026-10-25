import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Venta } from '../../api/ventas'
import { useVistaPronostico } from '../../hooks/useAnalitica'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { useUsuarios } from '../../hooks/useUsuarios'
import { useVentas } from '../../hooks/useVentas'
import { Ventas } from './Ventas'

vi.mock('../../hooks/useClientes')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useUsuarioActual')
// 023: los pronósticos no son el objeto de estas pruebas; sin datos por defecto.
vi.mock('../../hooks/useAnalitica', () => {
  const vacio = () => ({ data: undefined, isLoading: false })
  return { useVistaPronostico: vi.fn(vacio), useDemandaPronosticada: vi.fn(vacio), useProyeccionDashboard: vi.fn(vacio) }
})
vi.mock('../../hooks/useUsuarios')
vi.mock('../../hooks/useVentas')

// 013, "Actualización: el operador solo ve sus propias ventas".

const VENTA: Venta = {
  id: 7, cliente: null, cliente_nombre: 'Sin cliente', sucursal: 1, sucursal_nombre: 'Matriz', usuario: 3,
  usuario_nombre: 'Luis Pérez', fecha: '2026-10-01T10:00:00Z', total: '100.00', estado: 'pendiente',
} as unknown as Venta

function preparar(rol: 'admin' | 'operador', ventas: Venta[] = [VENTA]) {
  vi.mocked(useUsuarioActual).mockReturnValue({ data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>)
  vi.mocked(useUsuarios).mockReturnValue({
    data: [{ id: 3, username: 'luis', first_name: 'Luis', last_name: 'Pérez' }],
  } as unknown as ReturnType<typeof useUsuarios>)
  vi.mocked(useVentas).mockReturnValue({ data: ventas, isLoading: false } as unknown as ReturnType<typeof useVentas>)
  vi.mocked(useSucursales).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useSucursales>)
  vi.mocked(useClientes).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useClientes>)
  vi.mocked(useProductos).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useProductos>)
  render(
    <MemoryRouter>
      <Ventas />
    </MemoryRouter>,
  )
}

describe('Ventas — registros propios', () => {
  it('el admin ve la columna y el filtro "Registrada por", y el filtro se envía', () => {
    preparar('admin')

    expect(screen.getByRole('columnheader', { name: 'Registrada por' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Luis Pérez' })).toBeInTheDocument()
    expect(useUsuarios).toHaveBeenLastCalledWith(true)

    fireEvent.change(screen.getByLabelText('Registrada por'), { target: { value: '3' } })

    expect(useVentas).toHaveBeenLastCalledWith(expect.objectContaining({ usuario: 3 }))
    expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeInTheDocument()
  })

  it('el operador no ve la columna ni el filtro, ni se pide la lista de usuarios', () => {
    preparar('operador')

    expect(screen.queryByRole('columnheader', { name: 'Registrada por' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Registrada por')).not.toBeInTheDocument()
    expect(useUsuarios).toHaveBeenLastCalledWith(false)
    expect(screen.getByText(/tus ventas registradas/i)).toBeInTheDocument()
  })

  it('el operador sin ventas ve "Todavía no has registrado ventas."', () => {
    preparar('operador', [])

    expect(screen.getByText('Todavía no has registrado ventas.')).toBeInTheDocument()
  })
})

describe('Ventas — pronóstico de ventas (023)', () => {
  it('el admin ve la sección de pronóstico con sus dos gráficas', () => {
    preparar('admin')

    expect(screen.getByRole('region', { name: 'Pronóstico de ventas' })).toBeInTheDocument()
    expect(useVistaPronostico).toHaveBeenCalledWith({ metrica: 'monto_ventas', horizonte: 'semanas_4' })
    expect(useVistaPronostico).toHaveBeenCalledWith({ metrica: 'numero_ventas', horizonte: 'semanas_4' })
  })

  it('el operador no ve la sección ni se consultan los pronósticos', () => {
    vi.mocked(useVistaPronostico).mockClear()
    preparar('operador')

    expect(screen.queryByRole('region', { name: 'Pronóstico de ventas' })).not.toBeInTheDocument()
    expect(useVistaPronostico).not.toHaveBeenCalled()
  })
})
