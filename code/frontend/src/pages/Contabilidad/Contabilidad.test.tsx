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
})
