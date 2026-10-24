import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { periodoQuincena, type SolicitudNomina } from '../../api/rrhh'
import { useSaldoCaja } from '../../hooks/useMovimientosCaja'
import {
  useAprobarSolicitudNomina,
  useEditarMontoNomina,
  useGenerarNomina,
  usePagarSolicitudesNomina,
  useRechazarSolicitudNomina,
  useRevertirPagoNomina,
  useSolicitudesNomina,
} from '../../hooks/useSolicitudesNomina'
import { PestanaNominas } from './PestanaNominas'

vi.mock('../../hooks/useSolicitudesNomina')
vi.mock('../../hooks/useMovimientosCaja')

function solicitud(datos: Partial<SolicitudNomina>): SolicitudNomina {
  return {
    id: 1, empleado: 1, empleado_nombre: 'Ana Ruiz', empleado_foto: null, posicion_nombre: 'Vendedora',
    periodo_inicio: '2026-03-01', periodo_fin: '2026-03-15', monto: '4500.00', estado: 'pendiente',
    fecha_solicitud: '2026-03-01T10:00:00Z', fecha_resolucion: null, resuelto_por: null, resuelto_por_nombre: null,
    movimiento_pago: null, movimiento_reverso: null, motivo_reverso: '', fecha_reverso: null, revertido_por: null,
    revertido_por_nombre: null,
    ...datos,
  }
}

const SOLICITUDES = [
  solicitud({ id: 1 }),
  solicitud({ id: 2, empleado: 2, empleado_nombre: 'Beto Muñoz', posicion_nombre: null, monto: '3000.00' }),
  solicitud({
    id: 3, empleado: 3, empleado_nombre: 'Carla Paz', estado: 'pagado', monto: '2000.00',
    resuelto_por_nombre: 'admin1', fecha_resolucion: '2026-03-16T10:00:00Z', movimiento_pago: 40,
  }),
  solicitud({
    id: 4, empleado: 4, empleado_nombre: 'Dora Leal', estado: 'revertido', monto: '1000.00',
    resuelto_por_nombre: 'admin1', movimiento_pago: 41, movimiento_reverso: 42, motivo_reverso: 'Monto equivocado',
    revertido_por_nombre: 'admin1',
  }),
  solicitud({ id: 5, empleado: 5, empleado_nombre: 'Eva Sol', estado: 'aprobado', monto: '500.00' }),
]

function mutacion(mutateAsync: unknown) {
  return { mutateAsync, isPending: false }
}

type MockNomina = ReturnType<typeof vi.fn>

let mocks: {
  aprobar: MockNomina
  pagarLote: MockNomina
  rechazar: MockNomina
  revertir: MockNomina
  editar: MockNomina
  generar: MockNomina
}

function preparar({ datos = SOLICITUDES, saldo = '10000.00' }: { datos?: SolicitudNomina[]; saldo?: string } = {}) {
  mocks = {
    aprobar: vi.fn().mockResolvedValue(undefined),
    pagarLote: vi.fn().mockResolvedValue(undefined),
    rechazar: vi.fn().mockResolvedValue(undefined),
    revertir: vi.fn().mockResolvedValue(undefined),
    editar: vi.fn().mockResolvedValue(undefined),
    generar: vi.fn().mockResolvedValue({
      creadas: [solicitud({ id: 9 })],
      omitidas: [{ empleado: 7, empleado_nombre: 'Gil Mar', motivo: 'Sin posición vigente.' }],
    }),
  }
  vi.mocked(useSolicitudesNomina).mockReturnValue({ data: datos, isLoading: false } as unknown as ReturnType<typeof useSolicitudesNomina>)
  vi.mocked(useSaldoCaja).mockReturnValue(
    { data: { saldo_actual: saldo, saldo_adicional: '0.00', saldo_total: saldo } } as unknown as ReturnType<typeof useSaldoCaja>,
  )
  vi.mocked(useAprobarSolicitudNomina).mockReturnValue(mutacion(mocks.aprobar) as unknown as ReturnType<typeof useAprobarSolicitudNomina>)
  vi.mocked(usePagarSolicitudesNomina).mockReturnValue(mutacion(mocks.pagarLote) as unknown as ReturnType<typeof usePagarSolicitudesNomina>)
  vi.mocked(useRechazarSolicitudNomina).mockReturnValue(mutacion(mocks.rechazar) as unknown as ReturnType<typeof useRechazarSolicitudNomina>)
  vi.mocked(useRevertirPagoNomina).mockReturnValue(mutacion(mocks.revertir) as unknown as ReturnType<typeof useRevertirPagoNomina>)
  vi.mocked(useEditarMontoNomina).mockReturnValue(mutacion(mocks.editar) as unknown as ReturnType<typeof useEditarMontoNomina>)
  vi.mocked(useGenerarNomina).mockReturnValue(mutacion(mocks.generar) as unknown as ReturnType<typeof useGenerarNomina>)
}

function fila(nombre: string): HTMLElement {
  const celda = screen.getByText(nombre)
  const tr = celda.closest('tr')
  if (!tr) throw new Error(`Sin fila para ${nombre}`)
  return tr
}

function indicador(etiqueta: string): HTMLElement {
  const recuadro = screen.getByText(etiqueta, { selector: '.statLabel' }).parentElement
  if (!recuadro) throw new Error(`Indicador "${etiqueta}" sin contenedor`)
  return recuadro
}

describe('PestanaNominas', () => {
  beforeEach(() => preparar())

  it('lista las solicitudes con empleado, posición, periodo, monto y estado', () => {
    render(<PestanaNominas />)

    const ana = fila('Ana Ruiz')
    expect(ana).toHaveTextContent('Vendedora')
    expect(ana).toHaveTextContent('01/03/2026 – 15/03/2026')
    expect(ana).toHaveTextContent('$4,500.00')
    expect(within(ana).getByText('Pendiente')).toHaveClass('statusWarning')
    expect(within(fila('Beto Muñoz')).getByText('—')).toBeInTheDocument()
    expect(within(fila('Carla Paz')).getByText('Pagada')).toHaveClass('statusSuccess')
    expect(within(fila('Dora Leal')).getByText('Revertida')).toHaveClass('statusNeutral')
    expect(within(fila('Eva Sol')).getByText('Aprobada (sin pago en caja)')).toBeInTheDocument()
  })

  it('muestra los indicadores de pendientes, pagado y saldo de caja', () => {
    render(<PestanaNominas />)

    expect(indicador('Pendientes')).toHaveTextContent('2')
    expect(indicador('Pendientes')).toHaveTextContent('$7,500.00')
    expect(indicador('Pendientes')).toHaveClass('statTileWarning')
    expect(indicador('Pagado')).toHaveTextContent('$2,000.00')
    expect(indicador('Saldo de caja')).toHaveTextContent('$10,000.00')
  })

  it('por defecto filtra por la quincena en curso; "Todos los periodos" quita el filtro', () => {
    render(<PestanaNominas />)
    const hoy = new Date()
    const { inicio, fin } = periodoQuincena(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate() <= 15 ? 1 : 2)

    expect(useSolicitudesNomina).toHaveBeenLastCalledWith({ estado: undefined, periodo_inicio: inicio, periodo_fin: fin })
    expect(screen.queryByRole('button', { name: /limpiar filtros/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'todos' } })

    expect(useSolicitudesNomina).toHaveBeenLastCalledWith({ estado: undefined })
    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }))
    expect(useSolicitudesNomina).toHaveBeenLastCalledWith({ estado: undefined, periodo_inicio: inicio, periodo_fin: fin })
  })

  it('busca por nombre sin distinguir acentos', () => {
    render(<PestanaNominas />)

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'munoz' } })

    expect(screen.getByText('Beto Muñoz')).toBeInTheDocument()
    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 5')).toBeInTheDocument()
  })

  it('las acciones dependen del estado', () => {
    render(<PestanaNominas />)

    expect(within(fila('Ana Ruiz')).getByRole('button', { name: 'Aprobar y pagar' })).toBeInTheDocument()
    expect(within(fila('Ana Ruiz')).getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
    expect(within(fila('Carla Paz')).getByRole('button', { name: 'Revertir pago' })).toBeInTheDocument()
    expect(within(fila('Carla Paz')).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(fila('Eva Sol')).queryByRole('button', { name: 'Revertir pago' })).not.toBeInTheDocument()
  })

  it('aprobar y pagar confirma con el saldo y paga la solicitud', async () => {
    render(<PestanaNominas />)

    fireEvent.click(within(fila('Ana Ruiz')).getByRole('button', { name: 'Aprobar y pagar' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Aprobar y pagar nómina' }))
    expect(dialogo.getByText('$10,000.00')).toBeInTheDocument()
    expect(dialogo.getByText('$5,500.00')).toBeInTheDocument()
    expect(dialogo.queryByText(/supera el saldo/i)).not.toBeInTheDocument()

    fireEvent.click(dialogo.getByRole('button', { name: 'Confirmar pago' }))

    await waitFor(() => expect(mocks.aprobar).toHaveBeenCalledWith(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('avisa si el pago supera el saldo y muestra el error del backend', async () => {
    preparar({ saldo: '100.00' })
    mocks.aprobar.mockRejectedValue({ response: { data: { detail: 'Este retiro dejaría el saldo de caja en -4400.00.' } } })
    render(<PestanaNominas />)

    fireEvent.click(within(fila('Ana Ruiz')).getByRole('button', { name: 'Aprobar y pagar' }))
    const dialogo = within(screen.getByRole('dialog'))
    expect(dialogo.getByText(/supera el saldo disponible/i)).toBeInTheDocument()

    fireEvent.click(dialogo.getByRole('button', { name: 'Confirmar pago' }))

    expect(await dialogo.findByRole('alert')).toHaveTextContent('dejaría el saldo de caja')
  })

  it('selecciona pendientes y las paga en bloque', async () => {
    render(<PestanaNominas />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar nómina de Ana Ruiz' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar nómina de Beto Muñoz' }))
    const barra = screen.getByRole('region', { name: 'Selección de nóminas' })
    expect(barra).toHaveTextContent('2 seleccionadas · total $7,500.00')

    fireEvent.click(within(barra).getByRole('button', { name: 'Aprobar y pagar seleccionadas' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Aprobar y pagar nóminas' }))
    expect(dialogo.getByText(/no se pagará ninguna/i)).toBeInTheDocument()
    fireEvent.click(dialogo.getByRole('button', { name: 'Confirmar pago' }))

    await waitFor(() => expect(mocks.pagarLote).toHaveBeenCalledWith([1, 2]))
    expect(screen.queryByRole('region', { name: 'Selección de nóminas' })).not.toBeInTheDocument()
  })

  it('"seleccionar todas" marca solo las pendientes', () => {
    render(<PestanaNominas />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todas las pendientes' }))

    expect(screen.getByRole('region', { name: 'Selección de nóminas' })).toHaveTextContent('2 seleccionadas')
  })

  it('rechazar pide confirmación y rechaza', async () => {
    render(<PestanaNominas />)

    fireEvent.click(within(fila('Ana Ruiz')).getByRole('button', { name: 'Rechazar' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Rechazar nómina' }))
    fireEvent.click(dialogo.getByRole('button', { name: 'Rechazar' }))

    await waitFor(() => expect(mocks.rechazar).toHaveBeenCalledWith(1))
  })

  it('revertir exige un motivo y lo envía', async () => {
    render(<PestanaNominas />)

    fireEvent.click(within(fila('Carla Paz')).getByRole('button', { name: 'Revertir pago' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Revertir pago de nómina' }))
    fireEvent.click(dialogo.getByRole('button', { name: 'Revertir pago' }))
    expect(dialogo.getByRole('alert')).toHaveTextContent('Indica el motivo del reverso.')
    expect(mocks.revertir).not.toHaveBeenCalled()

    fireEvent.change(dialogo.getByLabelText('Motivo del reverso'), { target: { value: 'Pago duplicado' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Revertir pago' }))

    await waitFor(() => expect(mocks.revertir).toHaveBeenCalledWith({ id: 3, motivo: 'Pago duplicado' }))
  })

  it('edita el monto de una pendiente', async () => {
    render(<PestanaNominas />)

    fireEvent.click(within(fila('Ana Ruiz')).getByRole('button', { name: 'Editar monto' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Editar monto de nómina' }))
    fireEvent.change(dialogo.getByLabelText('Monto a pagar'), { target: { value: '4200.50' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(mocks.editar).toHaveBeenCalledWith({ id: 1, monto: '4200.50' }))
  })

  it('el detalle de una revertida muestra quién y por qué', () => {
    render(<PestanaNominas />)

    fireEvent.click(within(fila('Dora Leal')).getByRole('button', { name: 'Ver detalle' }))

    expect(screen.getByText('Monto equivocado')).toBeInTheDocument()
    expect(screen.getByText('#41')).toBeInTheDocument()
  })

  it('genera la nómina de la quincena elegida e informa omitidos', async () => {
    render(<PestanaNominas />)

    fireEvent.click(screen.getByRole('button', { name: 'Generar nómina' }))
    const dialogo = within(screen.getByRole('dialog', { name: 'Generar nómina' }))
    fireEvent.change(dialogo.getByLabelText('Mes'), { target: { value: '2' } })
    fireEvent.change(dialogo.getByLabelText('Año'), { target: { value: '2026' } })
    fireEvent.change(dialogo.getByLabelText('Quincena'), { target: { value: '2' } })
    expect(dialogo.getByText('Periodo: 16/02/2026 – 28/02/2026')).toBeInTheDocument()
    fireEvent.click(dialogo.getByRole('button', { name: 'Generar' }))

    await waitFor(() => expect(mocks.generar).toHaveBeenCalledWith({ anio: 2026, mes: 2, quincena: 2 }))
    expect(await dialogo.findByText('Se creó 1 solicitud pendiente.')).toBeInTheDocument()
    expect(dialogo.getByText('Gil Mar')).toBeInTheDocument()
    expect(dialogo.getByText(/Sin posición vigente/)).toBeInTheDocument()
    // La lista pasa al periodo generado.
    expect(useSolicitudesNomina).toHaveBeenLastCalledWith({
      estado: undefined, periodo_inicio: '2026-02-16', periodo_fin: '2026-02-28',
    })
  })
})
