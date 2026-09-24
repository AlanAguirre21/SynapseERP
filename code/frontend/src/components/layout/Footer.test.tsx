import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { APP_VERSION } from '../../config/version'
import { Footer } from './Footer'

describe('Footer', () => {
  it('muestra la versión desde la fuente única de configuración', () => {
    render(<Footer />)

    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument()
  })

  it('muestra el copyright con el año actual calculado dinámicamente', () => {
    render(<Footer />)

    const anioActual = new Date().getFullYear()
    expect(screen.getByText(`© ${anioActual} FleboSil`)).toBeInTheDocument()
  })
})
