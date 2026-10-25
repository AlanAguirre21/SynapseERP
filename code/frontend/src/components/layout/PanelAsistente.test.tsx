import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { abrirConversacion, enviarMensajeAsistente } from '../../api/asistente'
import { useAuth } from '../../context/AuthContext'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import { useSolicitudesNominaPendientes } from '../../hooks/useSolicitudesNomina'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { MainLayout } from './MainLayout'

vi.mock('../../api/asistente')
vi.mock('../../context/AuthContext')
vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useAlertasStock')
vi.mock('../../hooks/useSolicitudesNomina')
vi.mock('../../hooks/useAuditoria', () => ({
  useResumenAuditoria: vi.fn(() => ({ data: undefined, isLoading: false })),
}))

function Pagina({ titulo, destino }: { titulo: string; destino: string }) {
  const navigate = useNavigate()
  return (
    <div>
      <h1>{titulo}</h1>
      <button type="button" onClick={() => navigate(destino)}>
        Ir a {destino}
      </button>
    </div>
  )
}

function renderLayout() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Pagina titulo="Dashboard" destino="/ventas" />} />
            <Route path="/ventas" element={<Pagina titulo="Ventas" destino="/dashboard" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PanelAsistente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      autenticado: true, login: vi.fn(), logout: vi.fn(), iniciarSesionConTokens: vi.fn(),
    })
    vi.mocked(useUsuarioActual).mockReturnValue({
      data: { nombre: 'Ana', rol: 'admin', modulos: [] }, isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useUsuarioActual>)
    vi.mocked(useAlertasStock).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useAlertasStock>)
    vi.mocked(useSolicitudesNominaPendientes).mockReturnValue(
      { data: [], isLoading: false } as unknown as ReturnType<typeof useSolicitudesNominaPendientes>,
    )
    vi.mocked(abrirConversacion).mockResolvedValue({
      conversacion: 9,
      texto: 'Hola, soy el asistente de SynapseERP.',
      botones: [{ etiqueta: 'Ventas', nodo: 'tema:ventas' }],
    })
    vi.mocked(enviarMensajeAsistente).mockResolvedValue({
      mensaje: 1, texto: 'Ventas de hoy: $200.00 en 2 venta(s).', botones: [{ etiqueta: 'Volver al menú', nodo: 'menu' }],
      enlace: { ruta: '/ventas', etiqueta: 'Abrir Ventas' }, intencion: 'ventas_total', confianza: 'alta', modo: 'semantico',
    })
  })

  it('se abre desde el Header, saluda y enfoca la caja de texto; Esc lo cierra', async () => {
    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Asistente' }))

    const panel = await screen.findByRole('complementary', { name: 'Asistente' })
    expect(await within(panel).findByText('Hola, soy el asistente de SynapseERP.')).toBeInTheDocument()
    expect(within(panel).getByRole('textbox', { name: 'Pregunta para el asistente' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Asistente' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('complementary', { name: 'Asistente' })).not.toBeInTheDocument()
  })

  it('envía preguntas escritas y botones, y muestra el enlace al módulo', async () => {
    renderLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Asistente' }))
    const panel = await screen.findByRole('complementary', { name: 'Asistente' })

    fireEvent.click(await within(panel).findByRole('button', { name: 'Ventas' }))
    await waitFor(() => expect(enviarMensajeAsistente).toHaveBeenCalledWith(9, { nodo: 'tema:ventas' }))

    fireEvent.change(within(panel).getByRole('textbox'), { target: { value: '¿cuánto vendimos hoy?' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(enviarMensajeAsistente).toHaveBeenCalledWith(9, { texto: '¿cuánto vendimos hoy?' }))
    expect(within(panel).getByText('¿cuánto vendimos hoy?')).toBeInTheDocument()
    expect((await within(panel).findAllByRole('link', { name: 'Abrir Ventas' }))[0]).toHaveAttribute('href', '/ventas')
  })

  it('la conversación sobrevive a la navegación entre módulos', async () => {
    renderLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Asistente' }))
    const panel = await screen.findByRole('complementary', { name: 'Asistente' })
    expect(await within(panel).findByText('Hola, soy el asistente de SynapseERP.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ir a /ventas' }))

    expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeInTheDocument()
    expect(screen.getByText('Hola, soy el asistente de SynapseERP.')).toBeInTheDocument()
    expect(abrirConversacion).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando solo quedan los botones', async () => {
    vi.mocked(enviarMensajeAsistente).mockResolvedValue({
      mensaje: 2, texto: 'La búsqueda por texto no está disponible en este momento; usa los botones.',
      botones: [{ etiqueta: 'Ventas', nodo: 'tema:ventas' }], enlace: null, intencion: '', confianza: 'baja',
      modo: 'solo_arbol',
    })
    renderLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Asistente' }))
    const panel = await screen.findByRole('complementary', { name: 'Asistente' })
    await within(panel).findByText('Hola, soy el asistente de SynapseERP.')

    fireEvent.change(within(panel).getByRole('textbox'), { target: { value: 'hola' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Enviar' }))

    expect(await within(panel).findByText('La búsqueda por texto no está disponible; usa los botones.')).toBeInTheDocument()
  })
})
