import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('sin fotografía muestra las iniciales', () => {
    const { container } = render(<Avatar nombre="Juan Pérez" />)

    expect(container.textContent).toBe('JP')
    expect(container.querySelector('img')).toBeNull()
  })

  it('con fotografía muestra la imagen en lugar de las iniciales', () => {
    const { container } = render(<Avatar nombre="Juan Pérez" foto="http://servidor/fotos-usuarios/a.png" />)

    const imagen = container.querySelector('img')
    expect(imagen).toHaveAttribute('src', 'http://servidor/fotos-usuarios/a.png')
    expect(imagen).toHaveAttribute('alt', '')
    expect(container.textContent).toBe('')
  })

  it('es decorativo', () => {
    const { container } = render(<Avatar nombre="Juan Pérez" />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('sin fotografía ni nombre muestra una silueta', () => {
    const { container } = render(<Avatar nombre="" />)

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.textContent).toBe('')
  })
})
