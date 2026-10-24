import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ClienteTop } from '../../../../api/reportes'
import { useClientesTop } from '../../../../hooks/useClientesTop'
import { SeccionClientes } from './SeccionClientes'

vi.mock('../../../../hooks/useClientesTop')

// Recharts no dibuja en jsdom: la gráfica se sustituye por un resumen de sus props.
vi.mock('../../compartido/GraficaBarras', () => ({
  GraficaBarras: ({
    datos, etiquetaEjeY, formatoValor,
  }: { datos: { etiqueta: string; valor: number }[]; etiquetaEjeY: string; formatoValor: (v: number) => string }) => (
    <ul aria-label={etiquetaEjeY}>
      {datos.map((d) => (
        <li key={d.etiqueta}>{`${d.etiqueta}: ${formatoValor(d.valor)}`}</li>
      ))}
    </ul>
  ),
}))

function mockearClientes(data: ClienteTop[]) {
  vi.mocked(useClientesTop).mockReturnValue({ data, isLoading: false } as unknown as ReturnType<typeof useClientesTop>)
}

describe('SeccionClientes', () => {
  it('para el admin grafica el monto comprado', () => {
    mockearClientes([{ cliente: 'María Pérez', monto: '900.00' }])

    render(<SeccionClientes periodo="mes" />)

    expect(screen.getByRole('list', { name: 'Monto ($)' })).toHaveTextContent('María Pérez: $900.00')
  })

  // 016, "Actualización: ganancias y movimientos de caja solo para admin".
  it('para el operador grafica el número de compras, sin importes', () => {
    mockearClientes([
      { cliente: 'Luis Gómez', compras: 2 },
      { cliente: 'María Pérez', compras: 1 },
    ])

    render(<SeccionClientes periodo="dia" />)

    const grafica = screen.getByRole('list', { name: 'Compras' })
    expect(grafica).toHaveTextContent('Luis Gómez: 2 compras')
    expect(grafica).toHaveTextContent('María Pérez: 1 compra')
    expect(grafica).not.toHaveTextContent('$')
  })
})
