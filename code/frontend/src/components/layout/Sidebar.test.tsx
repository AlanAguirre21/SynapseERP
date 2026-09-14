import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { ModuloMenu } from '../../api/usuarios'
import { Sidebar } from './Sidebar'

const MODULOS_OPERADOR = [
  { slug: 'ventas', nombre: 'Ventas', ruta: '/ventas' },
  { slug: 'compras', nombre: 'Compras', ruta: '/compras' },
  { slug: 'inventario', nombre: 'Inventario', ruta: '/inventario' },
]

const MODULOS_ADMIN = [
  ...MODULOS_OPERADOR,
  { slug: 'caja', nombre: 'Caja', ruta: '/caja' },
  { slug: 'usuarios', nombre: 'Usuarios', ruta: '/usuarios' },
  { slug: 'contabilidad', nombre: 'Contabilidad', ruta: '/contabilidad' },
  { slug: 'configuracion_fiscal', nombre: 'Configuración Fiscal', ruta: '/configuracion-fiscal' },
]

function renderSidebar(modulos: ModuloMenu[]) {
  return render(
    <MemoryRouter>
      <Sidebar modulos={modulos} colapsado={false} />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  it('renderiza únicamente los módulos que recibe (operador no ve los admin-only)', () => {
    renderSidebar(MODULOS_OPERADOR)

    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('Compras')).toBeInTheDocument()
    expect(screen.queryByText('Caja')).not.toBeInTheDocument()
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument()
    expect(screen.queryByText('Contabilidad')).not.toBeInTheDocument()
    expect(screen.queryByText('Configuración Fiscal')).not.toBeInTheDocument()
  })

  it('renderiza los módulos admin-only cuando vienen incluidos (rol admin)', () => {
    renderSidebar(MODULOS_ADMIN)

    expect(screen.getByText('Caja')).toBeInTheDocument()
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(screen.getByText('Contabilidad')).toBeInTheDocument()
    expect(screen.getByText('Configuración Fiscal')).toBeInTheDocument()
  })

  it('siempre muestra el ítem fijo "Inicio" enlazado al Dashboard, sin importar el rol', () => {
    renderSidebar(MODULOS_OPERADOR)

    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/dashboard')
  })

  it('muestra "Inicio" incluso cuando no hay módulos disponibles (aún cargando o rol sin módulos)', () => {
    renderSidebar([])

    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/dashboard')
  })
})
