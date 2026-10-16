import { Fragment, useState, type FormEvent } from 'react'

import type {
  Departamento,
  Empleado,
  EmpleadoFormulario,
  EmpleadoPosicion,
  MotivoCambio,
  Posicion,
} from '../../api/rrhh'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import {
  useContactosEmergencia,
  useCrearContactoEmergencia,
  useEliminarContactoEmergencia,
} from '../../hooks/useContactosEmergencia'
import {
  useCrearDepartamento,
  useDepartamentos,
  useDesactivarDepartamento,
  useEditarDepartamento,
  useReactivarDepartamento,
} from '../../hooks/useDepartamentos'
import { useCrearDependiente, useDependientes, useEliminarDependiente } from '../../hooks/useDependientes'
import { useEmpleadoPosicionesVigentes } from '../../hooks/useEmpleadoPosiciones'
import {
  useContratarEmpleado,
  useDesactivarEmpleado,
  useEditarEmpleado,
  useEmpleadosRRHH,
  useReactivarEmpleado,
} from '../../hooks/useEmpleadosRRHH'
import {
  useCrearPosicion,
  useDesactivarPosicion,
  useEditarPosicion,
  usePosiciones,
  useReactivarPosicion,
} from '../../hooks/usePosiciones'
import { useCrearSolicitudNomina } from '../../hooks/useSolicitudesNomina'
import { obtenerIniciales } from '../../utils/texto'
import styles from './RRHH.module.css'

function extraerMensajeError(err: unknown, campos: string[], mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined

  if (typeof datos?.detail === 'string') return datos.detail

  for (const campo of campos) {
    const valor = datos?.[campo]
    if (typeof valor === 'string') return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
  }

  return mensajePorDefecto
}

// Sangría del árbol de posiciones por nivel de profundidad (clases de
// RRHH.module.css); los niveles más profundos reutilizan la última.
const CLASES_NIVEL = [
  '',
  styles.treeLevel1,
  styles.treeLevel2,
  styles.treeLevel3,
  styles.treeLevel4,
  styles.treeLevel5,
]

function claseNivel(profundidad: number): string {
  return CLASES_NIVEL[Math.min(profundidad, CLASES_NIVEL.length - 1)] ?? ''
}

// Posiciones de un departamento, ordenadas de mayor a menor jerarquía
// (raíces primero, luego sus subordinadas, profundidad primero) a partir de
// `reporta_a` — se construye en el frontend porque el árbol de puestos de
// una empresa pequeña no justifica una consulta recursiva en el backend.
function ordenarPorJerarquia(posiciones: Posicion[]): { posicion: Posicion; profundidad: number }[] {
  const hijosPorPadre = new Map<number | null, Posicion[]>()
  posiciones.forEach((p) => {
    const clave = p.reporta_a
    hijosPorPadre.set(clave, [...(hijosPorPadre.get(clave) ?? []), p])
  })

  const resultado: { posicion: Posicion; profundidad: number }[] = []
  const visitados = new Set<number>()

  function visitar(padreId: number | null, profundidad: number) {
    for (const hijo of hijosPorPadre.get(padreId) ?? []) {
      if (visitados.has(hijo.id)) continue
      visitados.add(hijo.id)
      resultado.push({ posicion: hijo, profundidad })
      visitar(hijo.id, profundidad + 1)
    }
  }

  visitar(null, 0)

  // Huérfanas (reporta_a apunta fuera de esta lista, o hay un ciclo): se
  // agregan al final para no perderlas de la vista.
  posiciones.forEach((p) => {
    if (!visitados.has(p.id)) resultado.push({ posicion: p, profundidad: 0 })
  })

  return resultado
}

type LimiteLista = '5' | '10' | 'todos'

export function RRHH() {
  const { data: departamentos, isLoading } = useDepartamentos()
  const { data: empleados } = useEmpleadosRRHH()
  const [departamentoId, setDepartamentoId] = useState<number | null>(null)
  const [formularioDepto, setFormularioDepto] = useState<'nuevo' | Departamento | null>(null)
  const desactivarDepto = useDesactivarDepartamento()
  const reactivarDepto = useReactivarDepartamento()
  const [confirmarDeptoAbierto, setConfirmarDeptoAbierto] = useState(false)

  // Sin selección explícita del usuario todavía, cae al primer departamento
  // de la lista — derivado en cada render en vez de sincronizado con un
  // efecto (no hay ningún sistema externo que sincronizar aquí).
  const idSeleccionado = departamentoId ?? departamentos?.[0]?.id ?? null
  const departamentoSeleccionado = departamentos?.find((d) => d.id === idSeleccionado) ?? null

  async function confirmarCambioDepto() {
    if (!departamentoSeleccionado) return
    if (departamentoSeleccionado.activo) {
      await desactivarDepto.mutateAsync(departamentoSeleccionado.id)
    } else {
      await reactivarDepto.mutateAsync(departamentoSeleccionado.id)
    }
    setConfirmarDeptoAbierto(false)
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="pageTitle">Recursos Humanos</h1>
        <BotonPrimario variante="secundario" onClick={() => setFormularioDepto('nuevo')}>
          Agregar departamento
        </BotonPrimario>
      </div>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Departamentos</span>
          <span className="statValue">{departamentos ? departamentos.length : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Empleados activos</span>
          <span className="statValue">{empleados ? empleados.filter((e) => e.activo).length : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Empleados inactivos</span>
          <span className="statValue">{empleados ? empleados.filter((e) => !e.activo).length : '…'}</span>
        </div>
      </div>

      {isLoading ? (
        <p>Cargando departamentos…</p>
      ) : (
        <>
          {/* Pestañas de departamento a la izquierda; a la derecha, las
              acciones sobre el departamento seleccionado. "Agregar
              departamento" vive en el encabezado de la página, así que sigue
              disponible aunque no haya ninguno. */}
          <div className={styles.departmentBar}>
            <div className={styles.departmentTabs} role="tablist">
              {(departamentos ?? []).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={idSeleccionado === d.id}
                  className={idSeleccionado === d.id ? 'tab tabActive' : 'tab'}
                  onClick={() => setDepartamentoId(d.id)}
                >
                  {d.nombre_departamento}
                  {!d.activo && ' (inactivo)'}
                </button>
              ))}
            </div>

            <div className={styles.departmentActions}>
              {departamentoSeleccionado && (
                <>
                  <button
                    type="button"
                    className="actionLink"
                    onClick={() => setFormularioDepto(departamentoSeleccionado)}
                  >
                    Editar departamento
                  </button>
                  <button
                    type="button"
                    className={departamentoSeleccionado.activo ? 'dangerActionLink' : 'actionLink'}
                    onClick={() => setConfirmarDeptoAbierto(true)}
                  >
                    {departamentoSeleccionado.activo ? 'Desactivar departamento' : 'Reactivar departamento'}
                  </button>
                </>
              )}
            </div>
          </div>

          {departamentoSeleccionado ? (
            <PanelDepartamento departamento={departamentoSeleccionado} empleados={empleados ?? []} />
          ) : (
            <p className="emptyState">Todavía no hay departamentos registrados.</p>
          )}
        </>
      )}

      <FormularioDepartamento
        key={formularioDepto === 'nuevo' ? 'nuevo' : formularioDepto?.id ?? 'cerrado'}
        abierto={formularioDepto !== null}
        departamentoEnEdicion={formularioDepto === 'nuevo' ? null : formularioDepto}
        onCerrar={() => setFormularioDepto(null)}
        onCreado={(id) => setDepartamentoId(id)}
      />

      {departamentoSeleccionado && (
        <Modal
          titulo={departamentoSeleccionado.activo ? 'Desactivar departamento' : 'Reactivar departamento'}
          abierto={confirmarDeptoAbierto}
          onCerrar={() => setConfirmarDeptoAbierto(false)}
        >
          <p className="confirmText">
            ¿Confirmas que quieres {departamentoSeleccionado.activo ? 'desactivar' : 'reactivar'} "
            {departamentoSeleccionado.nombre_departamento}"?
          </p>
          <div className="formActions">
            <BotonPrimario variante="secundario" onClick={() => setConfirmarDeptoAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario
              variante={departamentoSeleccionado.activo ? 'peligro' : 'primario'}
              onClick={confirmarCambioDepto}
              disabled={desactivarDepto.isPending || reactivarDepto.isPending}
            >
              Confirmar
            </BotonPrimario>
          </div>
        </Modal>
      )}
    </div>
  )
}

// --- Departamentos ----------------------------------------------------------

function FormularioDepartamento({
  abierto, onCerrar, onCreado, departamentoEnEdicion,
}: {
  abierto: boolean
  onCerrar: () => void
  onCreado: (id: number) => void
  departamentoEnEdicion?: Departamento | null
}) {
  const crear = useCrearDepartamento()
  const editar = useEditarDepartamento()
  const [nombre, setNombre] = useState(departamentoEnEdicion?.nombre_departamento ?? '')
  const [error, setError] = useState('')

  const guardando = crear.isPending || editar.isPending

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')

    if (!nombre.trim()) {
      setError('Ingresa el nombre del departamento.')
      return
    }

    try {
      if (departamentoEnEdicion) {
        await editar.mutateAsync({
          id: departamentoEnEdicion.id,
          datos: {
            nombre_departamento: nombre,
            departamento_padre: departamentoEnEdicion.departamento_padre,
            posicion_manager: departamentoEnEdicion.posicion_manager,
          },
        })
      } else {
        const departamento = await crear.mutateAsync({
          nombre_departamento: nombre, departamento_padre: null, posicion_manager: null,
        })
        onCreado(departamento.id)
      }
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, ['nombre_departamento'], 'No se pudo guardar el departamento. Intenta de nuevo.'))
    }
  }

  return (
    <Modal
      titulo={departamentoEnEdicion ? 'Editar departamento' : 'Nuevo departamento'}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form className="form" onSubmit={alGuardar} noValidate>
        <label className="field">
          Nombre del departamento
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>

        {error && <p className="errorMessage" role="alert">{error}</p>}

        <div className="formActions">
          <BotonPrimario type="button" variante="secundario" onClick={onCerrar}>Cancelar</BotonPrimario>
          <BotonPrimario type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}

// --- Posiciones + empleados por posición ------------------------------------

function formatearMoneda(valor: string) {
  return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function PanelDepartamento({ departamento, empleados }: { departamento: Departamento; empleados: Empleado[] }) {
  const { data: posiciones, isLoading } = usePosiciones(departamento.id)
  const desactivarPosicion = useDesactivarPosicion()
  const reactivarPosicion = useReactivarPosicion()

  const [posicionExpandidaId, setPosicionExpandidaId] = useState<number | null>(null)
  const [formularioPosicion, setFormularioPosicion] = useState<'nueva' | Posicion | null>(null)
  const [posicionAConfirmar, setPosicionAConfirmar] = useState<Posicion | null>(null)

  const jerarquia = ordenarPorJerarquia(posiciones ?? [])

  async function confirmarCambioPosicion() {
    if (!posicionAConfirmar) return
    if (posicionAConfirmar.activo) {
      await desactivarPosicion.mutateAsync(posicionAConfirmar.id)
    } else {
      await reactivarPosicion.mutateAsync(posicionAConfirmar.id)
    }
    setPosicionAConfirmar(null)
  }

  return (
    <div className="card">
      <div className="pageHeader">
        <h2 className="sectionTitle">Posiciones de {departamento.nombre_departamento}</h2>
        <BotonPrimario onClick={() => setFormularioPosicion('nueva')}>Agregar posición</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando posiciones…</p>
      ) : jerarquia.length === 0 ? (
        <p className="emptyState">Este departamento todavía no tiene posiciones.</p>
      ) : (
        <div className="tableScroll">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Posición</th>
                <th>Rango salarial</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {jerarquia.map(({ posicion, profundidad }) => {
                const esRaiz = profundidad === 0
                const expandida = posicionExpandidaId === posicion.id
                return (
                  <Fragment key={posicion.id}>
                    <tr
                      className={styles.positionRow}
                      onClick={() => setPosicionExpandidaId(expandida ? null : posicion.id)}
                      aria-expanded={expandida}
                    >
                      <td className={esRaiz ? styles.rootPositionCell : undefined}>
                        <span
                          className={`${styles.positionTitle} ${claseNivel(profundidad)}`}
                        >
                          <span className="expandIndicator">{expandida ? '▾' : '▸'}</span>
                          {!esRaiz && <span className={styles.treeConnector}>└</span>}
                          <span className={esRaiz ? styles.rootPositionName : styles.childPositionName}>
                            {posicion.titulo_posicion}
                          </span>
                        </span>
                      </td>
                      <td className={styles.salaryCell}>
                        {formatearMoneda(posicion.salario_minimo)} – {formatearMoneda(posicion.salario_maximo)}
                      </td>
                      <td>
                        <span className={posicion.activo ? 'status statusSuccess' : 'status statusNeutral'}>
                          {posicion.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        <div className="rowActions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="actionLink" onClick={() => setFormularioPosicion(posicion)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className={posicion.activo ? 'dangerActionLink' : 'actionLink'}
                            onClick={() => setPosicionAConfirmar(posicion)}
                          >
                            {posicion.activo ? 'Desactivar' : 'Reactivar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandida && (
                      <tr>
                        <td colSpan={4} className={styles.expandedCell}>
                          <PanelEmpleadosPorPosicion posicion={posicion} empleados={empleados} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <FormularioPosicion
        key={formularioPosicion === 'nueva' ? 'nueva' : formularioPosicion?.id ?? 'cerrado'}
        departamentoId={departamento.id}
        posiciones={posiciones ?? []}
        abierto={formularioPosicion !== null}
        posicionEnEdicion={formularioPosicion === 'nueva' ? null : formularioPosicion}
        onCerrar={() => setFormularioPosicion(null)}
      />

      <Modal
        titulo={posicionAConfirmar?.activo ? 'Desactivar posición' : 'Reactivar posición'}
        abierto={Boolean(posicionAConfirmar)}
        onCerrar={() => setPosicionAConfirmar(null)}
      >
        <p className="confirmText">
          ¿Confirmas que quieres {posicionAConfirmar?.activo ? 'desactivar' : 'reactivar'} "
          {posicionAConfirmar?.titulo_posicion}"?
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setPosicionAConfirmar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario
            variante={posicionAConfirmar?.activo ? 'peligro' : 'primario'}
            onClick={confirmarCambioPosicion}
            disabled={desactivarPosicion.isPending || reactivarPosicion.isPending}
          >
            Confirmar
          </BotonPrimario>
        </div>
      </Modal>
    </div>
  )
}

function FormularioPosicion({
  departamentoId, posiciones, abierto, onCerrar, posicionEnEdicion,
}: {
  departamentoId: number
  posiciones: Posicion[]
  abierto: boolean
  onCerrar: () => void
  posicionEnEdicion?: Posicion | null
}) {
  const crear = useCrearPosicion()
  const editar = useEditarPosicion()
  const [titulo, setTitulo] = useState(posicionEnEdicion?.titulo_posicion ?? '')
  const [reportaA, setReportaA] = useState<number | null>(posicionEnEdicion?.reporta_a ?? null)
  const [salarioMinimo, setSalarioMinimo] = useState(posicionEnEdicion?.salario_minimo ?? '0')
  const [salarioMaximo, setSalarioMaximo] = useState(posicionEnEdicion?.salario_maximo ?? '0')
  const [error, setError] = useState('')

  const guardando = crear.isPending || editar.isPending
  // Una posición no puede reportarse a sí misma.
  const opcionesReportaA = posiciones.filter((p) => p.id !== posicionEnEdicion?.id)

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')

    if (!titulo.trim()) {
      setError('Ingresa el título de la posición.')
      return
    }

    const datos = {
      titulo_posicion: titulo, departamento: departamentoId, reporta_a: reportaA,
      salario_minimo: salarioMinimo, salario_maximo: salarioMaximo,
    }

    try {
      if (posicionEnEdicion) {
        await editar.mutateAsync({ id: posicionEnEdicion.id, datos })
      } else {
        await crear.mutateAsync(datos)
      }
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, ['titulo_posicion', 'salario_maximo'], 'No se pudo guardar la posición. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo={posicionEnEdicion ? 'Editar posición' : 'Nueva posición'} abierto={abierto} onCerrar={onCerrar}>
      <form className="form" onSubmit={alGuardar} noValidate>
        <label className="field">
          Título de la posición
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </label>

        <label className="field">
          Reporta a (opcional)
          <select
            value={reportaA ?? ''}
            onChange={(e) => setReportaA(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Sin superior directo</option>
            {opcionesReportaA.map((p) => (
              <option key={p.id} value={p.id}>{p.titulo_posicion}</option>
            ))}
          </select>
        </label>

        <label className="field">
          Salario mínimo
          <input type="number" step="0.01" min="0" value={salarioMinimo} onChange={(e) => setSalarioMinimo(e.target.value)} />
        </label>

        <label className="field">
          Salario máximo
          <input type="number" step="0.01" min="0" value={salarioMaximo} onChange={(e) => setSalarioMaximo(e.target.value)} />
        </label>

        {error && <p className="errorMessage" role="alert">{error}</p>}

        <div className="formActions">
          <BotonPrimario type="button" variante="secundario" onClick={onCerrar}>Cancelar</BotonPrimario>
          <BotonPrimario type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}

// --- Empleados por posición, con selector 5/10/todos ------------------------

// Campos de la ficha, agrupados igual en consulta, edición y alta.
const GRUPOS_EMPLEADO: {
  titulo: string
  campos: { clave: keyof EmpleadoFormulario; etiqueta: string; tipo: 'text' | 'email' }[]
}[] = [
  {
    titulo: 'Datos personales',
    campos: [
      { clave: 'nombre_completo', etiqueta: 'Nombre completo', tipo: 'text' },
      { clave: 'curp', etiqueta: 'CURP', tipo: 'text' },
      { clave: 'rfc', etiqueta: 'RFC', tipo: 'text' },
      { clave: 'nss', etiqueta: 'NSS', tipo: 'text' },
    ],
  },
  {
    titulo: 'Contacto',
    campos: [
      { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'text' },
      { clave: 'email', etiqueta: 'Correo', tipo: 'email' },
    ],
  },
  {
    titulo: 'Pago de nómina',
    campos: [{ clave: 'cuenta_bancaria', etiqueta: 'Cuenta bancaria', tipo: 'text' }],
  },
]

// 'AAAA-MM-DD' -> 'DD/MM/AAAA', sin pasar por Date para no mover el día por zona horaria.
function formatearFecha(fecha: string): string {
  return fecha.split('-').reverse().join('/')
}

// Fotografía del empleado o, si no tiene, sus iniciales.
function AvatarEmpleado({ empleado, tamano }: { empleado: Empleado; tamano: 'chico' | 'grande' }) {
  const clase = `${styles.employeeAvatar} ${tamano === 'grande' ? styles.employeeAvatarLarge : styles.employeeAvatarSmall}`

  if (empleado.fotografia) {
    return (
      <img
        src={empleado.fotografia}
        alt={tamano === 'grande' ? `Fotografía de ${empleado.nombre_completo}` : ''}
        className={clase}
      />
    )
  }

  return (
    <span className={clase} aria-hidden="true">
      {obtenerIniciales(empleado.nombre_completo)}
    </span>
  )
}

function PanelEmpleadosPorPosicion({ posicion, empleados }: { posicion: Posicion; empleados: Empleado[] }) {
  const { data: asignaciones, isLoading } = useEmpleadoPosicionesVigentes(posicion.id)
  const [limite, setLimite] = useState<LimiteLista>('5')
  const [formularioContratarAbierto, setFormularioContratarAbierto] = useState(false)
  // Se guarda solo el id, no el objeto — así el modal siempre refleja los
  // datos más recientes de `empleados` (por ejemplo, tras editar el nombre)
  // en vez de una copia tomada en el momento del click.
  const [empleadoSeleccionadoId, setEmpleadoSeleccionadoId] = useState<number | null>(null)

  const lista = asignaciones ?? []
  const cantidad = limite === 'todos' ? lista.length : Number(limite)
  const listaRecortada = lista.slice(0, cantidad)

  function empleadoDe(id: number): Empleado | undefined {
    return empleados.find((e) => e.id === id)
  }

  const empleadoSeleccionado = empleadoSeleccionadoId !== null ? empleadoDe(empleadoSeleccionadoId) ?? null : null

  return (
    <div className={styles.employeePanel}>
      <div className="sectionHeader">
        <div className="segmented" role="group" aria-label="Cantidad de empleados a mostrar">
          {(['5', '10', 'todos'] as LimiteLista[]).map((valor) => (
            <button
              key={valor}
              type="button"
              className={limite === valor ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
              onClick={() => setLimite(valor)}
            >
              {valor === 'todos' ? 'Todos' : valor}
            </button>
          ))}
        </div>
        <BotonPrimario onClick={() => setFormularioContratarAbierto(true)}>Nuevo empleado</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando empleados…</p>
      ) : listaRecortada.length === 0 ? (
        <p className="emptyState">Nadie desempeña esta posición actualmente.</p>
      ) : (
        <ul className={styles.employeeList}>
          {listaRecortada.map((asignacion) => {
            const empleado = empleadoDe(asignacion.empleado)
            return (
              <li key={asignacion.id}>
                <button
                  type="button"
                  className={styles.employeeItem}
                  onClick={() => empleado && setEmpleadoSeleccionadoId(empleado.id)}
                >
                  {empleado && <AvatarEmpleado empleado={empleado} tamano="chico" />}
                  <span className={styles.employeeItemText}>
                    <span className={styles.employeeItemName}>
                      {empleado?.nombre_completo ?? `Empleado #${asignacion.empleado}`}
                    </span>
                    <span className={styles.employeeItemMeta}>Desde {formatearFecha(asignacion.fecha_inicio)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <FormularioContratar
        posicion={posicion}
        abierto={formularioContratarAbierto}
        onCerrar={() => setFormularioContratarAbierto(false)}
      />

      {empleadoSeleccionado && (
        <ModalDetalleEmpleado
          empleado={empleadoSeleccionado}
          posicion={posicion}
          asignacion={lista.find((a) => a.empleado === empleadoSeleccionado.id)}
          onCerrar={() => setEmpleadoSeleccionadoId(null)}
        />
      )}
    </div>
  )
}

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10)
}

const DATOS_EMPLEADO_VACIOS = {
  nombre_completo: '', curp: '', rfc: '', nss: '', telefono: '', email: '', cuenta_bancaria: '',
}

function FormularioContratar({
  posicion, abierto, onCerrar,
}: {
  posicion: Posicion
  abierto: boolean
  onCerrar: () => void
}) {
  const contratar = useContratarEmpleado()
  const [datos, setDatos] = useState(DATOS_EMPLEADO_VACIOS)
  const [salarioAsignado, setSalarioAsignado] = useState(posicion.salario_minimo)
  const [fechaInicio, setFechaInicio] = useState(fechaHoy())
  const [foto, setFoto] = useState<File | null>(null)
  const [error, setError] = useState('')

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')

    if (!datos.nombre_completo.trim()) {
      setError('Ingresa el nombre completo del empleado.')
      return
    }

    try {
      // Alta combinada y atómica del lado del backend (empleado + primera
      // asignación en una sola petición) — evita el registro huérfano que
      // resultaría de dos llamadas separadas si la segunda fallara.
      await contratar.mutateAsync({
        datos: { ...datos, posicion: posicion.id, salario_asignado: salarioAsignado, fecha_inicio: fechaInicio },
        foto,
      })
      setDatos(DATOS_EMPLEADO_VACIOS)
      setFoto(null)
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, ['nombre_completo', 'salario_asignado'], 'No se pudo registrar al empleado. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo={`Nuevo empleado — ${posicion.titulo_posicion}`} abierto={abierto} onCerrar={onCerrar} ancho="amplio">
      <form className="form" onSubmit={alGuardar} noValidate>
        {GRUPOS_EMPLEADO.map((grupo) => (
          <section key={grupo.titulo} className={styles.dataSection}>
            <h3 className="subtitle">{grupo.titulo}</h3>
            <div className="formGrid">
              {grupo.campos.map((campo) => (
                <label key={campo.clave} className="field">
                  {campo.etiqueta}
                  <input
                    type={campo.tipo}
                    value={datos[campo.clave]}
                    onChange={(e) => setDatos((v) => ({ ...v, [campo.clave]: e.target.value }))}
                    required={campo.clave === 'nombre_completo'}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className={styles.dataSection}>
          <h3 className="subtitle">Puesto</h3>
          <div className="formGrid">
            <label className="field">
              Salario asignado
              <input
                type="number" step="0.01" min="0" value={salarioAsignado}
                onChange={(e) => setSalarioAsignado(e.target.value)}
              />
              <span className="fieldHint">
                Rango de la posición: {posicion.salario_minimo} – {posicion.salario_maximo}
              </span>
            </label>

            <label className="field">
              Fecha de inicio
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
            </label>

            <label className="field formGridFull">
              Fotografía (opcional)
              <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </section>

        {error && <p className="errorMessage" role="alert">{error}</p>}

        <div className="formActions">
          <BotonPrimario type="button" variante="secundario" onClick={onCerrar}>Cancelar</BotonPrimario>
          <BotonPrimario type="submit" disabled={contratar.isPending}>
            {contratar.isPending ? 'Guardando…' : 'Guardar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}

// --- Detalle de empleado: ver, modificar, desactivar/reactivar -------------

const MOTIVOS_DESACTIVACION: { valor: MotivoCambio; etiqueta: string }[] = [
  { valor: 'renuncia', etiqueta: 'Renuncia' },
  { valor: 'despido', etiqueta: 'Despido' },
]

function ModalDetalleEmpleado({
  empleado, posicion, asignacion, onCerrar,
}: {
  empleado: Empleado
  posicion: Posicion
  asignacion?: EmpleadoPosicion
  onCerrar: () => void
}) {
  const editar = useEditarEmpleado()
  const desactivar = useDesactivarEmpleado()
  const reactivar = useReactivarEmpleado()

  const [enEdicion, setEnEdicion] = useState(false)
  const [valores, setValores] = useState({
    nombre_completo: empleado.nombre_completo,
    curp: empleado.curp,
    rfc: empleado.rfc,
    nss: empleado.nss,
    telefono: empleado.telefono,
    email: empleado.email,
    cuenta_bancaria: empleado.cuenta_bancaria,
  })
  const [foto, setFoto] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [confirmarGuardadoAbierto, setConfirmarGuardadoAbierto] = useState(false)
  const [motivoDesactivacion, setMotivoDesactivacion] = useState<MotivoCambio>('renuncia')
  const [confirmarDesactivarAbierto, setConfirmarDesactivarAbierto] = useState(false)

  function pedirConfirmacion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!valores.nombre_completo.trim()) {
      setError('El nombre completo no puede quedar vacío.')
      return
    }
    setError('')
    setConfirmarGuardadoAbierto(true)
  }

  async function confirmarGuardado() {
    try {
      await editar.mutateAsync({ id: empleado.id, datos: valores, foto })
      setConfirmarGuardadoAbierto(false)
      setEnEdicion(false)
      setFoto(null)
    } catch (err) {
      setConfirmarGuardadoAbierto(false)
      setError(extraerMensajeError(err, ['nombre_completo'], 'No se pudo guardar. Intenta de nuevo.'))
    }
  }

  async function confirmarDesactivacion() {
    await desactivar.mutateAsync({ id: empleado.id, motivoCambio: motivoDesactivacion })
    setConfirmarDesactivarAbierto(false)
    onCerrar()
  }

  async function confirmarReactivacion() {
    await reactivar.mutateAsync(empleado.id)
    onCerrar()
  }

  return (
    <Modal
      titulo={enEdicion ? 'Modificar empleado' : empleado.nombre_completo}
      tituloVisible={enEdicion ? 'Modificar empleado' : 'Ficha de empleado'}
      ancho="amplio"
      abierto
      onCerrar={onCerrar}
    >
      <header className={styles.profileHero}>
        <AvatarEmpleado empleado={empleado} tamano="grande" />
        <div className={styles.profileIdentity}>
          <span className={empleado.activo ? 'status statusSuccess' : 'status statusNeutral'}>
            {empleado.activo ? 'Activo' : 'Inactivo'}
          </span>
          <p className={styles.profileName}>{empleado.nombre_completo}</p>
          <p className={styles.profileRole}>{posicion.titulo_posicion}</p>
          {asignacion && (
            <dl className={styles.profileFacts}>
              <div>
                <dt>Salario asignado</dt>
                <dd>{formatearMoneda(asignacion.salario_asignado)}</dd>
              </div>
              <div>
                <dt>En el puesto desde</dt>
                <dd>{formatearFecha(asignacion.fecha_inicio)}</dd>
              </div>
            </dl>
          )}
        </div>
      </header>

      <form className="form" onSubmit={pedirConfirmacion} noValidate>
        {GRUPOS_EMPLEADO.map((grupo) => (
          <section key={grupo.titulo} className={styles.dataSection}>
            <h3 className="subtitle">{grupo.titulo}</h3>
            {enEdicion ? (
              <div className="formGrid">
                {grupo.campos.map((campo) => (
                  <label key={campo.clave} className="field">
                    {campo.etiqueta}
                    <input
                      type={campo.tipo}
                      value={valores[campo.clave]}
                      onChange={(e) => setValores((v) => ({ ...v, [campo.clave]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <dl className="factGrid">
                {grupo.campos.map((campo) => (
                  <div key={campo.clave}>
                    <dt>{campo.etiqueta}</dt>
                    <dd>{empleado[campo.clave] || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}

        {enEdicion && (
          <section className={styles.dataSection}>
            <h3 className="subtitle">Fotografía</h3>
            <label className="field">
              Reemplazar fotografía
              <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
              <span className="fieldHint">
                {foto ? `Se guardará "${foto.name}".` : 'Si no eliges un archivo, se conserva la fotografía actual.'}
              </span>
            </label>
          </section>
        )}

        {error && <p className="errorMessage" role="alert">{error}</p>}

        <div className="formActions">
          {!enEdicion ? (
            <>
              {empleado.activo ? (
                <BotonPrimario type="button" variante="peligro" onClick={() => setConfirmarDesactivarAbierto(true)}>
                  Desactivar
                </BotonPrimario>
              ) : (
                <BotonPrimario type="button" onClick={confirmarReactivacion} disabled={reactivar.isPending}>
                  {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
                </BotonPrimario>
              )}
              <BotonPrimario type="button" onClick={() => setEnEdicion(true)}>Modificar</BotonPrimario>
            </>
          ) : (
            <>
              <BotonPrimario type="button" variante="secundario" onClick={() => setEnEdicion(false)}>
                Cancelar
              </BotonPrimario>
              <BotonPrimario type="submit">Guardar</BotonPrimario>
            </>
          )}
        </div>
      </form>

      <div className={styles.profilePanels}>
        <ContactosYDependientes empleadoId={empleado.id} />
        <SolicitarNomina empleadoId={empleado.id} />
      </div>

      <Modal titulo="¿Estás seguro?" abierto={confirmarGuardadoAbierto} onCerrar={() => setConfirmarGuardadoAbierto(false)}>
        <p className="confirmText">¿Confirmas que quieres guardar los cambios de este empleado?</p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setConfirmarGuardadoAbierto(false)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarGuardado} disabled={editar.isPending}>
            {editar.isPending ? 'Guardando…' : 'Confirmar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Desactivar empleado" abierto={confirmarDesactivarAbierto} onCerrar={() => setConfirmarDesactivarAbierto(false)}>
        <p className="confirmText">
          ¿Confirmas que quieres desactivar a "{empleado.nombre_completo}"? Si tiene una posición vigente, se
          cerrará con la fecha de hoy. Si tiene una cuenta de usuario vinculada, también perderá acceso al sistema
          de inmediato.
        </p>
        <label className="field">
          Motivo
          <select value={motivoDesactivacion} onChange={(e) => setMotivoDesactivacion(e.target.value as MotivoCambio)}>
            {MOTIVOS_DESACTIVACION.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </label>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setConfirmarDesactivarAbierto(false)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivacion} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>
    </Modal>
  )
}

// --- Solicitud de nómina ----------------------------------------------------
//
// El spec.md solo describe la notificación/aprobación en el dropdown del
// Header, pero sin un formulario de alta ese flujo nunca recibiría datos
// reales — se agrega aquí, dentro del detalle del empleado, ya que solo
// admin tiene acceso a esta entidad (igual que al resto de RRHH).

function SolicitarNomina({ empleadoId }: { empleadoId: number }) {
  const crear = useCrearSolicitudNomina()
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFin, setPeriodoFin] = useState('')
  const [monto, setMonto] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')

  async function enviarSolicitud() {
    setError('')
    setConfirmacion('')

    if (!periodoInicio || !periodoFin || !monto) {
      setError('Completa periodo de inicio, fin y monto.')
      return
    }

    try {
      await crear.mutateAsync({ empleado: empleadoId, periodo_inicio: periodoInicio, periodo_fin: periodoFin, monto })
      setPeriodoInicio('')
      setPeriodoFin('')
      setMonto('')
      setConfirmacion('Solicitud registrada — aparecerá como pendiente en las notificaciones del Header.')
    } catch (err) {
      setError(extraerMensajeError(err, ['periodo_fin', 'monto'], 'No se pudo registrar la solicitud. Intenta de nuevo.'))
    }
  }

  return (
    <div className={`${styles.infoPanel} ${styles.infoPanelWide}`}>
      <h3 className="subtitle">Nueva solicitud de nómina</h3>
      <div className={styles.payrollRow}>
        <label className="field">
          Periodo de inicio
          <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
        </label>
        <label className="field">
          Periodo de fin
          <input type="date" value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} />
        </label>
        <label className="field">
          Monto a pagar
          <input
            type="number" step="0.01" min="0" placeholder="Monto" value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </label>
        <BotonPrimario type="button" onClick={enviarSolicitud} disabled={crear.isPending}>
          {crear.isPending ? 'Enviando…' : 'Solicitar'}
        </BotonPrimario>
      </div>
      {error && <p className="errorMessage" role="alert">{error}</p>}
      {confirmacion && <p className="fieldHint">{confirmacion}</p>}
    </div>
  )
}

// --- Contactos de emergencia y dependientes ---------------------------------

function ContactosYDependientes({ empleadoId }: { empleadoId: number }) {
  const { data: contactos } = useContactosEmergencia(empleadoId)
  const crearContacto = useCrearContactoEmergencia()
  const eliminarContacto = useEliminarContactoEmergencia()

  const { data: dependientes } = useDependientes(empleadoId)
  const crearDependiente = useCrearDependiente()
  const eliminarDependiente = useEliminarDependiente()

  const [nuevoContacto, setNuevoContacto] = useState({ nombre_contacto: '', telefono: '', parentesco: '' })
  const [nuevoDependiente, setNuevoDependiente] = useState({ nombre_dependiente: '', parentesco: '' })

  async function agregarContacto() {
    if (!nuevoContacto.nombre_contacto.trim() || !nuevoContacto.telefono.trim()) return
    await crearContacto.mutateAsync({ empleado: empleadoId, ...nuevoContacto })
    setNuevoContacto({ nombre_contacto: '', telefono: '', parentesco: '' })
  }

  async function agregarDependiente() {
    if (!nuevoDependiente.nombre_dependiente.trim()) return
    await crearDependiente.mutateAsync({ empleado: empleadoId, ...nuevoDependiente })
    setNuevoDependiente({ nombre_dependiente: '', parentesco: '' })
  }

  return (
    <>
      <div className={styles.infoPanel}>
        <h3 className="subtitle">Contactos de emergencia</h3>
        {(contactos ?? []).length === 0 ? (
          <p className="emptyState">Sin contactos registrados.</p>
        ) : (
          <ul className={styles.infoList}>
            {(contactos ?? []).map((c) => (
              <li key={c.id}>
                <span className={styles.infoItemText}>
                  <span className={styles.infoItemName}>{c.nombre_contacto}</span>
                  <span className={styles.infoItemMeta}>
                    {c.telefono}
                    {c.parentesco && ` · ${c.parentesco}`}
                  </span>
                </span>
                <button type="button" className="dangerActionLink" onClick={() => eliminarContacto.mutate(c.id)}>
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.infoAddRow}>
          <input
            type="text" placeholder="Nombre" aria-label="Nombre del contacto" value={nuevoContacto.nombre_contacto}
            onChange={(e) => setNuevoContacto((v) => ({ ...v, nombre_contacto: e.target.value }))}
          />
          <input
            type="text" placeholder="Teléfono" aria-label="Teléfono del contacto" value={nuevoContacto.telefono}
            onChange={(e) => setNuevoContacto((v) => ({ ...v, telefono: e.target.value }))}
          />
          <input
            type="text" placeholder="Parentesco" aria-label="Parentesco del contacto" value={nuevoContacto.parentesco}
            onChange={(e) => setNuevoContacto((v) => ({ ...v, parentesco: e.target.value }))}
          />
          <BotonPrimario type="button" variante="secundario" onClick={agregarContacto} disabled={crearContacto.isPending}>
            Agregar
          </BotonPrimario>
        </div>
      </div>

      <div className={styles.infoPanel}>
        <h3 className="subtitle">Dependientes</h3>
        {(dependientes ?? []).length === 0 ? (
          <p className="emptyState">Sin dependientes registrados.</p>
        ) : (
          <ul className={styles.infoList}>
            {(dependientes ?? []).map((d) => (
              <li key={d.id}>
                <span className={styles.infoItemText}>
                  <span className={styles.infoItemName}>{d.nombre_dependiente}</span>
                  {d.parentesco && <span className={styles.infoItemMeta}>{d.parentesco}</span>}
                </span>
                <button type="button" className="dangerActionLink" onClick={() => eliminarDependiente.mutate(d.id)}>
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.infoAddRow}>
          <input
            type="text" placeholder="Nombre" aria-label="Nombre del dependiente" value={nuevoDependiente.nombre_dependiente}
            onChange={(e) => setNuevoDependiente((v) => ({ ...v, nombre_dependiente: e.target.value }))}
          />
          <input
            type="text" placeholder="Parentesco" aria-label="Parentesco del dependiente" value={nuevoDependiente.parentesco}
            onChange={(e) => setNuevoDependiente((v) => ({ ...v, parentesco: e.target.value }))}
          />
          <BotonPrimario type="button" variante="secundario" onClick={agregarDependiente} disabled={crearDependiente.isPending}>
            Agregar
          </BotonPrimario>
        </div>
      </div>
    </>
  )
}
