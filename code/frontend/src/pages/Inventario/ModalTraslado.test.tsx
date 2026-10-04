import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCrearTraslado, useStock } from '../../hooks/useInventario'
import { useSucursales } from '../../hooks/useSucursales'
import { ModalTraslado } from './ModalTraslado'

vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useInventario')

const useStockMock = vi.mocked(useStock)
const mutateAsync = vi.fn()

const SUCURSALES = [
  { id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: '', telefono_sucursal: '', activo: true },
  { id: 2, nombre_sucursal: 'Norte', ubicacion_sucursal: '', telefono_sucursal: '', activo: true },
  { id: 3, nombre_sucursal: 'Cerrada', ubicacion_sucursal: '', telefono_sucursal: '', activo: false },
]

const STOCK: Record<number, Record<string, { id: number; nombre: string; stock_actual: string }[]>> = {
  1: {
    producto: [
      { id: 1, nombre: 'Suero fisiológico', stock_actual: '20.00' },
      { id: 2, nombre: 'Gasa estéril', stock_actual: '5.00' },
    ],
    materia_prima: [{ id: 1, nombre: 'Cloruro de sodio', stock_actual: '7.50' }],
  },
  2: {
    producto: [
      { id: 1, nombre: 'Suero fisiológico', stock_actual: '3.00' },
      { id: 2, nombre: 'Gasa estéril', stock_actual: '0.00' },
    ],
    materia_prima: [{ id: 1, nombre: 'Cloruro de sodio', stock_actual: '1.00' }],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useSucursales).mockReturnValue(
    { data: SUCURSALES, isLoading: false } as unknown as ReturnType<typeof useSucursales>,
  )
  useStockMock.mockImplementation(
    (tipo, sucursalId) =>
      ({
        data: sucursalId === null ? undefined : STOCK[sucursalId]?.[tipo],
        isLoading: false,
      }) as unknown as ReturnType<typeof useStock>,
  )
  mutateAsync.mockResolvedValue({ id: 12 })
  vi.mocked(useCrearTraslado).mockReturnValue(
    { mutateAsync, isPending: false } as unknown as ReturnType<typeof useCrearTraslado>,
  )
})

function renderizar(onCerrar = vi.fn(), tipoInicial: 'producto' | 'materia_prima' = 'producto') {
  render(<ModalTraslado onCerrar={onCerrar} sucursalInicial={1} tipoInicial={tipoInicial} />)
  return onCerrar
}

function opcionesDe(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((o) => o.textContent ?? '')
}

function llenarLinea(numero: number, tipo: string, itemId: string, cantidad: string) {
  fireEvent.change(screen.getByLabelText(`Tipo de la línea ${numero}`), { target: { value: tipo } })
  fireEvent.change(screen.getByLabelText(`Ítem de la línea ${numero}`), { target: { value: itemId } })
  fireEvent.change(screen.getByLabelText(`Cantidad de la línea ${numero}`), { target: { value: cantidad } })
}

describe('ModalTraslado', () => {
  it('abre con origen precargado y una línea con el tipo precargado', () => {
    renderizar(vi.fn(), 'materia_prima')

    expect(screen.getByLabelText('Sucursal origen')).toHaveValue('1')
    expect(screen.getByLabelText('Tipo de la línea 1')).toHaveValue('materia_prima')
    expect(screen.queryByLabelText('Tipo de la línea 2')).not.toBeInTheDocument()
  })

  it('el selector de destino excluye la sucursal origen y las inactivas', () => {
    renderizar()

    const destino = screen.getByLabelText('Sucursal destino')
    expect(opcionesDe(destino)).toEqual(['Selecciona…', 'Norte'])
  })

  it('agrega y quita líneas, quitando la línea correcta', () => {
    renderizar()

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }))
    fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Cantidad de la línea 2'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Cantidad de la línea 3'), { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: 'Quitar línea 2' }))

    expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(1)
    expect(screen.getByLabelText('Cantidad de la línea 2')).toHaveValue(3)
    expect(screen.queryByLabelText('Cantidad de la línea 3')).not.toBeInTheDocument()
  })

  it('no permite confirmar sin al menos una línea completa', () => {
    renderizar()
    fireEvent.change(screen.getByLabelText('Sucursal destino'), { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: selecciona un ítem.')

    fireEvent.click(screen.getByRole('button', { name: 'Quitar línea 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Agrega al menos un ítem al traslado.')
    expect(screen.queryByRole('button', { name: 'Confirmar traslado' })).not.toBeInTheDocument()
  })

  it('permite mezclar producto y materia prima; cambiar el tipo limpia el ítem', () => {
    renderizar()

    fireEvent.change(screen.getByLabelText('Ítem de la línea 1'), { target: { value: '1' } })
    expect(screen.getByLabelText('Ítem de la línea 1')).toHaveValue('1')

    fireEvent.change(screen.getByLabelText('Tipo de la línea 1'), { target: { value: 'materia_prima' } })
    expect(screen.getByLabelText('Ítem de la línea 1')).toHaveValue('')
    expect(opcionesDe(screen.getByLabelText('Ítem de la línea 1'))).toContain('Cloruro de sodio')

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }))
    expect(opcionesDe(screen.getByLabelText('Ítem de la línea 2'))).toContain('Suero fisiológico')
  })

  it('el selector de ítem no ofrece ítems ya elegidos en otras líneas del mismo tipo', () => {
    renderizar()

    fireEvent.change(screen.getByLabelText('Ítem de la línea 1'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }))

    const opcionesLinea2 = opcionesDe(screen.getByLabelText('Ítem de la línea 2'))
    expect(opcionesLinea2).not.toContain('Suero fisiológico')
    expect(opcionesLinea2).toContain('Gasa estéril')

    // Mismo id (1) pero otro tipo: sí se ofrece.
    fireEvent.change(screen.getByLabelText('Tipo de la línea 2'), { target: { value: 'materia_prima' } })
    expect(opcionesDe(screen.getByLabelText('Ítem de la línea 2'))).toContain('Cloruro de sodio')
  })

  it('muestra el stock disponible en origen y lo actualiza al cambiar el origen', () => {
    renderizar()

    fireEvent.change(screen.getByLabelText('Ítem de la línea 1'), { target: { value: '1' } })
    expect(screen.getByTestId('disponible-linea-1')).toHaveTextContent('20.00')

    fireEvent.change(screen.getByLabelText('Sucursal origen'), { target: { value: '2' } })
    expect(screen.getByTestId('disponible-linea-1')).toHaveTextContent('3.00')
  })

  it('avisa cuando una cantidad supera el disponible', () => {
    renderizar()
    llenarLinea(1, 'producto', '2', '6')
    expect(screen.getByText('Supera el disponible')).toBeInTheDocument()
  })

  it('"Confirmar" muestra el resumen sin enviar; "Volver" conserva los datos; "Cancelar" cierra sin enviar', () => {
    const onCerrar = renderizar()
    fireEvent.change(screen.getByLabelText('Sucursal destino'), { target: { value: '2' } })
    llenarLinea(1, 'producto', '1', '5')
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }))
    llenarLinea(2, 'materia_prima', '1', '2.5')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText(/¿Confirmar el traslado de/)).toHaveTextContent('Matriz a Norte')
    const resumen = screen.getByRole('table')
    expect(within(resumen).getByText('Suero fisiológico')).toBeInTheDocument()
    expect(within(resumen).getByText('Cloruro de sodio')).toBeInTheDocument()
    expect(within(resumen).getByText('2.5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(5)
    expect(screen.getByLabelText('Ítem de la línea 2')).toHaveValue('1')
    expect(screen.getByLabelText('Tipo de la línea 2')).toHaveValue('materia_prima')

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCerrar).toHaveBeenCalled()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('"Confirmar traslado" envía todas las líneas con cantidades decimales y cierra al éxito', async () => {
    const onCerrar = renderizar()
    fireEvent.change(screen.getByLabelText('Sucursal destino'), { target: { value: '2' } })
    llenarLinea(1, 'producto', '1', '5')
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }))
    llenarLinea(2, 'materia_prima', '1', '2.55')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }))

    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith({
      sucursal_origen: 1,
      sucursal_destino: 2,
      detalles: [
        { tipo_item: 'producto', item_id: 1, cantidad: '5' },
        { tipo_item: 'materia_prima', item_id: 1, cantidad: '2.55' },
      ],
    })
  })

  it('muestra el error de stock insuficiente dentro del modal sin cerrarlo ni perder las líneas', async () => {
    mutateAsync.mockRejectedValueOnce({
      response: { data: { detail: 'Stock insuficiente en Matriz de: "Gasa estéril" (disponible: 5.00, solicitado: 9).' } },
    })
    const onCerrar = renderizar()
    fireEvent.change(screen.getByLabelText('Sucursal destino'), { target: { value: '2' } })
    llenarLinea(1, 'producto', '2', '9')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Stock insuficiente en Matriz')
    expect(onCerrar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(9)
  })

  it('muestra errores por línea del backend con su número de línea', async () => {
    mutateAsync.mockRejectedValueOnce({
      response: { data: { detalles: [{}, { item_id: ['Producto no encontrado o inactivo.'] }] } },
    })
    renderizar()
    fireEvent.change(screen.getByLabelText('Sucursal destino'), { target: { value: '2' } })
    llenarLinea(1, 'producto', '1', '1')
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ítem' }))
    llenarLinea(2, 'producto', '2', '1')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar traslado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Línea 2: Producto no encontrado o inactivo.')
  })
})
