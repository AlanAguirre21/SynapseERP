import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MensajeRegistroAsistente } from '../../api/asistente'
import type { ConteoFisico, DiscrepanciaAuditoria } from '../../api/auditoria'
import { useRegistroAsistente } from '../../hooks/useAsistente'
import {
  useAjustarDiscrepancia,
  useConteosFisicos,
  useCortesCaja,
  useCrearConteoFisico,
  useCrearCorteCaja,
  useDescartarConteoFisico,
  useDiscrepancias,
  useEjecucionesAuditoria,
  useEjecutarAuditoria,
  useJustificarDiscrepancia,
} from '../../hooks/useAuditoria'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { useUsuarios } from '../../hooks/useUsuarios'
import { AuditoriaAnalisis } from './AuditoriaAnalisis'

vi.mock('../../hooks/useAuditoria')
vi.mock('../../hooks/useUsuarioActual')
vi.mock('../../hooks/useSucursales')
vi.mock('../../hooks/useProductos')
vi.mock('../../hooks/useMateriaPrima')
vi.mock('../../hooks/useAsistente')
vi.mock('../../hooks/useUsuarios')

const DISCREPANCIA_BASE: DiscrepanciaAuditoria = {
  id: 1, ejecucion: 3, fecha_ejecucion: '2026-10-25T05:45:00Z', tipo: 'inventario', categoria: 'inventario_conteo',
  descripcion: 'Conteo #4: Suero fisiológico', corte: null, movimiento_caja_id: null, sucursal: 1,
  sucursal_nombre: 'Matriz', tipo_item: 'producto', item_id: 9, item_nombre: 'Suero fisiológico',
  valor_esperado: '20.00', valor_registrado: '17.00', diferencia: '-3.00', estado: 'abierta', resuelta_por: null,
  resuelta_por_nombre: '', fecha_resolucion: null, comentario_resolucion: '', movimiento_ajuste_id: null,
}

const DISCREPANCIA_CAJA: DiscrepanciaAuditoria = {
  ...DISCREPANCIA_BASE, id: 2, tipo: 'caja', categoria: 'caja_corte', descripcion: 'Corte de caja del 24/10/2026',
  sucursal: null, sucursal_nombre: '', tipo_item: '', item_id: null, item_nombre: '', valor_esperado: '250.00',
  valor_registrado: '230.00', diferencia: '-20.00',
}

const CONTEO: ConteoFisico = {
  id: 4, sucursal: 1, sucursal_nombre: 'Matriz', fecha_conteo: '2026-10-24T18:00:00Z', usuario: 2,
  usuario_nombre: 'Luis', observacion: '', estado: 'pendiente', ejecucion: null,
  detalles: [{ id: 1, tipo_item: 'producto', item_id: 9, item_nombre: 'Suero fisiológico', cantidad_contada: '17.00' }],
}

const MENSAJE_ASISTENTE: MensajeRegistroAsistente = {
  id: 7, conversacion: 3, usuario: 2, usuario_nombre: 'Luis', fecha: '2026-10-24T18:00:00Z', entrada_tipo: 'texto',
  entrada_texto: 'cómo va la lana', nodo_solicitado: '', intencion: 'ventas_total', confianza: 'media',
  puntuacion: '0.7012', alternativas: [], periodo: '', nodo_respuesta: 'sugerencias', version_catalogo: '1',
  respuesta_texto: 'No estoy seguro de haber entendido. ¿Quisiste decir…?', modo: 'semantico',
}

function mutacion(mutateAsync = vi.fn().mockResolvedValue({})) {
  return { mutateAsync, isPending: false } as unknown
}

function mockearHooks(rol: 'admin' | 'operador', discrepancias: DiscrepanciaAuditoria[] = [DISCREPANCIA_BASE]) {
  vi.mocked(useUsuarioActual).mockReturnValue({ data: { rol }, isLoading: false } as unknown as ReturnType<
    typeof useUsuarioActual
  >)
  vi.mocked(useSucursales).mockReturnValue({
    data: [{ id: 1, nombre_sucursal: 'Matriz', ubicacion_sucursal: '', telefono_sucursal: '', activo: true }],
  } as unknown as ReturnType<typeof useSucursales>)
  vi.mocked(useProductos).mockReturnValue({
    data: [{ id: 9, nombre_producto: 'Suero fisiológico', activo: true }],
  } as unknown as ReturnType<typeof useProductos>)
  vi.mocked(useMateriaPrima).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useMateriaPrima>)
  vi.mocked(useDiscrepancias).mockReturnValue({ data: discrepancias, isLoading: false } as unknown as ReturnType<
    typeof useDiscrepancias
  >)
  vi.mocked(useEjecucionesAuditoria).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<
    typeof useEjecucionesAuditoria
  >)
  vi.mocked(useCortesCaja).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useCortesCaja>)
  vi.mocked(useConteosFisicos).mockReturnValue({ data: [CONTEO], isLoading: false } as unknown as ReturnType<
    typeof useConteosFisicos
  >)
  vi.mocked(useEjecutarAuditoria).mockReturnValue(mutacion() as ReturnType<typeof useEjecutarAuditoria>)
  vi.mocked(useCrearCorteCaja).mockReturnValue(mutacion() as ReturnType<typeof useCrearCorteCaja>)
  vi.mocked(useCrearConteoFisico).mockReturnValue(mutacion() as ReturnType<typeof useCrearConteoFisico>)
  vi.mocked(useDescartarConteoFisico).mockReturnValue(mutacion() as ReturnType<typeof useDescartarConteoFisico>)
  vi.mocked(useAjustarDiscrepancia).mockReturnValue(mutacion() as ReturnType<typeof useAjustarDiscrepancia>)
  vi.mocked(useJustificarDiscrepancia).mockReturnValue(mutacion() as ReturnType<typeof useJustificarDiscrepancia>)
  vi.mocked(useUsuarios).mockReturnValue({ data: [{ id: 2, username: 'luis', first_name: 'Luis', last_name: '' }] } as unknown as ReturnType<
    typeof useUsuarios
  >)
  vi.mocked(useRegistroAsistente).mockReturnValue({ data: [MENSAJE_ASISTENTE], isLoading: false } as unknown as ReturnType<
    typeof useRegistroAsistente
  >)
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <AuditoriaAnalisis />
    </MemoryRouter>,
  )
}

describe('AuditoriaAnalisis', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/auditoria-analisis')
  })

  it('el admin ve las seis pestañas', () => {
    mockearHooks('admin')
    renderPagina()

    const pestanas = within(screen.getByRole('tablist')).getAllByRole('tab').map((t) => t.textContent)
    expect(pestanas).toEqual([
      'Discrepancias', 'Ejecuciones', 'Cortes de caja', 'Conteos físicos', 'Pronósticos', 'Registro del asistente',
    ])
  })

  it('el operador solo ve los conteos físicos y nunca el stock del sistema', () => {
    mockearHooks('operador')
    renderPagina()

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByText('Discrepancias')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /1 ▾/ }))
    expect(screen.getByText('Suero fisiológico')).toBeInTheDocument()
    expect(screen.queryByText('Stock del sistema')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument()
  })

  it('el modal de conteo es ciego: no muestra existencias', () => {
    mockearHooks('operador')
    renderPagina()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar conteo' }))
    const modal = screen.getByRole('dialog', { name: 'Registrar conteo físico' })

    expect(within(modal).getByText('Cantidad contada')).toBeInTheDocument()
    expect(within(modal).queryByText(/disponible|stock/i)).not.toBeInTheDocument()
  })

  it('el conteo se envía con la sucursal y sus líneas', () => {
    mockearHooks('operador')
    const crear = vi.fn().mockResolvedValue({})
    vi.mocked(useCrearConteoFisico).mockReturnValue(mutacion(crear) as ReturnType<typeof useCrearConteoFisico>)
    renderPagina()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar conteo' }))
    const modal = screen.getByRole('dialog', { name: 'Registrar conteo físico' })
    fireEvent.change(within(modal).getByLabelText('Sucursal'), { target: { value: '1' } })
    fireEvent.change(within(modal).getByLabelText('Ítem de la línea 1'), { target: { value: '9' } })
    fireEvent.change(within(modal).getByLabelText('Cantidad contada de la línea 1'), { target: { value: '17' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Guardar conteo' }))

    expect(crear).toHaveBeenCalledWith({
      sucursal: 1,
      observacion: '',
      detalles: [{ tipo_item: 'producto', item_id: 9, cantidad_contada: '17' }],
    })
  })

  it('solo las discrepancias de conteo ofrecen "Ajustar"; todas las abiertas, "Justificar"', () => {
    mockearHooks('admin', [DISCREPANCIA_BASE, DISCREPANCIA_CAJA])
    renderPagina()

    expect(screen.getAllByRole('button', { name: 'Ajustar' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Justificar' })).toHaveLength(2)
    expect(screen.getByText('−$20.00')).toBeInTheDocument()
    expect(screen.getByText('−3')).toBeInTheDocument()
  })

  it('ajustar explica el movimiento que se registrará y lo confirma', async () => {
    mockearHooks('admin')
    const ajustar = vi.fn().mockResolvedValue({})
    vi.mocked(useAjustarDiscrepancia).mockReturnValue(mutacion(ajustar) as ReturnType<typeof useAjustarDiscrepancia>)
    renderPagina()

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    const modal = screen.getByRole('dialog', { name: 'Ajustar stock' })
    expect(modal).toHaveTextContent('Se registrará una salida de 3 de Suero fisiológico en Matriz')
    fireEvent.click(within(modal).getByRole('button', { name: 'Aplicar ajuste' }))

    expect(ajustar).toHaveBeenCalledWith({ id: 1, comentario: '' })
  })

  it('justificar exige un comentario', () => {
    mockearHooks('admin')
    const justificar = vi.fn().mockResolvedValue({})
    vi.mocked(useJustificarDiscrepancia).mockReturnValue(
      mutacion(justificar) as ReturnType<typeof useJustificarDiscrepancia>,
    )
    renderPagina()

    fireEvent.click(screen.getByRole('button', { name: 'Justificar' }))
    const modal = screen.getByRole('dialog', { name: 'Justificar discrepancia' })
    fireEvent.click(within(modal).getByRole('button', { name: 'Justificar' }))

    expect(within(modal).getByRole('alert')).toHaveTextContent('Escribe la justificación.')
    expect(justificar).not.toHaveBeenCalled()
  })

  it('"Ejecutar ahora" lanza la auditoría del tipo elegido', () => {
    mockearHooks('admin')
    const ejecutar = vi.fn().mockResolvedValue({ estado: 'exitosa', elementos_revisados: 3, discrepancias_encontradas: 0 })
    vi.mocked(useEjecutarAuditoria).mockReturnValue(mutacion(ejecutar) as ReturnType<typeof useEjecutarAuditoria>)
    renderPagina()

    fireEvent.click(screen.getByRole('tab', { name: 'Ejecuciones' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar auditoría de inventario' }))

    expect(ejecutar).toHaveBeenCalledWith('inventario')
  })

  it('abre la pestaña y la sucursal pedidas en la URL', () => {
    window.history.replaceState({}, '', '/auditoria-analisis?pestana=discrepancias&sucursal=1')
    mockearHooks('admin')
    renderPagina()

    expect(vi.mocked(useDiscrepancias)).toHaveBeenLastCalledWith(
      expect.objectContaining({ tipo: 'inventario', sucursal: 1, estado: 'abierta' }),
    )
  })

  it('el registro del asistente filtra por usuario, intención, confianza y preguntas dudosas', () => {
    mockearHooks('admin')
    renderPagina()
    fireEvent.click(screen.getByRole('tab', { name: 'Registro del asistente' }))

    expect(screen.getByText('«cómo va la lana»')).toBeInTheDocument()
    expect(screen.getByText(/Media · 0\.70/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Intención'), { target: { value: 'ventas_total' } })
    fireEvent.change(screen.getByLabelText('Confianza'), { target: { value: 'media' } })
    fireEvent.click(screen.getByLabelText(/Solo preguntas dudosas/))

    expect(vi.mocked(useRegistroAsistente)).toHaveBeenLastCalledWith({
      usuario: 2, intencion: 'ventas_total', confianza: 'media', solo_dudosas: 'true',
      fecha_desde: undefined, fecha_hasta: undefined,
    })
  })
})
