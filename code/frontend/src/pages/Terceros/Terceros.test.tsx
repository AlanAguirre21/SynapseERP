import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Compra } from '../../api/compras'
import type { Venta } from '../../api/ventas'
import {
  useClientes,
  useCrearCliente,
  useDesactivarCliente,
  useEditarCliente,
  useReactivarCliente,
} from '../../hooks/useClientes'
import { useCompras } from '../../hooks/useCompras'
import {
  useCrearProveedor,
  useDesactivarProveedor,
  useEditarProveedor,
  useProveedores,
  useReactivarProveedor,
} from '../../hooks/useProveedores'
import { useVentas } from '../../hooks/useVentas'
import { Terceros } from './Terceros'

vi.mock('../../hooks/useClientes')
vi.mock('../../hooks/useProveedores')
vi.mock('../../hooks/useVentas')
vi.mock('../../hooks/useCompras')

const useClientesMock = vi.mocked(useClientes)
const useProveedoresMock = vi.mocked(useProveedores)
const useVentasMock = vi.mocked(useVentas)
const useComprasMock = vi.mocked(useCompras)

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

function ventasDePrueba(cantidad: number): Venta[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: i + 1,
    cliente: 1,
    cliente_nombre: 'Hospital San Rafael',
    sucursal: 1,
    sucursal_nombre: 'Matriz',
    usuario: 1,
    usuario_nombre: 'admin1',
    fecha: `2026-0${(i % 9) + 1}-01T10:00:00Z`,
    fecha_entrega: null,
    fecha_entrega_real: null,
    total: '90.00',
    gasto_envio: '0.00',
    estado: 'entregada' as const,
    detalles: [],
  }))
}

function comprasDePrueba(cantidad: number): Compra[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: i + 1,
    proveedor: 1,
    proveedor_nombre: 'Distribuidora Médica',
    sucursal: 1,
    sucursal_nombre: 'Matriz',
    usuario: 1,
    usuario_nombre: 'admin1',
    fecha: `2026-0${(i % 9) + 1}-01T10:00:00Z`,
    fecha_entrega: null,
    total: '500.00',
    estado: 'recibida' as const,
    detalles_producto: [],
    detalles_materia_prima: [],
  }))
}

function mockearHooks({ ventas = [], compras = [] }: { ventas?: Venta[]; compras?: Compra[] } = {}) {
  useClientesMock.mockReturnValue({ data: CLIENTES, isLoading: false } as unknown as ReturnType<typeof useClientes>)
  useProveedoresMock.mockReturnValue({ data: PROVEEDORES, isLoading: false } as unknown as ReturnType<typeof useProveedores>)
  useVentasMock.mockReturnValue({ data: ventas, isLoading: false } as unknown as ReturnType<typeof useVentas>)
  useComprasMock.mockReturnValue({ data: compras, isLoading: false } as unknown as ReturnType<typeof useCompras>)

  vi.mocked(useCrearCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearCliente>)
  vi.mocked(useEditarCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarCliente>)
  vi.mocked(useDesactivarCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarCliente>)
  vi.mocked(useReactivarCliente).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarCliente>)

  vi.mocked(useCrearProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearProveedor>)
  vi.mocked(useEditarProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarProveedor>)
  vi.mocked(useDesactivarProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarProveedor>)
  vi.mocked(useReactivarProveedor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarProveedor>)
}

function renderTerceros() {
  return render(
    <MemoryRouter>
      <Terceros />
    </MemoryRouter>,
  )
}

describe('Terceros', () => {
  it('muestra la pestaña de Clientes por defecto', () => {
    mockearHooks()

    renderTerceros()

    expect(screen.getByText('Hospital San Rafael')).toBeInTheDocument()
    expect(screen.queryByText('Distribuidora Médica')).not.toBeInTheDocument()
  })

  it('cambia entre las pestañas de Clientes y Proveedores sin recargar la página', () => {
    mockearHooks()

    renderTerceros()

    fireEvent.click(screen.getByRole('tab', { name: 'Proveedores' }))
    expect(screen.getByText('Distribuidora Médica')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Clientes' }))
    expect(screen.getByText('Hospital San Rafael')).toBeInTheDocument()
  })

  it('no muestra una pestaña de Usuarios — esa pestaña se movió a 010 · Usuarios', () => {
    mockearHooks()

    renderTerceros()
    expect(screen.queryByRole('tab', { name: 'Usuarios' })).not.toBeInTheDocument()
  })

  it('la sección de datos fiscales del cliente aparece solo si se marca "requiere factura"', () => {
    mockearHooks()

    renderTerceros()
    fireEvent.click(screen.getByRole('button', { name: /nuevo cliente/i }))

    const dialogo = screen.getByRole('dialog', { name: /nuevo cliente/i })
    expect(within(dialogo).queryByLabelText('RFC')).not.toBeInTheDocument()

    fireEvent.click(within(dialogo).getByLabelText(/requiere factura/i))
    expect(within(dialogo).getByLabelText('RFC')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Razón social')).toBeInTheDocument()

    fireEvent.click(within(dialogo).getByLabelText(/requiere factura/i))
    expect(within(dialogo).queryByLabelText('RFC')).not.toBeInTheDocument()
  })

  it('al hacer click en el nombre de un cliente, expande y muestra sus ventas filtradas por ese cliente', () => {
    mockearHooks({ ventas: ventasDePrueba(3) })

    renderTerceros()
    fireEvent.click(screen.getByRole('button', { name: /hospital san rafael/i }))

    expect(screen.getByText('Ventas de Hospital San Rafael')).toBeInTheDocument()
    expect(useVentasMock).toHaveBeenCalledWith({ cliente: 1 })
  })

  it('vuelve a colapsar la sección de ventas si se hace click otra vez en el nombre', () => {
    mockearHooks({ ventas: ventasDePrueba(3) })

    renderTerceros()
    const boton = screen.getByRole('button', { name: /hospital san rafael/i })
    fireEvent.click(boton)
    expect(screen.getByText('Ventas de Hospital San Rafael')).toBeInTheDocument()

    fireEvent.click(boton)
    expect(screen.queryByText('Ventas de Hospital San Rafael')).not.toBeInTheDocument()
  })

  it('el selector 5/10/todos limita la cantidad de ventas mostradas', () => {
    mockearHooks({ ventas: ventasDePrueba(12) })

    renderTerceros()
    fireEvent.click(screen.getByRole('button', { name: /hospital san rafael/i }))

    expect(screen.getAllByText('Ver detalle')).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(screen.getAllByText('Ver detalle')).toHaveLength(10)

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(screen.getAllByText('Ver detalle')).toHaveLength(12)
  })

  it('un cliente sin ventas registradas muestra un mensaje vacío en vez de la lista', () => {
    mockearHooks({ ventas: [] })

    renderTerceros()
    fireEvent.click(screen.getByRole('button', { name: /hospital san rafael/i }))

    expect(screen.getByText('Este cliente todavía no tiene ventas registradas.')).toBeInTheDocument()
  })

  it('al hacer click en el nombre de un proveedor, expande y muestra sus compras filtradas por ese proveedor', () => {
    mockearHooks({ compras: comprasDePrueba(3) })

    renderTerceros()
    fireEvent.click(screen.getByRole('tab', { name: 'Proveedores' }))
    fireEvent.click(screen.getByRole('button', { name: /distribuidora médica/i }))

    expect(screen.getByText('Compras a Distribuidora Médica')).toBeInTheDocument()
    expect(useComprasMock).toHaveBeenCalledWith({ proveedor: 1 })
  })

  it('el selector 5/10/todos limita la cantidad de compras mostradas', () => {
    mockearHooks({ compras: comprasDePrueba(12) })

    renderTerceros()
    fireEvent.click(screen.getByRole('tab', { name: 'Proveedores' }))
    fireEvent.click(screen.getByRole('button', { name: /distribuidora médica/i }))

    expect(screen.getAllByText('Ver detalle')).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(screen.getAllByText('Ver detalle')).toHaveLength(10)

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(screen.getAllByText('Ver detalle')).toHaveLength(12)
  })
})
