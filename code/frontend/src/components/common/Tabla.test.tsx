import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Tabla, type ColumnaTabla } from './Tabla'

interface Fila {
  id: number
  nombre: string
  monto: string
}

const COLUMNAS: ColumnaTabla<Fila>[] = [
  { clave: 'nombre', encabezado: 'Nombre' },
  { clave: 'monto', encabezado: 'Monto', alineacion: 'derecha' },
]

const DATOS: Fila[] = [
  { id: 1, nombre: 'Uno', monto: '10.00' },
  { id: 2, nombre: 'Dos', monto: '20.00' },
]

describe('Tabla', () => {
  it('sin filaPie no renderiza pie de tabla', () => {
    const { container } = render(<Tabla columnas={COLUMNAS} datos={DATOS} />)

    expect(container.querySelector('tfoot')).toBeNull()
  })

  it('con filaPie renderiza una celda por columna, con la alineación de su columna', () => {
    const { container } = render(<Tabla columnas={COLUMNAS} datos={DATOS} filaPie={['Sumas', '30.00']} />)

    const pie = container.querySelector('tfoot') as HTMLElement
    expect(within(pie).getByText('Sumas')).toBeInTheDocument()
    expect(within(pie).getByText('30.00')).toHaveClass('numeric')
  })

  it('agrega una celda vacía al pie cuando hay columna de acciones', () => {
    const { container } = render(
      <Tabla columnas={COLUMNAS} datos={DATOS} filaPie={['Sumas', '30.00']} renderAcciones={() => <button>Ver</button>} />,
    )

    expect(container.querySelectorAll('tfoot td')).toHaveLength(3)
  })

  it('renderExpandido agrega una fila de detalle justo debajo de su fila, a todo el ancho', () => {
    const { container } = render(
      <Tabla
        columnas={COLUMNAS}
        datos={DATOS}
        renderAcciones={() => <button>Ver</button>}
        renderExpandido={(fila) => (fila.id === 1 ? <p>Detalle de Uno</p> : null)}
      />,
    )

    const filas = [...container.querySelectorAll('tbody tr')]
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveTextContent('Uno')
    expect(filas[1]).toHaveTextContent('Detalle de Uno')
    expect(filas[1]?.querySelector('td')).toHaveAttribute('colspan', '3')
    expect(filas[2]).toHaveTextContent('Dos')
  })

  it('sin renderExpandido no agrega filas extra', () => {
    const { container } = render(<Tabla columnas={COLUMNAS} datos={DATOS} />)

    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(container.querySelector('.expandedRow')).toBeNull()
  })

  it('sin datos no muestra el pie, solo el mensaje vacío', () => {
    const { container } = render(
      <Tabla columnas={COLUMNAS} datos={[]} filaPie={['Sumas', '0.00']} mensajeVacio="Nada" />,
    )

    expect(container.querySelector('tfoot')).toBeNull()
    expect(screen.getByText('Nada')).toBeInTheDocument()
  })
})
