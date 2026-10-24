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
<<<<<<< HEAD
=======
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import { useVentas } from '../../hooks/useVentas'
import { Terceros } from './Terceros'

vi.mock('../../hooks/useClientes')
vi.mock('../../hooks/useProveedores')
vi.mock('../../hooks/useVentas')
vi.mock('../../hooks/useCompras')
<<<<<<< HEAD
=======
vi.mock('../../hooks/useUsuarioActual')
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
function mockearHooks({ ventas = [], compras = [] }: { ventas?: Venta[]; compras?: Compra[] } = {}) {
=======
// El historial lee el rol para su aclaración (009, "historial propio para el operador").
function mockearHooks({
  ventas = [], compras = [], rol = 'admin',
}: { ventas?: Venta[]; compras?: Compra[]; rol?: 'admin' | 'operador' } = {}) {
  vi.mocked(useUsuarioActual).mockReturnValue({ data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
=======

  it('la acción del encabezado corresponde a la pestaña activa y abre su formulario', () => {
    mockearHooks()
    renderTerceros()

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo cliente' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    fireEvent.click(screen.getByRole('tab', { name: 'Proveedores' }))
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo proveedor' })).toBeInTheDocument()
  })

  it('el historial se despliega justo debajo de la fila del cliente', () => {
    mockearHooks({ ventas: ventasDePrueba(2) })
    renderTerceros()

    fireEvent.click(screen.getByRole('button', { name: /hospital san rafael/i }))

    const filaCliente = screen.getByRole('button', { name: /hospital san rafael/i }).closest('tr') as HTMLElement
    const filaSiguiente = filaCliente.nextElementSibling as HTMLElement
    expect(filaSiguiente).toHaveTextContent('Ventas de Hospital San Rafael')
    expect(filaSiguiente.nextElementSibling).toHaveTextContent('Farmacia del Centro')
  })

  it('el estado de cuenta resume documentos e importe sin contar cancelados, y lista folio, total y estado', () => {
    const ventas = ventasDePrueba(3).map((v, i) => (i === 2 ? { ...v, estado: 'cancelada' as const } : v))
    mockearHooks({ ventas })
    renderTerceros()

    fireEvent.click(screen.getByRole('button', { name: /hospital san rafael/i }))

    const seccion = screen.getByText('Ventas de Hospital San Rafael').closest('.expandedSection') as HTMLElement
    const resumen = within(seccion.querySelector('dl') as HTMLElement)
    expect(resumen.getByText('Ventas').closest('div')).toHaveTextContent('3')
    // 90 + 90; la venta cancelada no cuenta.
    expect(resumen.getByText('Importe (sin cancelados)').closest('div')).toHaveTextContent('$180.00')

    const filaVenta = within(seccion).getByText('#1').closest('tr') as HTMLElement
    expect(filaVenta).toHaveTextContent('$90.00')
    expect(filaVenta).toHaveTextContent('Entregada')
    expect(within(seccion).getByText('Cancelada')).toBeInTheDocument()
  })

  it('busca clientes por nombre o RFC y filtra por factura y estado', () => {
    mockearHooks()
    renderTerceros()

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'xaxx0101' } })
    expect(screen.getByText('Farmacia del Centro')).toBeInTheDocument()
    expect(screen.queryByText('Hospital San Rafael')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    fireEvent.change(screen.getByLabelText('Factura'), { target: { value: 'no_requiere' } })
    expect(screen.getByText('Hospital San Rafael')).toBeInTheDocument()
    expect(screen.queryByText('Farmacia del Centro')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Factura'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactivos' } })
    expect(screen.getByText('Farmacia del Centro')).toBeInTheDocument()
    expect(screen.queryByText('Hospital San Rafael')).not.toBeInTheDocument()
  })

  it('la columna Factura muestra el RFC de quien requiere factura', () => {
    mockearHooks()
    renderTerceros()

    expect(screen.getByText('Farmacia del Centro').closest('tr')).toHaveTextContent('XAXX010101000')
    const filaHospital = screen.getByText('Hospital San Rafael').closest('tr') as HTMLElement
    expect(within(filaHospital).getAllByRole('cell').map((c) => c.textContent)).toContain('—')
  })

  it('los proveedores muestran su RFC y se buscan también por contacto', () => {
    mockearHooks()
    useProveedoresMock.mockReturnValue({
      data: [
        ...PROVEEDORES,
        { id: 2, nombre_proveedor: 'Químicos del Bajío', rfc: 'QBA010101AB1', contacto_nombre: 'Lucía Pérez', telefono: '', email: '', direccion: '', activo: true },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useProveedores>)
    renderTerceros()
    fireEvent.click(screen.getByRole('tab', { name: 'Proveedores' }))

    expect(screen.getByText('Químicos del Bajío').closest('tr')).toHaveTextContent('QBA010101AB1')

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'lucia' } })
    expect(screen.getByText('Químicos del Bajío')).toBeInTheDocument()
    expect(screen.queryByText('Distribuidora Médica')).not.toBeInTheDocument()
  })

  it('el formulario de cliente describe el régimen fiscal y el uso de CFDI sin cambiar el nombre de los campos', () => {
    mockearHooks()
    renderTerceros()

    const filaFarmacia = screen.getByText('Farmacia del Centro').closest('tr') as HTMLElement
    fireEvent.click(within(filaFarmacia).getByRole('button', { name: 'Editar' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Editar cliente' }))

    expect(dialogo.getByLabelText('Régimen fiscal')).toHaveValue('601')
    expect(dialogo.getByText('601 — General de Ley Personas Morales')).toBeInTheDocument()
    expect(dialogo.getByLabelText('Uso de CFDI por defecto')).toHaveValue('G03')
    expect(dialogo.getByText('G03 — Gastos en general')).toBeInTheDocument()

    fireEvent.change(dialogo.getByLabelText('Régimen fiscal'), { target: { value: '999' } })
    expect(dialogo.queryByText(/^601 —/)).not.toBeInTheDocument()
  })

  // 009, "Actualización: historial propio para el operador".
  it('para el operador el historial aclara que son solo sus ventas y compras; para el admin no', () => {
    mockearHooks({ ventas: ventasDePrueba(1), compras: comprasDePrueba(1), rol: 'operador' })
    renderTerceros()

    fireEvent.click(screen.getByRole('button', { name: /hospital san rafael/i }))
    expect(screen.getByText('Solo tus ventas a este cliente.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /proveedores/i }))
    fireEvent.click(screen.getByRole('button', { name: /distribuidora médica/i }))
    expect(screen.getByText('Solo tus compras a este proveedor.')).toBeInTheDocument()
  })

  it('para el admin el historial no lleva la aclaración', () => {
    mockearHooks({ ventas: ventasDePrueba(1) })
    renderTerceros()

    fireEvent.click(screen.getByRole('button', { name: /hospital san rafael/i }))
    expect(screen.queryByText('Solo tus ventas a este cliente.')).not.toBeInTheDocument()
  })
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
})
