import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GeneracionPronostico, Pronostico, VistaPronostico } from '../../api/analitica'
import {
  useDemandaPronosticada,
  useGenerarPronosticos,
  useGeneracionesPronostico,
  usePronosticosDeGeneracion,
  useVistaPronostico,
} from '../../hooks/useAnalitica'
import { PestanaPronosticos } from './PestanaPronosticos'

vi.mock('../../hooks/useAnalitica')
// recharts necesita medidas reales que jsdom no da: la gráfica se sustituye
// por su título y, si no hay datos, su mensaje.
vi.mock('../Dashboard/compartido/GraficaPronostico', () => ({
  GraficaPronostico: ({ titulo, datos, mensajeVacio }: { titulo: string; datos: unknown[]; mensajeVacio?: string }) => (
    <div>
      <h3>{titulo}</h3>
      {datos.length === 0 && <p>{mensajeVacio}</p>}
    </div>
  ),
}))

const GENERACION: GeneracionPronostico = {
  id: 5, origen: 'programada', iniciada_por: null, iniciada_por_nombre: '', fecha_inicio: '2026-10-26T06:30:00Z',
  fecha_fin: '2026-10-26T06:30:05Z', estado: 'exitosa', horizonte: 'semanas_4', granularidad: 'semana',
  periodo_desde: '2026-11-02', periodo_hasta: '2026-11-23', historial_desde: '2026-01-05', historial_hasta: '2026-10-25',
  mensaje_error: '',
}

function pronostico(cambios: Partial<Pronostico>): Pronostico {
  return {
    id: 1, generacion: 5, metrica: 'monto_ventas', producto: null, producto_nombre: '', categoria: null,
    categoria_nombre: '', estado: 'generado', periodos_historial: 42, periodos_minimos: 8, metodo: 'tendencia',
    wape: '0.1200', precision: 'alta', total_pronosticado: '4400.00', total_inferior: '4000.00',
    total_superior: '4800.00',
    puntos: [
      { periodo_inicio: '2026-11-02', periodo_fin: '2026-11-08', valor: '1100.00', limite_inferior: '1000.00', limite_superior: '1200.00' },
    ],
    ...cambios,
  }
}

function vista(p: Pronostico | null, historial = [{ periodo_inicio: '2026-10-19', valor: '1000.00' }]): VistaPronostico {
  return { generacion: GENERACION, pronostico: p, historial, precision_real: null }
}

function consulta<T>(data: T) {
  return { data, isLoading: false } as unknown
}

function mockearHooks(vistas: Partial<Record<string, VistaPronostico>> = {}, mutateAsync = vi.fn().mockResolvedValue([])) {
  vi.mocked(useGeneracionesPronostico).mockReturnValue(
    consulta([GENERACION]) as ReturnType<typeof useGeneracionesPronostico>,
  )
  vi.mocked(useVistaPronostico).mockImplementation(
    ({ metrica }) => consulta(vistas[metrica] ?? vista(pronostico({ metrica }))) as ReturnType<typeof useVistaPronostico>,
  )
  vi.mocked(usePronosticosDeGeneracion).mockReturnValue(
    consulta([pronostico({ metrica: 'monto_categoria', categoria: 2, categoria_nombre: 'Curación' })]) as ReturnType<
      typeof usePronosticosDeGeneracion
    >,
  )
  vi.mocked(useDemandaPronosticada).mockReturnValue(
    consulta({
      generacion: GENERACION,
      productos: [
        {
          producto: 9, producto_nombre: 'Suero', unidades: '40.00', limite_inferior: '30.00', limite_superior: '50.00',
          wape: '0.2000', precision: 'alta', stock_total: '12.00', insuficiente: true,
        },
      ],
    }) as ReturnType<typeof useDemandaPronosticada>,
  )
  vi.mocked(useGenerarPronosticos).mockReturnValue(
    { mutateAsync, isPending: false } as unknown as ReturnType<typeof useGenerarPronosticos>,
  )
}

function renderPestana() {
  return render(
    <MemoryRouter>
      <PestanaPronosticos />
    </MemoryRouter>,
  )
}

describe('PestanaPronosticos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra totales, precisión, categorías y demanda de la generación vigente', () => {
    mockearHooks()
    renderPestana()

    const monto = screen.getByText('Monto pronosticado', { selector: '.statLabel' }).parentElement as HTMLElement
    expect(monto).toHaveTextContent('$4,400.00')
    expect(monto).toHaveTextContent('Rango $4,000.00 – $4,800.00')
    // 4,400 frente a los 1,000 del periodo anterior equivalente: +340 %.
    expect(screen.getByText('+340.0 %')).toBeInTheDocument()
    expect(screen.getAllByText('Precisión alta · 88 %').length).toBeGreaterThan(0)
    expect(screen.getByRole('cell', { name: 'Curación' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Suero' })).toBeInTheDocument()
  })

  it('explica cuando el historial es insuficiente en lugar de graficar', () => {
    mockearHooks({
      monto_ventas: vista(pronostico({ estado: 'historial_insuficiente', periodos_historial: 3, puntos: [] })),
    })
    renderPestana()

    expect(
      screen.getByText('Historial insuficiente: hay 3 periodo(s) completo(s) y se necesitan al menos 8 para pronosticar.'),
    ).toBeInTheDocument()
  })

  it('cambiar de horizonte consulta las generaciones de ese horizonte', () => {
    mockearHooks()
    renderPestana()

    fireEvent.click(screen.getByRole('button', { name: 'Próximos 3 meses' }))

    expect(useGeneracionesPronostico).toHaveBeenCalledWith('meses_3')
  })

  it('"Generar ahora" con horizontes estándar no envía rango', () => {
    const generar = vi.fn().mockResolvedValue([])
    mockearHooks({}, generar)
    renderPestana()

    fireEvent.click(screen.getByRole('button', { name: 'Generar ahora' }))
    const modal = screen.getByRole('dialog', { name: 'Generar pronósticos' })
    fireEvent.click(within(modal).getByRole('button', { name: 'Generar' }))

    expect(generar).toHaveBeenCalledWith({})
  })

  it('un rango personalizado exige las dos fechas y envía la granularidad', () => {
    const generar = vi.fn().mockResolvedValue([])
    mockearHooks({}, generar)
    renderPestana()

    fireEvent.click(screen.getByRole('button', { name: 'Generar ahora' }))
    const modal = screen.getByRole('dialog', { name: 'Generar pronósticos' })
    fireEvent.click(within(modal).getByRole('button', { name: 'Rango personalizado' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Generar' }))
    expect(within(modal).getByRole('alert')).toHaveTextContent('Elige la fecha inicial y la final del rango.')

    fireEvent.change(within(modal).getByLabelText('Desde'), { target: { value: '2026-12-01' } })
    fireEvent.change(within(modal).getByLabelText('Hasta'), { target: { value: '2027-02-01' } })
    fireEvent.change(within(modal).getByLabelText(/Granularidad/), { target: { value: 'mes' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Generar' }))

    expect(generar).toHaveBeenCalledWith({
      horizonte: 'personalizado', desde: '2026-12-01', hasta: '2027-02-01', granularidad: 'mes',
    })
  })
})
