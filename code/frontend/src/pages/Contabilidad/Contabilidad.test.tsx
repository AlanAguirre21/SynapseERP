import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { AsientoContable, CuentaContable, FilaBalance } from '../../api/contabilidad'
import { useBalanceComprobacion } from '../../hooks/useBalanceComprobacion'
import {
  useCrearCuentaContable,
  useCuentasContables,
  useDesactivarCuentaContable,
  useEditarCuentaContable,
  useReactivarCuentaContable,
} from '../../hooks/useCuentasContables'
import { useExportarContabilidad, useLibroDiario } from '../../hooks/useLibroDiario'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Contabilidad } from './Contabilidad'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useCuentasContables')
vi.mock('../../hooks/useLibroDiario')
vi.mock('../../hooks/useBalanceComprobacion')

function mockUsuarioActual(rol: 'admin' | 'operador') {
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol }, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

const CUENTAS: CuentaContable[] = [
  { id: 1, codigo: '1100', nombre: 'Caja', tipo: 'activo', cuenta_padre: null, cuenta_padre_codigo: null, activo: true },
  { id: 2, codigo: '4100', nombre: 'Ventas', tipo: 'ingreso', cuenta_padre: null, cuenta_padre_codigo: null, activo: true },
]

const ASIENTOS: AsientoContable[] = [
  {
    id: 1, fecha: '2026-08-20T10:00:00Z', concepto: 'Venta #4', tipo_origen: 'caja', referencia_id: 4,
    usuario: 1, usuario_nombre: 'admin1',
    movimientos: [
      { id: 1, cuenta_contable: 1, cuenta_codigo: '1100', cuenta_nombre: 'Caja', tipo_movimiento: 'cargo', monto: '90.00' },
      { id: 2, cuenta_contable: 2, cuenta_codigo: '4100', cuenta_nombre: 'Ventas', tipo_movimiento: 'abono', monto: '90.00' },
    ],
  },
]

const BALANCE: FilaBalance[] = [
  { cuenta: 1, codigo: '1100', nombre: 'Caja', tipo: 'activo', total_cargos: '90.00', total_abonos: '0.00', saldo: '90.00' },
]

const exportarMutateAsync = vi.fn().mockResolvedValue(new Blob(['contenido']))

function mockearHooks() {
  vi.mocked(useCuentasContables).mockReturnValue(
    { data: CUENTAS, isLoading: false } as unknown as ReturnType<typeof useCuentasContables>,
  )
  vi.mocked(useCrearCuentaContable).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearCuentaContable>)
  vi.mocked(useEditarCuentaContable).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarCuentaContable>)
  vi.mocked(useDesactivarCuentaContable).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarCuentaContable>)
  vi.mocked(useReactivarCuentaContable).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarCuentaContable>)

  vi.mocked(useLibroDiario).mockReturnValue({ data: ASIENTOS, isLoading: false } as unknown as ReturnType<typeof useLibroDiario>)
  vi.mocked(useExportarContabilidad).mockReturnValue(
    { mutateAsync: exportarMutateAsync, isPending: false } as unknown as ReturnType<typeof useExportarContabilidad>,
  )
  vi.mocked(useBalanceComprobacion).mockReturnValue({ data: BALANCE, isLoading: false } as unknown as ReturnType<typeof useBalanceComprobacion>)
}

function renderContabilidad() {
  return render(
    <MemoryRouter>
      <Contabilidad />
    </MemoryRouter>,
  )
}

beforeAll(() => {
  // jsdom no implementa `URL.createObjectURL` — se necesita para el botón
  // de exportación, que arma un enlace de descarga a partir del blob.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

describe('Contabilidad', () => {
  it('un operador es redirigido y no ve el contenido', () => {
    mockUsuarioActual('operador')
    mockearHooks()
    renderContabilidad()

    expect(screen.queryByText('Contabilidad')).not.toBeInTheDocument()
  })

  it('un admin ve el catálogo de cuentas por defecto', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()

    expect(screen.getByRole('heading', { name: 'Contabilidad' })).toBeInTheDocument()
    expect(screen.getByText('Catálogo de cuentas contables')).toBeInTheDocument()
    expect(screen.getByText('1100')).toBeInTheDocument()
  })

  it('cambia al libro diario al hacer clic en la pestaña', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()

    fireEvent.click(screen.getByRole('tab', { name: 'Libro diario' }))

    expect(screen.getByText('Venta #4')).toBeInTheDocument()
  })

  it('expande y colapsa un asiento del libro diario mostrando sus movimientos', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Libro diario' }))

    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /venta #4/i }))
    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByText(/1100.*Caja/)).toBeInTheDocument()
    expect(tabla.getAllByText('90.00')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /venta #4/i }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('cambia al balance de comprobación al hacer clic en la pestaña', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()

    fireEvent.click(screen.getByRole('tab', { name: 'Balance de comprobación' }))

    expect(screen.getByRole('heading', { name: 'Balance de comprobación' })).toBeInTheDocument()
    expect(screen.getByText(/90.00 \(deudor\)/)).toBeInTheDocument()
  })

  it('exporta el libro diario en CSV al hacer clic en el botón', async () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Libro diario' }))

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }))

    await vi.waitFor(() => {
      expect(exportarMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'libro_diario' }))
    })
  })

  it('exporta el balance de comprobación en CSV al hacer clic en el botón', async () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Balance de comprobación' }))

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }))

    await vi.waitFor(() => {
      expect(exportarMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'balance' }))
    })
  })

  it('el catálogo se ordena como jerarquía, con la naturaleza de cada cuenta', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    vi.mocked(useCuentasContables).mockReturnValue({
      data: [
        { id: 3, codigo: '1100', nombre: 'Caja', tipo: 'activo', cuenta_padre: 1, cuenta_padre_codigo: '1000', activo: true },
        { id: 4, codigo: '2000', nombre: 'Pasivo', tipo: 'pasivo', cuenta_padre: null, cuenta_padre_codigo: null, activo: true },
        { id: 1, codigo: '1000', nombre: 'Activo', tipo: 'activo', cuenta_padre: null, cuenta_padre_codigo: null, activo: true },
        { id: 5, codigo: '1110', nombre: 'Caja chica', tipo: 'activo', cuenta_padre: 3, cuenta_padre_codigo: '1100', activo: true },
        // Padre ausente de la lista: va al primer nivel en lugar de perderse.
        { id: 6, codigo: '9000', nombre: 'Huérfana', tipo: 'egreso', cuenta_padre: 99, cuenta_padre_codigo: '9900', activo: true },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useCuentasContables>)
    renderContabilidad()

    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getAllByRole('cell')[0]?.textContent)).toEqual([
      '1000', '1100', '1110', '2000', '9000',
    ])

    const filaActivo = screen.getByText('Activo', { selector: 'span' }).closest('tr') as HTMLElement
    expect(filaActivo).toHaveTextContent('Deudora')
    expect(within(filaActivo).getByText('1000')).toHaveClass(/accountGroup/)

    const filaPasivo = screen.getByText('Pasivo', { selector: 'span' }).closest('tr') as HTMLElement
    expect(filaPasivo).toHaveTextContent('Acreedora')
    expect(screen.getByText('Caja chica')).toHaveClass(/accountLevel2/)
  })

  it('cada póliza muestra su número e importe, y al desplegarse confirma que cuadra', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Libro diario' }))

    const poliza = screen.getByRole('button', { name: /venta #4/i })
    expect(poliza).toHaveTextContent('Póliza #1')
    expect(poliza).toHaveTextContent('90.00')

    fireEvent.click(poliza)
    expect(screen.getByText('Sumas iguales')).toBeInTheDocument()
    expect(screen.getByText('Cuadra')).toBeInTheDocument()
  })

  it('una póliza descuadrada lo indica con la diferencia', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    vi.mocked(useLibroDiario).mockReturnValue({
      data: [
        {
          ...(ASIENTOS[0] as AsientoContable),
          movimientos: [
            { id: 1, cuenta_contable: 1, cuenta_codigo: '1100', cuenta_nombre: 'Caja', tipo_movimiento: 'cargo', monto: '100.00' },
            { id: 2, cuenta_contable: 2, cuenta_codigo: '4100', cuenta_nombre: 'Ventas', tipo_movimiento: 'abono', monto: '90.00' },
          ],
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useLibroDiario>)
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Libro diario' }))
    fireEvent.click(screen.getByRole('button', { name: /venta #4/i }))

    expect(screen.getByText('Descuadre de 10.00')).toBeInTheDocument()
  })

  it('el libro diario muestra 10 pólizas por defecto, con selector 5 / 10 / Todos', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    const muchos = Array.from({ length: 12 }, (_, i) => ({ ...(ASIENTOS[0] as AsientoContable), id: 100 + i }))
    vi.mocked(useLibroDiario).mockReturnValue({ data: muchos, isLoading: false } as unknown as ReturnType<typeof useLibroDiario>)
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Libro diario' }))

    const polizas = () => screen.getAllByRole('button', { name: /póliza #/i }).length
    expect(polizas()).toBe(10)
    expect(screen.getByText('Mostrando 10 de 12')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(polizas()).toBe(5)

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(polizas()).toBe(12)
  })

  it('"Limpiar filtros" en el libro diario restablece los filtros', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Libro diario' }))
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()

    const origen = screen.getByLabelText('Origen')
    fireEvent.change(origen, { target: { value: 'compra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(origen).toHaveValue('')
  })

  it('el balance formatea los importes y su fila de sumas indica si cuadra', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    vi.mocked(useBalanceComprobacion).mockReturnValue({
      data: [
        { cuenta: 1, codigo: '1100', nombre: 'Caja', tipo: 'activo', total_cargos: '101370', total_abonos: '2942', saldo: '98428' },
        { cuenta: 2, codigo: '3000', nombre: 'Capital', tipo: 'capital', total_cargos: '0', total_abonos: '98428', saldo: '-98428' },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBalanceComprobacion>)
    const { container } = renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Balance de comprobación' }))

    const filaCaja = screen.getByRole('cell', { name: 'Caja' }).closest('tr') as HTMLElement
    expect(within(filaCaja).getByText('101,370.00')).toBeInTheDocument()
    expect(within(filaCaja).getByText('2,942.00')).toBeInTheDocument()
    expect(screen.getByText('98,428.00 (deudor)')).toBeInTheDocument()
    expect(screen.getByText('98,428.00 (acreedor)')).toBeInTheDocument()

    const pie = container.querySelector('tfoot') as HTMLElement
    expect(pie).toHaveTextContent('Sumas')
    // 101,370 + 0 = 2,942 + 98,428
    expect(within(pie).getAllByText('101,370.00')).toHaveLength(2)
    expect(screen.getByText('Cuadra')).toBeInTheDocument()
  })

  it('el balance indica el descuadre cuando las sumas no coinciden', () => {
    mockUsuarioActual('admin')
    mockearHooks()
    vi.mocked(useBalanceComprobacion).mockReturnValue({
      data: [
        { cuenta: 1, codigo: '1100', nombre: 'Caja', tipo: 'activo', total_cargos: '100.00', total_abonos: '0.00', saldo: '100.00' },
        { cuenta: 2, codigo: '4100', nombre: 'Ventas', tipo: 'ingreso', total_cargos: '0.00', total_abonos: '75.50', saldo: '-75.50' },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBalanceComprobacion>)
    renderContabilidad()
    fireEvent.click(screen.getByRole('tab', { name: 'Balance de comprobación' }))

    expect(screen.getByText('Descuadre de 24.50')).toBeInTheDocument()
  })
})
