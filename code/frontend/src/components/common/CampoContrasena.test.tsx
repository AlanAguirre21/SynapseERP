import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CampoContrasena } from './CampoContrasena'

function ContenedorControlado() {
  const [valor, setValor] = useState('')
  return <CampoContrasena etiqueta="Contraseña" valor={valor} onCambiar={setValor} />
}

describe('CampoContrasena', () => {
  it('oculta la contraseña por default y la muestra al hacer click en el ojo', () => {
    render(<ContenedorControlado />)

    const input = screen.getByLabelText('Contraseña') as HTMLInputElement
    expect(input.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }))
    expect(input.type).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(input.type).toBe('password')
  })

  it('llama a onCambiar con el nuevo valor al escribir', () => {
    render(<ContenedorControlado />)

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-123' } })
    expect(screen.getByLabelText('Contraseña')).toHaveValue('clave-123')
  })

  it('no muestra el botón "Generar" cuando no se pasa botonGenerar', () => {
    render(<ContenedorControlado />)
    expect(screen.queryByRole('button', { name: /generar/i })).not.toBeInTheDocument()
  })

  it('llama a botonGenerar.onClick al hacer click en "Generar"', () => {
    const alGenerar = vi.fn()
    render(<CampoContrasena etiqueta="Contraseña" valor="" onCambiar={() => {}} botonGenerar={{ onClick: alGenerar }} />)

    fireEvent.click(screen.getByRole('button', { name: /generar/i }))
    expect(alGenerar).toHaveBeenCalledTimes(1)
  })
})
