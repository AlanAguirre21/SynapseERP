import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { ResumenDashboard, ResumenVentas, ResumenCompras, ProductoTop, ClienteTop, MovimientoCajaReporte } from '../../api/reportes'
import { useResumenDashboard } from '../../hooks/useResumenDashboard'
import { useResumenVentas } from '../../hooks/useResumenVentas'
import { useResumenCompras } from '../../hooks/useResumenCompras'
import { useProductosTop } from '../../hooks/useProductosTop'
import { useClientesTop } from '../../hooks/useClientesTop'
import { useMovimientosCajaDashboard } from '../../hooks/useMovimientosCajaDashboard'
import { useSaldoCaja } from '../../hooks/useMovimientosCaja'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Dashboard } from './Dashboard'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../hooks/useResumenDashboard')
vi.mock('../../hooks/useResumenVentas')
vi.mock('../../hooks/useResumenCompras')
vi.mock('../../hooks/useProductosTop')
vi.mock('../../hooks/useClientesTop')
vi.mock('../../hooks/useMovimientosCajaDashboard')
vi.mock('../../hooks/useMovimientosCaja')
vi.mock('../../hooks/useUsuarioActual')

function resumenBase(overrides: Partial<ResumenDashboard> = {}): ResumenDashboard {
  return {
    periodo: 'dia',
    ventas_total: '500.00',
    compras_total: '200.00',
    ganancia: '300.00',
    serie: [
      { fecha: '2026-08-25T08:00:00-06:00', ganancia: '100.00' },
      { fecha: '2026-08-25T09:00:00-06:00', ganancia: '200.00' },
    ],
    ...overrides,
  }
}

function resumenVentasBase(overrides: Partial<ResumenVentas> = {}): ResumenVentas {
  return {
    periodo: 'dia',
    con_envio: [{ fecha: '2026-08-25T08:00:00-06:00', monto: '220.00' }],
    sin_envio: [{ fecha: '2026-08-25T08:00:00-06:00', monto: '200.00' }],
    envio: [{ fecha: '2026-08-25T08:00:00-06:00', monto: '20.00' }],
    conteo_estado: [
      { tipo: 'Pendiente', cantidad: 2 },
      { tipo: 'Entregada', cantidad: 5 },
    ],
    ...overrides,
  }
}

function resumenComprasBase(overrides: Partial<ResumenCompras> = {}): ResumenCompras {
  return {
    periodo: 'dia',
    todas: [{ fecha: '2026-08-25T08:00:00-06:00', monto: '300.00' }],
    productos: [{ fecha: '2026-08-25T08:00:00-06:00', monto: '200.00' }],
    insumos: [{ fecha: '2026-08-25T08:00:00-06:00', monto: '100.00' }],
    conteo_estado: [
      { tipo: 'Pendiente', cantidad: 1 },
      { tipo: 'Recibida', cantidad: 3 },
    ],
    ...overrides,
  }
}

const productosBase: ProductoTop[] = [{ producto: 'Medias de compresión', cantidad: '10.00' }]
const clientesBase: ClienteTop[] = [{ cliente: 'María Pérez', monto: '1500.00' }]
const movimientosBase: MovimientoCajaReporte[] = [
  { fecha: '2026-08-25T08:00:00-06:00', tipo_movimiento: 'ingreso', observacion: 'Venta #1' },
]

function mockearTodo({
  usuario = { nombre: 'Ana', rol: 'admin' as const },
  saldo = { saldo_actual: '1000.00', saldo_adicional: '0.00', saldo_total: '1000.00' },
}: {
  usuario?: { nombre: string; rol: 'admin' | 'operador' } | undefined
  saldo?: { saldo_actual: string; saldo_adicional: string; saldo_total: string }
} = {}) {
  vi.mocked(useResumenDashboard).mockReturnValue(
    { data: resumenBase(), isLoading: false } as unknown as ReturnType<typeof useResumenDashboard>,
  )
  vi.mocked(useResumenVentas).mockReturnValue(
    { data: resumenVentasBase(), isLoading: false } as unknown as ReturnType<typeof useResumenVentas>,
  )
  vi.mocked(useResumenCompras).mockReturnValue(
    { data: resumenComprasBase(), isLoading: false } as unknown as ReturnType<typeof useResumenCompras>,
  )
  vi.mocked(useProductosTop).mockReturnValue(
    { data: productosBase, isLoading: false } as unknown as ReturnType<typeof useProductosTop>,
  )
  vi.mocked(useClientesTop).mockReturnValue(
    { data: clientesBase, isLoading: false } as unknown as ReturnType<typeof useClientesTop>,
  )
  vi.mocked(useMovimientosCajaDashboard).mockReturnValue(
    { data: movimientosBase, isLoading: false } as unknown as ReturnType<typeof useMovimientosCajaDashboard>,
  )
  vi.mocked(useSaldoCaja).mockReturnValue(
    { data: saldo, isLoading: false } as unknown as ReturnType<typeof useSaldoCaja>,
  )
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: usuario, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('muestra el logotipo en el encabezado en lugar del título de texto', () => {
    mockearTodo()
    renderDashboard()

    expect(screen.getByRole('img', { name: 'FleboSil' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Resumen FleboSil' })).not.toBeInTheDocument()
  })

  it('muestra las 4 pestañas de periodo, incluyendo Año', () => {
    mockearTodo()
    renderDashboard()

    expect(screen.getByRole('tab', { name: 'Día' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Semana' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Año' })).toBeInTheDocument()
  })

  it('el rol operador solo ve la pestaña "Día", sin Semana/Mes/Año', () => {
    mockearTodo({ usuario: { nombre: 'Luis', rol: 'operador' } })
    renderDashboard()

    expect(screen.getByRole('tab', { name: 'Día' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Semana' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Mes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Año' })).not.toBeInTheDocument()
  })

  it('cambiar de periodo recalcula los datos de las secciones sin recargar', () => {
    mockearTodo()
    renderDashboard()

    fireEvent.click(screen.getByRole('tab', { name: 'Año' }))

    expect(useResumenDashboard).toHaveBeenLastCalledWith('año')
    expect(useResumenVentas).toHaveBeenLastCalledWith('año')
    expect(useResumenCompras).toHaveBeenLastCalledWith('año')
  })

  it('muestra "Saldo actual de la caja" para el rol admin', () => {
    mockearTodo({ usuario: { nombre: 'Ana', rol: 'admin' } })
    renderDashboard()

    expect(screen.getByText('Saldo actual de la caja')).toBeInTheDocument()
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })

  it('no muestra "Saldo actual de la caja" para el rol operador', () => {
    mockearTodo({ usuario: { nombre: 'Luis', rol: 'operador' } })
    renderDashboard()

    expect(screen.queryByText('Saldo actual de la caja')).not.toBeInTheDocument()
  })

  it('muestra las 6 secciones del panel', () => {
    mockearTodo()
    renderDashboard()

    expect(screen.getByRole('heading', { name: 'Ganancias del periodo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen de ventas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen de compras' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen de productos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen clientes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen facturación' })).toBeInTheDocument()
  })

  it('muestra "Ganancia de ventas" y "Gasto en compras" junto a sus botones respectivos', () => {
    mockearTodo()
    renderDashboard()

    expect(screen.getByText('Ganancia de ventas')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()

    expect(screen.getByText('Gasto en compras')).toBeInTheDocument()
    expect(screen.getByText('$200.00')).toBeInTheDocument()
  })

  it('"Nueva venta" vive en Resumen de ventas y navega al formulario de Ventas', () => {
    mockearTodo()
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Nueva venta' }))
    expect(navigateMock).toHaveBeenCalledWith('/ventas/nueva')
  })

  it('"Nueva compra" vive en Resumen de compras y navega al formulario de Compras', () => {
    mockearTodo()
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Nueva compra' }))
    expect(navigateMock).toHaveBeenCalledWith('/compras/nueva')
  })

  it('el ranking de productos alterna entre más y menos vendidos', () => {
    mockearTodo()
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Menos vendidos' }))
    expect(useProductosTop).toHaveBeenLastCalledWith('dia', 'menos')
  })

  it('el ranking de clientes alterna entre más y menos compras', () => {
    mockearTodo()
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Menos compras' }))
    expect(useClientesTop).toHaveBeenLastCalledWith('dia', 'menos')
  })

  it('el selector de movimientos financieros ofrece 5, 10 y todos', () => {
    mockearTodo()
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(useMovimientosCajaDashboard).toHaveBeenLastCalledWith('dia', 'todos')
  })

  it('la lista de movimientos financieros solo muestra fecha, tipo y descripción, nunca el monto', () => {
    mockearTodo()
    renderDashboard()

    const descripcion = screen.getByText('Venta #1')
    expect(descripcion).toBeInTheDocument()
    expect(screen.getByText('Ingreso')).toBeInTheDocument()

    const fila = descripcion.closest('li')
    expect(fila).not.toBeNull()
    expect(fila).not.toHaveTextContent(/\$\d/)
  })

  it('"Resumen facturación" muestra un mensaje de construcción, sin gráficas', () => {
    mockearTodo()
    renderDashboard()

    expect(screen.getByText('En construcción')).toBeInTheDocument()
  })

  it('muestra un estado vacío en Ganancias del periodo cuando no hay datos suficientes', () => {
    mockearTodo()
    vi.mocked(useResumenDashboard).mockReturnValue(
      {
        data: resumenBase({ ventas_total: '0.00', compras_total: '0.00', ganancia: '0.00', serie: [] }),
        isLoading: false,
      } as unknown as ReturnType<typeof useResumenDashboard>,
    )
    renderDashboard()

    expect(screen.getByText(/todavía no hay suficientes datos/i)).toBeInTheDocument()
  })
})
