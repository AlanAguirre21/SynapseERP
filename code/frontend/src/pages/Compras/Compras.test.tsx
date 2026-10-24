import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Compra } from '../../api/compras'
import { useCompras } from '../../hooks/useCompras'
import { useProveedores } from '../../hooks/useProveedores'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { useUsuarios } from '../../hooks/useUsuarios'
import { Compras } from './Compras'

vi.mock('../../hooks/useCompras')
vi.mock('../../hooks/useProveedores')
vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useUsuarios')

// 012, "Actualización: el operador solo ve sus propias compras".

const COMPRA = {
  id: 4, proveedor: 1, proveedor_nombre: 'Distribuidora Médica', sucursal: 1, sucursal_nombre: 'Matriz', usuario: 3,
  usuario_nombre: 'Luis Pérez', fecha: '2026-10-01T10:00:00Z', fecha_entrega: null, total: '80.00',
  estado: 'pendiente', detalles_producto: [], detalles_materia_prima: [],
} as Compra

function preparar(rol: 'admin' | 'operador', compras: Compra[] = [COMPRA]) {
  vi.mocked(useUsuarioActual).mockReturnValue({ data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>)
  vi.mocked(useUsuarios).mockReturnValue({
    data: [{ id: 3, username: 'luis', first_name: 'Luis', last_name: 'Pérez' }],
  } as unknown as ReturnType<typeof useUsuarios>)
  vi.mocked(useCompras).mockReturnValue({ data: compras, isLoading: false } as unknown as ReturnType<typeof useCompras>)
  vi.mocked(useProveedores).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useProveedores>)
  render(
    <MemoryRouter>
      <Compras />
    </MemoryRouter>,
  )
}

describe('Compras — registros propios', () => {
  it('el admin ve la columna y el filtro "Registrada por", y el filtro se envía', () => {
    preparar('admin')

    expect(screen.getByRole('columnheader', { name: 'Registrada por' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Luis Pérez' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Registrada por'), { target: { value: '3' } })

    expect(useCompras).toHaveBeenLastCalledWith(expect.objectContaining({ usuario: 3 }))
  })

  it('el operador no ve la columna ni el filtro, ni se pide la lista de usuarios', () => {
    preparar('operador')

    expect(screen.queryByRole('columnheader', { name: 'Registrada por' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Registrada por')).not.toBeInTheDocument()
    expect(useUsuarios).toHaveBeenLastCalledWith(false)
    expect(screen.getByText(/tus compras registradas/i)).toBeInTheDocument()
  })

  it('el operador sin compras ve "Todavía no has registrado compras."', () => {
    preparar('operador', [])

    expect(screen.getByText('Todavía no has registrado compras.')).toBeInTheDocument()
  })
})
