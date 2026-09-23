import { Fragment, useState, type FormEvent } from 'react'

import type { Departamento, Empleado, MotivoCambio, Posicion } from '../../api/rrhh'
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
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>Recursos Humanos</h1>

      {isLoading ? (
        <p>Cargando departamentos…</p>
      ) : departamentos && departamentos.length > 0 ? (
        <>
          {/* Pestañas de departamento y sus acciones (editar/desactivar el
              seleccionado, agregar uno nuevo) comparten la misma fila y el
              mismo estilo de enlace — no hay una acción "primaria" aquí que
              deba destacar más que las otras. */}
          <div className={styles.barraDepartamentos}>
            <div className={styles.pestañas} role="tablist">
              {departamentos.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={idSeleccionado === d.id}
                  className={idSeleccionado === d.id ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
                  onClick={() => setDepartamentoId(d.id)}
                >
                  {d.nombre_departamento}
                  {!d.activo && ' (inactivo)'}
                </button>
              ))}
            </div>

            <div className={styles.accionesDepartamento}>
              {departamentoSeleccionado && (
                <>
                  <button
                    type="button"
                    className={styles.enlaceAccion}
                    onClick={() => setFormularioDepto(departamentoSeleccionado)}
                  >
                    Editar departamento
                  </button>
                  <button
                    type="button"
                    className={departamentoSeleccionado.activo ? styles.enlaceAccionPeligro : styles.enlaceAccion}
                    onClick={() => setConfirmarDeptoAbierto(true)}
                  >
                    {departamentoSeleccionado.activo ? 'Desactivar departamento' : 'Reactivar departamento'}
                  </button>
                </>
              )}
              <button type="button" className={styles.enlaceAccion} onClick={() => setFormularioDepto('nuevo')}>
                Agregar departamento
              </button>
            </div>
          </div>

          {departamentoSeleccionado && (
            <PanelDepartamento departamento={departamentoSeleccionado} empleados={empleados ?? []} />
          )}
        </>
      ) : (
        <p className={styles.vacio}>Todavía no hay departamentos registrados.</p>
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
          <p className={styles.textoConfirmacion}>
            ¿Confirmas que quieres {departamentoSeleccionado.activo ? 'desactivar' : 'reactivar'} "
            {departamentoSeleccionado.nombre_departamento}"?
          </p>
          <div className={styles.accionesFormulario}>
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
      <form className={styles.formulario} onSubmit={alGuardar} noValidate>
        <label className={styles.campo}>
          Nombre del departamento
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.accionesFormulario}>
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
    <div className={styles.panel}>
      <div className={styles.encabezado}>
        <h2 className={styles.subtitulo}>Posiciones de {departamento.nombre_departamento}</h2>
        <BotonPrimario onClick={() => setFormularioPosicion('nueva')}>Agregar posición</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando posiciones…</p>
      ) : jerarquia.length === 0 ? (
        <p className={styles.vacio}>Este departamento todavía no tiene posiciones.</p>
      ) : (
        <table className={styles.tablaPosiciones}>
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
                    className={styles.filaPosicion}
                    onClick={() => setPosicionExpandidaId(expandida ? null : posicion.id)}
                    aria-expanded={expandida}
                  >
                    <td className={esRaiz ? styles.celdaPosicionRaiz : undefined}>
                      <span
                        className={styles.tituloPosicion}
                        style={{ paddingLeft: `${profundidad * 24}px` }}
                      >
                        <span className={styles.indicadorExpandir}>{expandida ? '▾' : '▸'}</span>
                        {!esRaiz && <span className={styles.conectorArbol}>└</span>}
                        <span className={esRaiz ? styles.nombrePosicionRaiz : styles.nombrePosicionHija}>
                          {posicion.titulo_posicion}
                        </span>
                      </span>
                    </td>
                    <td className={styles.celdaSalario}>
                      {formatearMoneda(posicion.salario_minimo)} – {formatearMoneda(posicion.salario_maximo)}
                    </td>
                    <td>
                      <span className={posicion.activo ? styles.estadoActivo : styles.estadoInactivo}>
                        {posicion.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.accionesFila} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className={styles.enlaceAccion} onClick={() => setFormularioPosicion(posicion)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={posicion.activo ? styles.enlaceAccionPeligro : styles.enlaceAccion}
                          onClick={() => setPosicionAConfirmar(posicion)}
                        >
                          {posicion.activo ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandida && (
                    <tr>
                      <td colSpan={4} className={styles.celdaExpandida}>
                        <PanelEmpleadosPorPosicion posicion={posicion} empleados={empleados} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
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
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres {posicionAConfirmar?.activo ? 'desactivar' : 'reactivar'} "
          {posicionAConfirmar?.titulo_posicion}"?
        </p>
        <div className={styles.accionesFormulario}>
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
      <form className={styles.formulario} onSubmit={alGuardar} noValidate>
        <label className={styles.campo}>
          Título de la posición
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </label>

        <label className={styles.campo}>
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

        <label className={styles.campo}>
          Salario mínimo
          <input type="number" step="0.01" min="0" value={salarioMinimo} onChange={(e) => setSalarioMinimo(e.target.value)} />
        </label>

        <label className={styles.campo}>
          Salario máximo
          <input type="number" step="0.01" min="0" value={salarioMaximo} onChange={(e) => setSalarioMaximo(e.target.value)} />
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.accionesFormulario}>
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
    <div className={styles.panelEmpleados}>
      <div className={styles.encabezadoEmpleados}>
        <div className={styles.selectorLimite} role="group" aria-label="Cantidad de empleados a mostrar">
          {(['5', '10', 'todos'] as LimiteLista[]).map((valor) => (
            <button
              key={valor}
              type="button"
              className={limite === valor ? `${styles.botonLimite} ${styles.botonLimiteActivo}` : styles.botonLimite}
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
        <p className={styles.vacio}>Nadie desempeña esta posición actualmente.</p>
      ) : (
        <ul className={styles.listaEmpleados}>
          {listaRecortada.map((asignacion) => {
            const empleado = empleadoDe(asignacion.empleado)
            return (
              <li key={asignacion.id}>
                <button
                  type="button"
                  className={styles.itemEmpleado}
                  onClick={() => empleado && setEmpleadoSeleccionadoId(empleado.id)}
                >
                  <span>{empleado?.nombre_completo ?? `Empleado #${asignacion.empleado}`}</span>
                  <span className={styles.itemEmpleadoPosicion}>{posicion.titulo_posicion}</span>
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
        <ModalDetalleEmpleado empleado={empleadoSeleccionado} onCerrar={() => setEmpleadoSeleccionadoId(null)} />
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
    <Modal titulo={`Nuevo empleado — ${posicion.titulo_posicion}`} abierto={abierto} onCerrar={onCerrar}>
      <form className={styles.formulario} onSubmit={alGuardar} noValidate>
        <label className={styles.campo}>
          Nombre completo
          <input
            type="text" value={datos.nombre_completo}
            onChange={(e) => setDatos((v) => ({ ...v, nombre_completo: e.target.value }))}
            required
          />
        </label>

        <label className={styles.campo}>
          Fotografía (opcional)
          <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>

        <label className={styles.campo}>
          CURP
          <input
            type="text" value={datos.curp}
            onChange={(e) => setDatos((v) => ({ ...v, curp: e.target.value }))}
          />
        </label>

        <label className={styles.campo}>
          RFC
          <input
            type="text" value={datos.rfc}
            onChange={(e) => setDatos((v) => ({ ...v, rfc: e.target.value }))}
          />
        </label>

        <label className={styles.campo}>
          NSS
          <input
            type="text" value={datos.nss}
            onChange={(e) => setDatos((v) => ({ ...v, nss: e.target.value }))}
          />
        </label>

        <label className={styles.campo}>
          Teléfono
          <input
            type="text" value={datos.telefono}
            onChange={(e) => setDatos((v) => ({ ...v, telefono: e.target.value }))}
          />
        </label>

        <label className={styles.campo}>
          Correo
          <input
            type="email" value={datos.email}
            onChange={(e) => setDatos((v) => ({ ...v, email: e.target.value }))}
          />
        </label>

        <label className={styles.campo}>
          Cuenta bancaria
          <input
            type="text" value={datos.cuenta_bancaria}
            onChange={(e) => setDatos((v) => ({ ...v, cuenta_bancaria: e.target.value }))}
          />
        </label>

        <label className={styles.campo}>
          Salario asignado
          <input
            type="number" step="0.01" min="0" value={salarioAsignado}
            onChange={(e) => setSalarioAsignado(e.target.value)}
          />
          <span className={styles.ayuda}>
            Rango de la posición: {posicion.salario_minimo} – {posicion.salario_maximo}
          </span>
        </label>

        <label className={styles.campo}>
          Fecha de inicio
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.accionesFormulario}>
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

function ModalDetalleEmpleado({ empleado, onCerrar }: { empleado: Empleado; onCerrar: () => void }) {
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
    <Modal titulo={enEdicion ? 'Modificar empleado' : empleado.nombre_completo} abierto onCerrar={onCerrar}>
      <form className={styles.formulario} onSubmit={pedirConfirmacion} noValidate>
        <label className={styles.campo}>
          Fotografía
          {empleado.fotografia && !foto && (
            <img src={empleado.fotografia} alt={`Fotografía de ${empleado.nombre_completo}`} className={styles.fotoEmpleado} />
          )}
          {enEdicion && (
            <input
              type="file" accept="image/*"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          )}
        </label>
        <label className={styles.campo}>
          Nombre completo
          <input
            type="text" value={valores.nombre_completo} disabled={!enEdicion}
            onChange={(e) => setValores((v) => ({ ...v, nombre_completo: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          CURP
          <input
            type="text" value={valores.curp} disabled={!enEdicion}
            onChange={(e) => setValores((v) => ({ ...v, curp: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          RFC
          <input
            type="text" value={valores.rfc} disabled={!enEdicion}
            onChange={(e) => setValores((v) => ({ ...v, rfc: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          NSS
          <input
            type="text" value={valores.nss} disabled={!enEdicion}
            onChange={(e) => setValores((v) => ({ ...v, nss: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          Teléfono
          <input
            type="text" value={valores.telefono} disabled={!enEdicion}
            onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          Correo
          <input
            type="email" value={valores.email} disabled={!enEdicion}
            onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          Cuenta bancaria
          <input
            type="text" value={valores.cuenta_bancaria} disabled={!enEdicion}
            onChange={(e) => setValores((v) => ({ ...v, cuenta_bancaria: e.target.value }))}
          />
        </label>

        <span className={empleado.activo ? styles.estadoActivo : styles.estadoInactivo}>
          {empleado.activo ? 'Activo' : 'Inactivo'}
        </span>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.accionesFormulario}>
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

      <ContactosYDependientes empleadoId={empleado.id} />
      <SolicitarNomina empleadoId={empleado.id} />

      <Modal titulo="¿Estás seguro?" abierto={confirmarGuardadoAbierto} onCerrar={() => setConfirmarGuardadoAbierto(false)}>
        <p className={styles.textoConfirmacion}>¿Confirmas que quieres guardar los cambios de este empleado?</p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setConfirmarGuardadoAbierto(false)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarGuardado} disabled={editar.isPending}>
            {editar.isPending ? 'Guardando…' : 'Confirmar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Desactivar empleado" abierto={confirmarDesactivarAbierto} onCerrar={() => setConfirmarDesactivarAbierto(false)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{empleado.nombre_completo}"? Si tiene una posición vigente, se
          cerrará con la fecha de hoy. Si tiene una cuenta de usuario vinculada, también perderá acceso al sistema
          de inmediato.
        </p>
        <label className={styles.campo}>
          Motivo
          <select value={motivoDesactivacion} onChange={(e) => setMotivoDesactivacion(e.target.value as MotivoCambio)}>
            {MOTIVOS_DESACTIVACION.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </label>
        <div className={styles.accionesFormulario}>
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
    <div className={styles.seccionAnexos}>
      <h3 className={styles.subtituloAnexo}>Nueva solicitud de nómina</h3>
      <div className={styles.filaAgregarAnexo}>
        <input
          type="date" aria-label="Periodo de inicio" value={periodoInicio}
          onChange={(e) => setPeriodoInicio(e.target.value)}
        />
        <input
          type="date" aria-label="Periodo de fin" value={periodoFin}
          onChange={(e) => setPeriodoFin(e.target.value)}
        />
        <input
          type="number" step="0.01" min="0" placeholder="Monto" value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <BotonPrimario type="button" onClick={enviarSolicitud} disabled={crear.isPending}>
          {crear.isPending ? 'Enviando…' : 'Solicitar'}
        </BotonPrimario>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {confirmacion && <p className={styles.ayuda}>{confirmacion}</p>}
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
    <div className={styles.seccionAnexos}>
      <div>
        <h3 className={styles.subtituloAnexo}>Contactos de emergencia</h3>
        <ul className={styles.listaAnexo}>
          {(contactos ?? []).map((c) => (
            <li key={c.id}>
              <span>{c.nombre_contacto} — {c.telefono} ({c.parentesco})</span>
              <button type="button" className={styles.enlaceAccionPeligro} onClick={() => eliminarContacto.mutate(c.id)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.filaAgregarAnexo}>
          <input
            type="text" placeholder="Nombre" value={nuevoContacto.nombre_contacto}
            onChange={(e) => setNuevoContacto((v) => ({ ...v, nombre_contacto: e.target.value }))}
          />
          <input
            type="text" placeholder="Teléfono" value={nuevoContacto.telefono}
            onChange={(e) => setNuevoContacto((v) => ({ ...v, telefono: e.target.value }))}
          />
          <input
            type="text" placeholder="Parentesco" value={nuevoContacto.parentesco}
            onChange={(e) => setNuevoContacto((v) => ({ ...v, parentesco: e.target.value }))}
          />
          <BotonPrimario type="button" onClick={agregarContacto} disabled={crearContacto.isPending}>
            Agregar
          </BotonPrimario>
        </div>
      </div>

      <div>
        <h3 className={styles.subtituloAnexo}>Dependientes</h3>
        <ul className={styles.listaAnexo}>
          {(dependientes ?? []).map((d) => (
            <li key={d.id}>
              <span>{d.nombre_dependiente} ({d.parentesco})</span>
              <button type="button" className={styles.enlaceAccionPeligro} onClick={() => eliminarDependiente.mutate(d.id)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.filaAgregarAnexo}>
          <input
            type="text" placeholder="Nombre" value={nuevoDependiente.nombre_dependiente}
            onChange={(e) => setNuevoDependiente((v) => ({ ...v, nombre_dependiente: e.target.value }))}
          />
          <input
            type="text" placeholder="Parentesco" value={nuevoDependiente.parentesco}
            onChange={(e) => setNuevoDependiente((v) => ({ ...v, parentesco: e.target.value }))}
          />
          <BotonPrimario type="button" onClick={agregarDependiente} disabled={crearDependiente.isPending}>
            Agregar
          </BotonPrimario>
        </div>
      </div>
    </div>
  )
}
