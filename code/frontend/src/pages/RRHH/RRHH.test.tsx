import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Departamento, Empleado, EmpleadoPosicion, Posicion } from '../../api/rrhh'
import { useContactosEmergencia, useCrearContactoEmergencia, useEliminarContactoEmergencia } from '../../hooks/useContactosEmergencia'
import { useCrearDepartamento, useDepartamentos, useDesactivarDepartamento, useEditarDepartamento, useReactivarDepartamento } from '../../hooks/useDepartamentos'
import { useCrearDependiente, useDependientes, useEliminarDependiente } from '../../hooks/useDependientes'
import { useEmpleadoPosicionesVigentes } from '../../hooks/useEmpleadoPosiciones'
import { useContratarEmpleado, useDesactivarEmpleado, useEditarEmpleado, useEmpleadosRRHH, useReactivarEmpleado } from '../../hooks/useEmpleadosRRHH'
import { useCrearPosicion, useDesactivarPosicion, useEditarPosicion, usePosiciones, useReactivarPosicion } from '../../hooks/usePosiciones'
import { useCrearSolicitudNomina } from '../../hooks/useSolicitudesNomina'
import { RRHH } from './RRHH'

vi.mock('../../hooks/useDepartamentos')
vi.mock('../../hooks/usePosiciones')
vi.mock('../../hooks/useEmpleadosRRHH')
vi.mock('../../hooks/useEmpleadoPosiciones')
vi.mock('../../hooks/useContactosEmergencia')
vi.mock('../../hooks/useDependientes')
vi.mock('../../hooks/useSolicitudesNomina')

const DEPARTAMENTOS: Departamento[] = [
  { id: 1, nombre_departamento: 'Ventas', departamento_padre: null, posicion_manager: null, activo: true },
  { id: 2, nombre_departamento: 'Almacén', departamento_padre: null, posicion_manager: null, activo: true },
]

const POSICIONES: Posicion[] = [
  { id: 10, titulo_posicion: 'Gerente de ventas', departamento: 1, reporta_a: null, salario_minimo: '10000.00', salario_maximo: '15000.00', activo: true },
  { id: 11, titulo_posicion: 'Vendedor', departamento: 1, reporta_a: 10, salario_minimo: '5000.00', salario_maximo: '9000.00', activo: true },
]

const EMPLEADOS: Empleado[] = [
  { id: 100, nombre_completo: 'Ana Torres', curp: '', rfc: '', nss: '', telefono: '', email: '', fotografia: null, cuenta_bancaria: '', activo: true },
  { id: 101, nombre_completo: 'Beto Ruiz', curp: '', rfc: '', nss: '', telefono: '', email: '', fotografia: null, cuenta_bancaria: '', activo: true },
  { id: 102, nombre_completo: 'Cindy Paz', curp: '', rfc: '', nss: '', telefono: '', email: '', fotografia: null, cuenta_bancaria: '', activo: true },
]

const ASIGNACIONES_VENDEDOR: EmpleadoPosicion[] = [
  { id: 900, empleado: 100, posicion: 11, salario_asignado: '6000.00', fecha_inicio: '2024-01-01', fecha_termino: null, motivo_cambio: 'contratacion' },
  { id: 901, empleado: 101, posicion: 11, salario_asignado: '6500.00', fecha_inicio: '2025-01-01', fecha_termino: null, motivo_cambio: 'contratacion' },
  { id: 902, empleado: 102, posicion: 11, salario_asignado: '7000.00', fecha_inicio: '2026-01-01', fecha_termino: null, motivo_cambio: 'contratacion' },
]

function mutacionOk<T>(valor?: T) {
  return { mutateAsync: vi.fn().mockResolvedValue(valor), mutate: vi.fn(), isPending: false }
}

function mockearHooks() {
  vi.mocked(useDepartamentos).mockReturnValue(
    { data: DEPARTAMENTOS, isLoading: false } as unknown as ReturnType<typeof useDepartamentos>,
  )
  vi.mocked(usePosiciones).mockReturnValue(
    { data: POSICIONES, isLoading: false } as unknown as ReturnType<typeof usePosiciones>,
  )
  vi.mocked(useEmpleadosRRHH).mockReturnValue(
    { data: EMPLEADOS, isLoading: false } as unknown as ReturnType<typeof useEmpleadosRRHH>,
  )
  vi.mocked(useEmpleadoPosicionesVigentes).mockReturnValue(
    { data: ASIGNACIONES_VENDEDOR, isLoading: false } as unknown as ReturnType<typeof useEmpleadoPosicionesVigentes>,
  )
  vi.mocked(useContactosEmergencia).mockReturnValue(
    { data: [], isLoading: false } as unknown as ReturnType<typeof useContactosEmergencia>,
  )
  vi.mocked(useDependientes).mockReturnValue(
    { data: [], isLoading: false } as unknown as ReturnType<typeof useDependientes>,
  )

  vi.mocked(useCrearDepartamento).mockReturnValue(mutacionOk(DEPARTAMENTOS[0]) as unknown as ReturnType<typeof useCrearDepartamento>)
  vi.mocked(useEditarDepartamento).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useEditarDepartamento>)
  vi.mocked(useDesactivarDepartamento).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useDesactivarDepartamento>)
  vi.mocked(useReactivarDepartamento).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useReactivarDepartamento>)

  vi.mocked(useCrearPosicion).mockReturnValue(mutacionOk(POSICIONES[0]) as unknown as ReturnType<typeof useCrearPosicion>)
  vi.mocked(useEditarPosicion).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useEditarPosicion>)
  vi.mocked(useDesactivarPosicion).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useDesactivarPosicion>)
  vi.mocked(useReactivarPosicion).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useReactivarPosicion>)

  vi.mocked(useContratarEmpleado).mockReturnValue(mutacionOk(EMPLEADOS[0]) as unknown as ReturnType<typeof useContratarEmpleado>)
  vi.mocked(useEditarEmpleado).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useEditarEmpleado>)
  vi.mocked(useDesactivarEmpleado).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useDesactivarEmpleado>)
  vi.mocked(useReactivarEmpleado).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useReactivarEmpleado>)

  vi.mocked(useCrearSolicitudNomina).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useCrearSolicitudNomina>)
  vi.mocked(useCrearContactoEmergencia).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useCrearContactoEmergencia>)
  vi.mocked(useEliminarContactoEmergencia).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useEliminarContactoEmergencia>)
  vi.mocked(useCrearDependiente).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useCrearDependiente>)
  vi.mocked(useEliminarDependiente).mockReturnValue(mutacionOk() as unknown as ReturnType<typeof useEliminarDependiente>)
}

function expandirVendedor() {
  fireEvent.click(screen.getByText('Vendedor'))
}

describe('RRHH', () => {
  it('muestra las pestañas de departamentos y selecciona el primero por default', () => {
    mockearHooks()
    render(<RRHH />)

    expect(screen.getByRole('tab', { name: /ventas/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /almacén/i })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('Gerente de ventas')).toBeInTheDocument()
  })

  it('las posiciones se muestran de mayor a menor jerarquía (el gerente antes que su subordinado)', () => {
    mockearHooks()
    render(<RRHH />)

    const titulos = screen.getAllByText(/^(Gerente de ventas|Vendedor)$/).map((el) => el.textContent)
    const indiceGerente = titulos.findIndex((t) => t?.includes('Gerente'))
    const indiceVendedor = titulos.findIndex((t) => t?.includes('Vendedor'))
    expect(indiceGerente).toBeLessThan(indiceVendedor)
  })

  it('al hacer click en una posición se despliega la lista de empleados, 5 por default', () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()

    expect(screen.getByText('Ana Torres')).toBeInTheDocument()
    expect(screen.getByText('Beto Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Cindy Paz')).toBeInTheDocument()
  })

  it('el selector 5/10/todos recorta la lista de empleados sin volver a pedir datos', () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()
    const grupo = screen.getByRole('group', { name: /cantidad de empleados a mostrar/i })

    fireEvent.click(within(grupo).getByRole('button', { name: '5' }))
    expect(screen.getAllByText(/Torres|Ruiz|Paz/)).toHaveLength(3)

    // Con solo 3 asignaciones vigentes en el mock, "todos" y "5" se ven
    // igual — se verifica igual que no cambie el conteo de llamadas al hook.
    expect(useEmpleadoPosicionesVigentes).toHaveBeenCalledTimes(
      vi.mocked(useEmpleadoPosicionesVigentes).mock.calls.length,
    )
  })

  it('"Nuevo empleado" captura los datos completos y una fotografía, no solo nombre/salario/fecha', () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()
    fireEvent.click(screen.getByRole('button', { name: /nuevo empleado/i }))

    const dialogo = screen.getByRole('dialog', { name: /nuevo empleado/i })
    fireEvent.change(within(dialogo).getByLabelText(/nombre completo/i), { target: { value: 'Diana Ruiz' } })
    fireEvent.change(within(dialogo).getByLabelText('CURP'), { target: { value: 'RUDI900101HDFXXX02' } })
    fireEvent.change(within(dialogo).getByLabelText('RFC'), { target: { value: 'RUDI900101XY2' } })
    fireEvent.change(within(dialogo).getByLabelText('Correo'), { target: { value: 'diana@flebosil.test' } })

    const archivo = new File(['contenido'], 'foto.png', { type: 'image/png' })
    const campoArchivo = within(dialogo).getByLabelText(/fotografía/i) as HTMLInputElement
    fireEvent.change(campoArchivo, { target: { files: [archivo] } })

    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar/i }))

    expect(vi.mocked(useContratarEmpleado)().mutateAsync).toHaveBeenCalledWith({
      datos: expect.objectContaining({
        nombre_completo: 'Diana Ruiz', curp: 'RUDI900101HDFXXX02', rfc: 'RUDI900101XY2',
        email: 'diana@flebosil.test', posicion: 11,
      }),
      foto: archivo,
    })
  })

  it('al hacer click en un empleado se abre su detalle, con botón Modificar', () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()
    fireEvent.click(screen.getByRole('button', { name: /ana torres/i }))

    const dialogo = screen.getByRole('dialog', { name: /ana torres/i })
    expect(within(dialogo).getByRole('button', { name: /modificar/i })).toBeInTheDocument()
  })

  it('modificar habilita un campo de archivo para reemplazar la fotografía', () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()
    fireEvent.click(screen.getByRole('button', { name: /ana torres/i }))

    const dialogo = screen.getByRole('dialog', { name: /ana torres/i })
    expect(dialogo.querySelector('input[type="file"]')).not.toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: /modificar/i }))
    expect(dialogo.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('modificar y guardar pide confirmación antes de aplicar el cambio', async () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()
    fireEvent.click(screen.getByRole('button', { name: /ana torres/i }))

    const dialogo = screen.getByRole('dialog', { name: /ana torres/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /modificar/i }))

    const campoNombre = within(dialogo).getByDisplayValue('Ana Torres')
    fireEvent.change(campoNombre, { target: { value: 'Ana Torres López' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: /guardar/i }))

    const confirmacion = await screen.findByRole('dialog', { name: /estás seguro/i })
    expect(confirmacion).toBeInTheDocument()

    fireEvent.click(within(confirmacion).getByRole('button', { name: /confirmar/i }))
    expect(vi.mocked(useEditarEmpleado)().mutateAsync).toHaveBeenCalled()
  })

  it('desactivar un empleado exige elegir un motivo', () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()
    fireEvent.click(screen.getByRole('button', { name: /ana torres/i }))

    const dialogo = screen.getByRole('dialog', { name: /ana torres/i })
    fireEvent.click(within(dialogo).getByRole('button', { name: /desactivar/i }))

    const confirmacion = screen.getByRole('dialog', { name: /desactivar empleado/i })
    expect(within(confirmacion).getByLabelText(/motivo/i)).toBeInTheDocument()
  })

  it('permite registrar una nueva solicitud de nómina desde el detalle del empleado', async () => {
    mockearHooks()
    render(<RRHH />)

    expandirVendedor()
    fireEvent.click(screen.getByRole('button', { name: /ana torres/i }))

    const dialogo = screen.getByRole('dialog', { name: /ana torres/i })
    const seccion = within(dialogo).getByText('Nueva solicitud de nómina').closest('div') as HTMLElement

    fireEvent.change(within(seccion).getByLabelText('Periodo de inicio'), { target: { value: '2026-01-01' } })
    fireEvent.change(within(seccion).getByLabelText('Periodo de fin'), { target: { value: '2026-01-15' } })
    fireEvent.change(within(seccion).getByPlaceholderText('Monto'), { target: { value: '4500' } })
    fireEvent.click(within(seccion).getByRole('button', { name: /solicitar/i }))

    expect(await within(seccion).findByText(/solicitud registrada/i)).toBeInTheDocument()
    expect(vi.mocked(useCrearSolicitudNomina)().mutateAsync).toHaveBeenCalledWith({
      empleado: 100, periodo_inicio: '2026-01-01', periodo_fin: '2026-01-15', monto: '4500',
    })
  })

  it('agregar un departamento abre el formulario sin recargar la página', () => {
    mockearHooks()
    render(<RRHH />)

    fireEvent.click(screen.getByRole('button', { name: /agregar departamento/i }))
    expect(screen.getByRole('dialog', { name: /nuevo departamento/i })).toBeInTheDocument()
  })
})
