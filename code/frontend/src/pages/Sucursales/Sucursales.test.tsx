import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
<<<<<<< HEAD
import { describe, expect, it, vi } from 'vitest'

=======
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { AlertaStock } from '../../api/inventario'
import { useAlertasStock } from '../../hooks/useAlertasStock'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
=======
vi.mock('../../hooks/useAlertasStock')
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
function mockearHooksSucursales(reactivarMock: ReturnType<typeof vi.fn> = vi.fn()) {
=======
function mockAlertas(data: AlertaStock[] | undefined) {
  vi.mocked(useAlertasStock).mockReturnValue({ data } as unknown as ReturnType<typeof useAlertasStock>)
}

// El enlace "Ver inventario" necesita un enrutador.
function renderizar() {
  return render(
    <MemoryRouter>
      <Sucursales />
    </MemoryRouter>,
  )
}

function mockearHooksSucursales(reactivarMock: ReturnType<typeof vi.fn> = vi.fn()) {
  mockAlertas([])
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

<<<<<<< HEAD
    render(<Sucursales />)
=======
    renderizar()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
    render(<Sucursales />)
=======
    renderizar()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

    expect(screen.queryByRole('button', { name: /nueva sucursal/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Desactivar')).not.toBeInTheDocument()
    expect(screen.queryByText('Reactivar')).not.toBeInTheDocument()
  })

  it('rol admin ve botones de crear, editar, desactivar y reactivar', () => {
    mockearHooksSucursales()
    mockUsuarioActual({ data: { rol: 'admin' } })

<<<<<<< HEAD
    render(<Sucursales />)
=======
    renderizar()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
    render(<Sucursales />)
=======
    renderizar()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

<<<<<<< HEAD
    render(<Sucursales />)
=======
    renderizar()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    fireEvent.click(screen.getByText('Reactivar'))

    const dialogo = screen.getByRole('dialog', { name: /reactivar sucursal/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^reactivar$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una sucursal activa con este nombre.'),
    )
  })
})
<<<<<<< HEAD
=======

describe('Sucursales — directorio de ubicaciones', () => {
  function alerta(sucursal: string, stockActual: string, nombre = 'Ítem'): AlertaStock {
    return { tipo: 'producto', nombre, sucursal, stock_actual: stockActual, stock_minimo: '10.00' }
  }

  function tarjeta(nombre: string) {
    return screen.getByRole('article', { name: nombre })
  }

  it('cada tarjeta muestra la ficha con enlaces de teléfono y mapa, y "—" sin dato', () => {
    mockearHooksSucursales()
    useSucursalesMock.mockReturnValue({
      data: [
        ...SUCURSALES,
        { id: 3, nombre_sucursal: 'Sur', ubicacion_sucursal: '', telefono_sucursal: '', activo: true },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useSucursales>)
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()

    const matriz = tarjeta('Matriz')
    expect(within(matriz).getByRole('link', { name: '555-0001' })).toHaveAttribute('href', 'tel:5550001')
    const mapa = within(matriz).getByRole('link', { name: 'Ver en mapa' })
    expect(mapa).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Centro')
    expect(mapa).toHaveAttribute('target', '_blank')

    const sur = tarjeta('Sur')
    expect(within(sur).getAllByText('—')).toHaveLength(2)
    expect(within(sur).queryByRole('link', { name: 'Ver en mapa' })).not.toBeInTheDocument()
  })

  it('separa las alertas en bajo mínimo y agotados, solo en sucursales activas', () => {
    mockearHooksSucursales()
    mockAlertas([alerta('Matriz', '2.00'), alerta('Matriz', '3.00'), alerta('Matriz', '0.00'), alerta('Norte', '0.00')])
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()

    expect(within(tarjeta('Matriz')).getByText('2 bajo mínimo')).toHaveClass('statusWarning')
    expect(within(tarjeta('Matriz')).getByText('1 agotado')).toHaveClass('statusError')
    // Norte está inactiva: sus alertas no se muestran.
    expect(within(tarjeta('Norte')).queryByText(/agotado|bajo mínimo|sin alertas/i)).not.toBeInTheDocument()
  })

  it('una sucursal activa sin alertas muestra "Sin alertas"', () => {
    mockearHooksSucursales()
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()

    expect(within(tarjeta('Matriz')).getByText('Sin alertas')).toBeInTheDocument()
  })

  it('los indicadores cuentan activas, inactivas y activas con alertas', () => {
    mockearHooksSucursales()
    mockAlertas([alerta('Matriz', '2.00'), alerta('Norte', '1.00')])
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()

    const valor = (etiqueta: string) => screen.getByText(etiqueta).closest('.statTile')
    expect(valor('Sucursales activas')).toHaveTextContent('1')
    expect(valor('Sucursales inactivas')).toHaveTextContent('1')
    expect(valor('Con alertas de stock')).toHaveTextContent('1')
    expect(valor('Con alertas de stock')).toHaveClass('statTileWarning')
  })

  it('sin alertas disponibles, el indicador muestra "—" y las tarjetas omiten el stock', () => {
    mockearHooksSucursales()
    mockAlertas(undefined)
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()

    const indicador = screen.getByText('Con alertas de stock').closest('.statTile')
    expect(indicador).toHaveTextContent('—')
    expect(indicador).not.toHaveClass('statTileWarning')
    expect(screen.queryByText('Sin alertas')).not.toBeInTheDocument()
  })

  it('filtra por estado, muestra "Mostrando N de M" y "Limpiar filtros" solo con filtro', () => {
    mockearHooksSucursales()
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()

    expect(screen.getByText('Mostrando 2 de 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /limpiar filtros/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactivas' } })

    expect(screen.queryByRole('article', { name: 'Matriz' })).not.toBeInTheDocument()
    expect(tarjeta('Norte')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }))

    expect(screen.getByText('Mostrando 2 de 2')).toBeInTheDocument()
  })

  it('distingue la lista vacía de un filtro sin coincidencias', () => {
    mockearHooksSucursales()
    useSucursalesMock.mockReturnValue(
      { data: [SUCURSALES[0]], isLoading: false } as unknown as ReturnType<typeof useSucursales>,
    )
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactivas' } })

    expect(screen.getByText('Ninguna sucursal coincide con el filtro.')).toBeInTheDocument()
  })

  it('"Ver inventario" aparece solo en sucursales activas y lleva a su inventario', () => {
    mockearHooksSucursales()
    mockUsuarioActual({ data: { rol: 'operador' } })

    renderizar()

    expect(within(tarjeta('Matriz')).getByRole('link', { name: 'Ver inventario' })).toHaveAttribute(
      'href',
      '/inventario?sucursal=1',
    )
    expect(within(tarjeta('Norte')).queryByRole('link', { name: 'Ver inventario' })).not.toBeInTheDocument()
  })
})
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
