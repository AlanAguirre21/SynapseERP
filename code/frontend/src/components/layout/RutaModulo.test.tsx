import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Usuario } from '../../api/usuarios'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { RutaModulo } from './RutaModulo'

vi.mock('../../hooks/useUsuarioActual')

function usuarioCon(rol: Usuario['rol'], slugs: string[]) {
  const usuario = {
    rol,
    modulos: slugs.map((slug) => ({ slug, nombre: slug, ruta: `/${slug}` })),
  } as unknown as Usuario
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: usuario, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

function renderEnRrhh() {
  return render(
    <MemoryRouter initialEntries={['/rrhh']}>
      <Routes>
        <Route path="/dashboard" element={<p>Pantalla de inicio</p>} />
        <Route element={<RutaModulo slug="rrhh" />}>
          <Route path="/rrhh" element={<p>Pantalla de RRHH</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RutaModulo', () => {
  it('un operador que escribe la URL de RRHH es redirigido al Dashboard', () => {
    usuarioCon('operador', ['ventas', 'compras'])
    renderEnRrhh()

    expect(screen.queryByText('Pantalla de RRHH')).not.toBeInTheDocument()
    expect(screen.getByText('Pantalla de inicio')).toBeInTheDocument()
  })

  it('un admin con el módulo en su lista sí ve la pantalla', () => {
    usuarioCon('admin', ['ventas', 'rrhh'])
    renderEnRrhh()

    expect(screen.getByText('Pantalla de RRHH')).toBeInTheDocument()
  })
})
