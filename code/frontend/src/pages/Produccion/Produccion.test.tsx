import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useStock } from '../../hooks/useInventario'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import {
  useCrearProduccion,
  useProduccion,
  useProducciones,
} from '../../hooks/useProducciones'
import { useProductos } from '../../hooks/useProductos'
import {
  useCrearReceta,
  useDesactivarReceta,
  useEditarReceta,
  useReactivarReceta,
  useRecetas,
} from '../../hooks/useRecetas'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Produccion } from './Produccion'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useProducciones')
vi.mock('../../hooks/useRecetas')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useMateriaPrima')
vi.mock('../../hooks/useInventario')

function mockUsuarioActual(rol: 'admin' | 'operador') {
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol } } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

const SUCURSALES = [{ id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: '', telefono_sucursal: '', activo: true }]
const PRODUCTOS = [
  { id: 1, nombre_producto: 'Suero fisiológico', sku: 'SKU-1', descripcion_producto: '', categoria: 1, unidad_medida: 'pza', precio_venta: '45.00', costo_produccion: '0', activo: true },
]
const MATERIA_PRIMA = [
  { id: 1, nombre_item: 'Cloruro de sodio', categoria: 1, unidad_medida: 'kg', costo_promedio: '10.00', activo: true },
]
const RECETAS = [
  { id: 1, producto: 1, producto_nombre: 'Suero fisiológico', materia_prima: 1, materia_prima_nombre: 'Cloruro de sodio', cantidad_requerida: '0.50', activo: true },
]
const PRODUCCIONES = [
  { id: 1, producto: 1, producto_nombre: 'Suero fisiológico', sucursal: 1, sucursal_nombre: 'Matriz', usuario: 1, usuario_nombre: 'admin1', fecha: '2026-08-25T10:00:00Z', cantidad_producida: '10.00', costo_total: '50.00', detalles: [] },
]

function mockearHooks() {
  vi.mocked(useProducciones).mockReturnValue({ data: PRODUCCIONES, isLoading: false } as unknown as ReturnType<typeof useProducciones>)
  vi.mocked(useProduccion).mockReturnValue({ data: undefined, isLoading: false } as unknown as ReturnType<typeof useProduccion>)
  vi.mocked(useCrearProduccion).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearProduccion>)
  vi.mocked(useRecetas).mockReturnValue({ data: RECETAS, isLoading: false } as unknown as ReturnType<typeof useRecetas>)
  vi.mocked(useCrearReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCrearReceta>)
  vi.mocked(useEditarReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useEditarReceta>)
  vi.mocked(useDesactivarReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDesactivarReceta>)
  vi.mocked(useReactivarReceta).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReactivarReceta>)
  vi.mocked(useProductos).mockReturnValue({ data: PRODUCTOS, isLoading: false } as unknown as ReturnType<typeof useProductos>)
  vi.mocked(useSucursales).mockReturnValue({ data: SUCURSALES, isLoading: false } as unknown as ReturnType<typeof useSucursales>)
  vi.mocked(useMateriaPrima).mockReturnValue({ data: MATERIA_PRIMA, isLoading: false } as unknown as ReturnType<typeof useMateriaPrima>)
}

function mockearStock(stockActual: string) {
  vi.mocked(useStock).mockReturnValue(
    { data: [{ id: 1, nombre: 'Cloruro de sodio', stock_actual: stockActual, stock_minimo: '5.00', stock_bajo: false }], isLoading: false } as unknown as ReturnType<typeof useStock>,
  )
}

// Recetas de varios productos para la pestaña "Gestión de recetas": Suero
// con dos líneas activas, Gel con una sola línea inactiva, Crema sin receta.
const PRODUCTOS_RECETAS = [
  ...PRODUCTOS,
  { id: 2, nombre_producto: 'Gel antiséptico', sku: 'SKU-2', descripcion_producto: '', categoria: 1, unidad_medida: 'pza', precio_venta: '30.00', costo_produccion: '0', activo: true },
  { id: 3, nombre_producto: 'Crema hidratante', sku: 'SKU-3', descripcion_producto: '', categoria: 1, unidad_medida: 'pza', precio_venta: '60.00', costo_produccion: '0', activo: true },
  { id: 4, nombre_producto: 'Descontinuado', sku: 'SKU-4', descripcion_producto: '', categoria: 1, unidad_medida: 'pza', precio_venta: '10.00', costo_produccion: '0', activo: false },
]
const MATERIA_PRIMA_RECETAS = [
  ...MATERIA_PRIMA,
  { id: 2, nombre_item: 'Agua destilada', categoria: 1, unidad_medida: 'l', costo_promedio: '2.00', activo: true },
  { id: 3, nombre_item: 'Glicerina', categoria: 1, unidad_medida: 'l', costo_promedio: '15.00', activo: true },
]
const RECETAS_AGRUPADAS = [
  ...RECETAS,
  { id: 2, producto: 1, producto_nombre: 'Suero fisiológico', materia_prima: 2, materia_prima_nombre: 'Agua destilada', cantidad_requerida: '1.00', activo: true },
  { id: 3, producto: 2, producto_nombre: 'Gel antiséptico', materia_prima: 3, materia_prima_nombre: 'Glicerina', cantidad_requerida: '0.20', activo: false },
]

function mockearRecetasAgrupadas(rol: 'admin' | 'operador') {
  mockearHooks()
  mockearStock('100.00')
  mockUsuarioActual(rol)
  vi.mocked(useRecetas).mockReturnValue({ data: RECETAS_AGRUPADAS, isLoading: false } as unknown as ReturnType<typeof useRecetas>)
  vi.mocked(useProductos).mockReturnValue({ data: PRODUCTOS_RECETAS, isLoading: false } as unknown as ReturnType<typeof useProductos>)
  vi.mocked(useMateriaPrima).mockReturnValue({ data: MATERIA_PRIMA_RECETAS, isLoading: false } as unknown as ReturnType<typeof useMateriaPrima>)
}

const DETALLES_PRODUCCION = [
  { id: 1, materia_prima: 1, materia_prima_nombre: 'Cloruro de sodio', cantidad_consumida: '5.00', costo_unitario_momento: '10.00', subtotal: '50.00' },
]

// Recuadro completo de un indicador (etiqueta + cifra) a partir de su etiqueta.
function indicador(etiqueta: string): HTMLElement {
  const recuadro = screen.getByText(etiqueta, { selector: '.statLabel' }).parentElement
  if (!recuadro) throw new Error(`Indicador "${etiqueta}" sin contenedor`)
  return recuadro
}

// Opciones elegibles de un <select>, sin el marcador deshabilitado "Selecciona…".
function textosDeOpciones(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .filter((opcion) => !(opcion as HTMLOptionElement).disabled)
    .map((opcion) => opcion.textContent ?? '')
}

describe('Produccion', () => {
  it('muestra la pestaña de Producciones registradas por defecto', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)

    const tabla = within(screen.getByRole('table'))
    expect(tabla.getByText('Suero fisiológico')).toBeInTheDocument()
    // Producciones enteras: la cantidad se muestra sin decimales.
    expect(tabla.getByText('10')).toBeInTheDocument()
  })

  it('no consulta el detalle de una producción mientras su modal está cerrada', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')
    vi.mocked(useProduccion).mockClear()

    render(<Produccion />)

    expect(useProduccion).toHaveBeenCalledWith(null)
    expect(useProduccion).not.toHaveBeenCalledWith(0)
  })

  it('muestra los indicadores de las producciones listadas', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)

    expect(indicador('Producciones')).toHaveTextContent('1')
    expect(indicador('Unidades producidas')).toHaveTextContent('10')
    expect(indicador('Costo de producción')).toHaveTextContent('$50.00')
    // 50.00 / 10 unidades
    expect(indicador('Costo promedio por unidad')).toHaveTextContent('$5.00')
  })

  it('"Limpiar filtros" solo aparece con algún filtro aplicado y los restablece', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()

    const sucursal = screen.getByLabelText('Sucursal')
    fireEvent.change(sucursal, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(sucursal).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('la acción del encabezado cambia según la pestaña activa', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('admin')

    render(<Produccion />)
    expect(screen.getByRole('button', { name: 'Nueva producción' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar receta de producto' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))
    expect(screen.queryByRole('button', { name: 'Nueva producción' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar receta de producto' })).toBeInTheDocument()
  })

  it('la previa indica faltante y estado de cada materia prima, no solo con color', () => {
    mockearHooks()
    mockearStock('1.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva producción/i })
    expect(within(dialogo).getByText(/elige producto y sucursal/i)).toBeInTheDocument()

    fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Sucursal'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Cantidad a producir'), { target: { value: '10' } })

    // 0.50 × 10 = 5.00 requerido, 1.00 disponible: faltan 4.00.
    const fila = within(dialogo).getByRole('row', { name: /Cloruro de sodio/ })
    expect(fila).toHaveTextContent('4.00')
    expect(within(fila).getByText('Insuficiente')).toBeInTheDocument()

    fireEvent.change(within(dialogo).getByLabelText('Cantidad a producir'), { target: { value: '2' } })
    expect(within(fila).getByText('Suficiente')).toBeInTheDocument()
    expect(within(fila).getByText('—')).toBeInTheDocument()
  })

  it('el detalle de una producción se muestra como documento con resumen de costos', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')
    vi.mocked(useProduccion).mockImplementation(
      (id) =>
        ({
          data: id === 1 ? { ...PRODUCCIONES[0], detalles: DETALLES_PRODUCCION } : undefined,
          isLoading: false,
        }) as unknown as ReturnType<typeof useProduccion>,
    )

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))

    const dialogo = screen.getByRole('dialog', { name: 'Producción #1' })
    expect(within(dialogo).getByText('Detalle de producción')).toBeInTheDocument()
    expect(within(dialogo).getByText('Cloruro de sodio')).toBeInTheDocument()
    expect(within(dialogo).getByText('$10.00')).toBeInTheDocument()
    // Costo por unidad: 50.00 / 10 unidades.
    expect(within(dialogo).getByText('$5.00')).toBeInTheDocument()
    expect(within(dialogo).getByTestId('costo-total-produccion')).toHaveTextContent('$50.00')
  })

  it('cambia a Gestión de recetas sin recargar la página', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('admin')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))

    expect(screen.getByRole('button', { name: /^Suero fisiológico/ })).toBeInTheDocument()
  })

  it('muestra una sola fila por producto, con su número de materias primas y estado', () => {
    mockearRecetasAgrupadas('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))

    const suero = screen.getAllByRole('button', { name: /^Suero fisiológico/ })
    expect(suero).toHaveLength(1)
    expect(suero[0]).toHaveTextContent('2 materias primas')
    expect(suero[0]).toHaveTextContent('Activa')

    // Todas sus líneas inactivas: la receta se muestra como inactiva.
    const gel = screen.getByRole('button', { name: /^Gel antiséptico/ })
    expect(gel).toHaveTextContent('1 materia prima')
    expect(gel).toHaveTextContent('Inactiva')
  })

  it('despliega y contrae las materias primas de un producto al hacer clic en su fila', () => {
    mockearRecetasAgrupadas('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))

    const fila = screen.getByRole('button', { name: /^Suero fisiológico/ })
    expect(fila).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Cloruro de sodio')).not.toBeInTheDocument()

    fireEvent.click(fila)
    expect(fila).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Cloruro de sodio')).toBeInTheDocument()
    expect(screen.getByText('Agua destilada')).toBeInTheDocument()
    expect(screen.getByText('1.00')).toBeInTheDocument()

    fireEvent.click(fila)
    expect(screen.queryByText('Cloruro de sodio')).not.toBeInTheDocument()
  })

  it('operador ve las recetas en solo lectura, sin botones de escritura', () => {
    mockearRecetasAgrupadas('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))
    fireEvent.click(screen.getByRole('button', { name: /^Suero fisiológico/ }))

    expect(screen.getByText('Cloruro de sodio')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /agregar receta de producto/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /agregar materia prima a/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
  })

  it('admin ve botones de escritura en recetas', () => {
    mockearRecetasAgrupadas('admin')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))
    fireEvent.click(screen.getByRole('button', { name: /^Suero fisiológico/ }))

    expect(screen.getByRole('button', { name: 'Agregar receta de producto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar materia prima a Suero fisiológico' })).toBeInTheDocument()
    expect(screen.getAllByText('Editar')).toHaveLength(2)
  })

  it('"Agregar receta de producto" solo ofrece productos activos sin receta', () => {
    mockearRecetasAgrupadas('admin')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar receta de producto' }))

    const dialogo = screen.getByRole('dialog', { name: 'Agregar receta de producto' })
    // "Gel antiséptico" queda fuera aunque su receta esté inactiva; "Descontinuado" está inactivo.
    expect(textosDeOpciones(within(dialogo).getByLabelText('Producto'))).toEqual(['Crema hidratante'])
  })

  it('el botón "+" abre el modal con el producto fijado y sin las materias primas ya usadas', async () => {
    mockearRecetasAgrupadas('admin')
    const crear = vi.fn().mockResolvedValue({})
    vi.mocked(useCrearReceta).mockReturnValue({ mutateAsync: crear, isPending: false } as unknown as ReturnType<typeof useCrearReceta>)

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar materia prima a Suero fisiológico' }))

    // Agregar no despliega la fila.
    expect(screen.getByRole('button', { name: /^Suero fisiológico/ })).toHaveAttribute('aria-expanded', 'false')

    const dialogo = screen.getByRole('dialog', { name: 'Agregar materia prima a la receta' })
    const producto = within(dialogo).getByLabelText('Producto')
    expect(producto).toHaveValue('Suero fisiológico')
    expect(producto).toHaveAttribute('readonly')

    const materiaPrima = within(dialogo).getByLabelText('Materia prima')
    expect(textosDeOpciones(materiaPrima)).toEqual(['Glicerina'])

    fireEvent.change(materiaPrima, { target: { value: '3' } })
    fireEvent.change(within(dialogo).getByLabelText('Cantidad requerida (por unidad producida)'), { target: { value: '0.30' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    expect(crear).toHaveBeenCalledWith({ producto: 1, materia_prima: 3, cantidad_requerida: '0.30' })
    // Tras guardar, el producto queda desplegado para ver la línea nueva.
    expect(await screen.findByText('Cloruro de sodio')).toBeInTheDocument()
  })

  it('editar una línea fija el producto y conserva su propia materia prima en el selector', () => {
    mockearRecetasAgrupadas('admin')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gestión de recetas' }))
    fireEvent.click(screen.getByRole('button', { name: /^Suero fisiológico/ }))
    fireEvent.click(within(screen.getByRole('row', { name: /Cloruro de sodio/ })).getByText('Editar'))

    const dialogo = screen.getByRole('dialog', { name: 'Editar línea de receta' })
    expect(within(dialogo).getByLabelText('Producto')).toHaveValue('Suero fisiológico')
    const materiaPrima = within(dialogo).getByLabelText('Materia prima')
    expect(materiaPrima).toHaveValue('1')
    // "Agua destilada" ya es otra línea de la misma receta.
    expect(textosDeOpciones(materiaPrima)).toEqual(['Cloruro de sodio', 'Glicerina'])
  })

  it('muestra en vivo la materia prima requerida y el stock disponible al elegir producto/sucursal', () => {
    mockearHooks()
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva producción/i })
    fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Sucursal'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Cantidad a producir'), { target: { value: '10' } })

    // 0.50 requerido por unidad * 10 = 5.00
    expect(within(dialogo).getByText('5.00')).toBeInTheDocument()
    expect(within(dialogo).getByText('100.00')).toBeInTheDocument()
  })

  it('bloquea confirmar si no hay stock suficiente de materia prima', () => {
    mockearHooks()
    mockearStock('1.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva producción/i })
    fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Sucursal'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Cantidad a producir'), { target: { value: '10' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /confirmar producción/i }))

    expect(within(dialogo).getByRole('alert')).toHaveTextContent(/no hay stock suficiente/i)
  })

  it('avisa si el producto no tiene receta activa configurada', () => {
    mockearHooks()
    vi.mocked(useRecetas).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useRecetas>)
    mockearStock('100.00')
    mockUsuarioActual('operador')

    render(<Produccion />)
    fireEvent.click(screen.getByRole('button', { name: /nueva producción/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva producción/i })
    fireEvent.change(within(dialogo).getByLabelText('Producto'), { target: { value: '1' } })
    fireEvent.change(within(dialogo).getByLabelText('Sucursal'), { target: { value: '1' } })

    expect(within(dialogo).getByText(/no tiene una receta activa configurada/i)).toBeInTheDocument()
  })
})
