import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { ConfiguracionPAC, DatosFiscalesEmpresa, SerieFolio } from '../../api/configuracionFiscal'
import {
  useActualizarConfiguracionPAC,
  useActualizarDatosFiscalesEmpresa,
  useConfiguracionPAC,
  useCrearSerieFolio,
  useDatosFiscalesEmpresa,
  useDesactivarSerieFolio,
  useEditarSerieFolio,
  useReactivarSerieFolio,
  useSeriesFolio,
} from '../../hooks/useConfiguracionFiscal'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { ConfiguracionFiscal } from './ConfiguracionFiscal'

vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useConfiguracionFiscal')

const DATOS_FISCALES_COMPLETOS: DatosFiscalesEmpresa = {
  rfc: 'FSI010101ABC',
  razon_social: 'FleboSil S.A. de C.V.',
  regimen_fiscal: '601',
  codigo_postal_fiscal: '01000',
  completa: true,
}

const DATOS_FISCALES_VACIOS: DatosFiscalesEmpresa = {
  rfc: '',
  razon_social: '',
  regimen_fiscal: '',
  codigo_postal_fiscal: '',
  completa: false,
}

const PAC_COMPLETO: ConfiguracionPAC = {
  proveedor: 'Facturama',
  api_key_configurada: true,
  api_endpoint: 'https://api.facturama.mx',
  configuracion_extra: {},
  activo: true,
  completa: true,
}

const PAC_VACIO: ConfiguracionPAC = {
  proveedor: '',
  api_key_configurada: false,
  api_endpoint: '',
  configuracion_extra: {},
  activo: false,
  completa: false,
}

const SERIES: SerieFolio[] = [
  { id: 1, serie: 'A', folio_actual: 100, activo: true },
  { id: 2, serie: 'B', folio_actual: 0, activo: false },
]

function mockUsuarioActual(rol: 'admin' | 'operador') {
  vi.mocked(useUsuarioActual).mockReturnValue(
    { data: { rol }, isLoading: false } as unknown as ReturnType<typeof useUsuarioActual>,
  )
}

function mockearHooks({
  datosFiscales = DATOS_FISCALES_COMPLETOS,
  pac = PAC_COMPLETO,
  series = SERIES,
  actualizarDatosFiscalesMock = vi.fn(),
  actualizarPacMock = vi.fn(),
  crearSerieMock = vi.fn(),
  editarSerieMock = vi.fn(),
  desactivarSerieMock = vi.fn(),
  reactivarSerieMock = vi.fn(),
}: {
  datosFiscales?: DatosFiscalesEmpresa
  pac?: ConfiguracionPAC
  series?: SerieFolio[]
  actualizarDatosFiscalesMock?: ReturnType<typeof vi.fn>
  actualizarPacMock?: ReturnType<typeof vi.fn>
  crearSerieMock?: ReturnType<typeof vi.fn>
  editarSerieMock?: ReturnType<typeof vi.fn>
  desactivarSerieMock?: ReturnType<typeof vi.fn>
  reactivarSerieMock?: ReturnType<typeof vi.fn>
} = {}) {
  vi.mocked(useDatosFiscalesEmpresa).mockReturnValue(
    { data: datosFiscales, isLoading: false } as unknown as ReturnType<typeof useDatosFiscalesEmpresa>,
  )
  vi.mocked(useActualizarDatosFiscalesEmpresa).mockReturnValue(
    { mutateAsync: actualizarDatosFiscalesMock, isPending: false } as unknown as ReturnType<
      typeof useActualizarDatosFiscalesEmpresa
    >,
  )
  vi.mocked(useConfiguracionPAC).mockReturnValue(
    { data: pac, isLoading: false } as unknown as ReturnType<typeof useConfiguracionPAC>,
  )
  vi.mocked(useActualizarConfiguracionPAC).mockReturnValue(
    { mutateAsync: actualizarPacMock, isPending: false } as unknown as ReturnType<
      typeof useActualizarConfiguracionPAC
    >,
  )
  vi.mocked(useSeriesFolio).mockReturnValue(
    { data: series, isLoading: false } as unknown as ReturnType<typeof useSeriesFolio>,
  )
  vi.mocked(useCrearSerieFolio).mockReturnValue(
    { mutateAsync: crearSerieMock, isPending: false } as unknown as ReturnType<typeof useCrearSerieFolio>,
  )
  vi.mocked(useEditarSerieFolio).mockReturnValue(
    { mutateAsync: editarSerieMock, isPending: false } as unknown as ReturnType<typeof useEditarSerieFolio>,
  )
  vi.mocked(useDesactivarSerieFolio).mockReturnValue(
    { mutateAsync: desactivarSerieMock, isPending: false } as unknown as ReturnType<typeof useDesactivarSerieFolio>,
  )
  vi.mocked(useReactivarSerieFolio).mockReturnValue(
    { mutateAsync: reactivarSerieMock, isPending: false } as unknown as ReturnType<typeof useReactivarSerieFolio>,
  )

  return {
    actualizarDatosFiscalesMock,
    actualizarPacMock,
    crearSerieMock,
    editarSerieMock,
    desactivarSerieMock,
    reactivarSerieMock,
  }
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <ConfiguracionFiscal />
    </MemoryRouter>,
  )
}

describe('ConfiguracionFiscal', () => {
  it('un operador no ve el contenido del módulo', () => {
    mockearHooks()
    mockUsuarioActual('operador')

    renderPagina()

    expect(screen.queryByRole('heading', { name: 'Configuración Fiscal' })).not.toBeInTheDocument()
  })

  it('un admin ve el contenido del módulo', () => {
    mockearHooks()
    mockUsuarioActual('admin')

    renderPagina()

    expect(screen.getByRole('heading', { name: 'Configuración Fiscal' })).toBeInTheDocument()
  })

  it('muestra el aviso de configuración incompleta si faltan datos fiscales o del PAC', () => {
    mockearHooks({ datosFiscales: DATOS_FISCALES_VACIOS, pac: PAC_VACIO })
    mockUsuarioActual('admin')

    renderPagina()

    expect(screen.getByRole('alert')).toHaveTextContent(/configuración incompleta/i)
  })

  it('no muestra el aviso cuando datos fiscales y PAC están completos', () => {
    mockearHooks({ datosFiscales: DATOS_FISCALES_COMPLETOS, pac: PAC_COMPLETO })
    mockUsuarioActual('admin')

    renderPagina()

    expect(screen.queryByText(/configuración incompleta/i)).not.toBeInTheDocument()
  })

  it('el campo de API key es de tipo password y muestra que ya está configurada sin revelarla', () => {
    mockearHooks({ pac: PAC_COMPLETO })
    mockUsuarioActual('admin')

    renderPagina()

    const campoApiKey = screen.getByLabelText(/api key/i)
    expect(campoApiKey).toHaveAttribute('type', 'password')
    expect(campoApiKey).toHaveValue('')
    expect(campoApiKey).toHaveAttribute('placeholder', expect.stringMatching(/configurada/i))
  })

  it('guardar datos fiscales envía los valores editados y muestra confirmación', async () => {
    const { actualizarDatosFiscalesMock } = mockearHooks({ datosFiscales: DATOS_FISCALES_VACIOS })
    mockUsuarioActual('admin')

    renderPagina()
    const seccionDatosFiscales = screen
      .getByRole('heading', { name: /datos fiscales de la empresa/i })
      .closest('section')
    expect(seccionDatosFiscales).not.toBeNull()
    const seccion = within(seccionDatosFiscales as HTMLElement)

    fireEvent.change(seccion.getByLabelText('RFC'), { target: { value: 'NUE010101XYZ' } })
    fireEvent.click(seccion.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() =>
      expect(actualizarDatosFiscalesMock).toHaveBeenCalledWith(
        expect.objectContaining({ rfc: 'NUE010101XYZ' }),
      ),
    )
    expect(await seccion.findByText('Datos fiscales actualizados.')).toBeInTheDocument()
  })

  it('guardar la conexión al PAC sin tocar la API key no la envía en el payload', async () => {
    const { actualizarPacMock } = mockearHooks({ pac: PAC_COMPLETO })
    mockUsuarioActual('admin')

    renderPagina()
    const seccionPac = screen.getByRole('heading', { name: /conexión al pac/i }).closest('section')
    expect(seccionPac).not.toBeNull()
    fireEvent.click(within(seccionPac as HTMLElement).getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => expect(actualizarPacMock).toHaveBeenCalled())
    expect(actualizarPacMock.mock.calls[0]?.[0]).not.toHaveProperty('api_key')
  })

  it('crear una nueva serie', async () => {
    const { crearSerieMock } = mockearHooks()
    mockUsuarioActual('admin')

    renderPagina()
    fireEvent.click(screen.getByRole('button', { name: /nueva serie/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva serie/i })
    fireEvent.change(within(dialogo).getByLabelText('Serie'), { target: { value: 'C' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^guardar$/i }))

    await waitFor(() =>
      expect(crearSerieMock).toHaveBeenCalledWith({ serie: 'C', folio_actual: 0 }),
    )
  })

  it('muestra el error del backend si la serie ya existe', async () => {
    const crearSerieMock = vi.fn().mockRejectedValue({
      response: { data: { serie: ['Ya existe una serie con ese nombre.'] } },
    })
    mockearHooks({ crearSerieMock })
    mockUsuarioActual('admin')

    renderPagina()
    fireEvent.click(screen.getByRole('button', { name: /nueva serie/i }))

    const dialogo = screen.getByRole('dialog', { name: /nueva serie/i })
    fireEvent.change(within(dialogo).getByLabelText('Serie'), { target: { value: 'A' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^guardar$/i }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Ya existe una serie con ese nombre.')
  })

  it('desactivar una serie activa pide confirmación y llama al hook', async () => {
    const { desactivarSerieMock } = mockearHooks()
    mockUsuarioActual('admin')

    renderPagina()
    fireEvent.click(screen.getByText('Desactivar'))

    const dialogo = screen.getByRole('dialog', { name: /desactivar serie/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^desactivar$/i }))

    await waitFor(() => expect(desactivarSerieMock).toHaveBeenCalledWith(1))
  })

  it('reactivar una serie inactiva llama al hook', async () => {
    const { reactivarSerieMock } = mockearHooks()
    mockUsuarioActual('admin')

    renderPagina()
    fireEvent.click(screen.getByText('Reactivar'))

    const dialogo = screen.getByRole('dialog', { name: /reactivar serie/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /^reactivar$/i }))

    await waitFor(() => expect(reactivarSerieMock).toHaveBeenCalledWith(2))
  })
})
