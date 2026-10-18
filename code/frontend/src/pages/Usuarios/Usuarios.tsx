import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Avatar } from '../../components/common/Avatar'
import { CampoContrasena } from '../../components/common/CampoContrasena'
import { Modal } from '../../components/common/Modal'
import { SelectorFotoPerfil } from '../../components/common/SelectorFotoPerfil'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import {
  DESCRIPCIONES_ROL,
  ETIQUETAS_ROL,
  generarPasswordAleatoria,
  type CambioFoto,
  type LimiteAccesos,
  type RegistroAcceso,
  type UsuarioCuenta,
} from '../../api/usuarios'
import { useEmpleado, useEmpleadosDisponibles, useEmpleadosRRHH } from '../../hooks/useEmpleadosRRHH'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import {
  useAccesosUsuario,
  useCrearUsuario,
  useDesactivarUsuario,
  useEditarUsuario,
  useReactivarUsuario,
  useUsuarios,
} from '../../hooks/useUsuarios'
import { normalizarBusqueda } from '../../utils/texto'
import styles from './Usuarios.module.css'

interface ValoresFormulario {
  first_name: string
  last_name: string
  email: string
  rol_usuario: 'admin' | 'operador'
  empleado: number | null
  password: string
}

const FORMULARIO_VACIO: ValoresFormulario = {
  first_name: '', last_name: '', email: '', rol_usuario: 'operador', empleado: null, password: '',
}

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

const ETIQUETAS_TIPO_ACCESO: Record<string, string> = {
  exitoso: 'Inicio de sesión exitoso',
  cierre_sesion: 'Cierre de sesión',
  fallido: 'Intento fallido',
}

const CLASES_TIPO_ACCESO: Record<string, string> = {
  exitoso: 'status statusSuccess',
  cierre_sesion: 'status statusNeutral',
  fallido: 'status statusError',
}

function nombreCompleto(usuario: UsuarioCuenta): string {
  return `${usuario.first_name} ${usuario.last_name}`.trim()
}

function alternarEnConjunto(conjunto: Set<number>, id: number): Set<number> {
  const nuevo = new Set(conjunto)
  if (nuevo.has(id)) nuevo.delete(id)
  else nuevo.add(id)
  return nuevo
}

export function Usuarios() {
  const { data: usuarioActual, isLoading: usuarioActualCargando } = useUsuarioActual()

  // Usuarios es exclusiva de admin: la barra lateral ya oculta el enlace
  // para operador, esto bloquea también el acceso directo por URL — el
  // backend rechaza los endpoints igual (ver `EsAdmin`), esto es solo para
  // no mostrar la pantalla ni de forma transitoria (mismo patrón que Caja).
  if (usuarioActualCargando) {
    return <p>Cargando…</p>
  }

  if (usuarioActual?.rol !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <UsuariosContenido />
}

type FiltroRol = '' | UsuarioCuenta['rol_usuario']

function UsuariosContenido() {
  const { data: usuarios, isLoading } = useUsuarios()
  const crear = useCrearUsuario()
  const editar = useEditarUsuario()
  const desactivar = useDesactivarUsuario()
  const reactivar = useReactivarUsuario()
  const { data: empleadosDisponibles } = useEmpleadosDisponibles()
  const { data: empleados } = useEmpleadosRRHH()

  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState<FiltroRol>('')
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<UsuarioCuenta | null>(null)
  const [valores, setValores] = useState<ValoresFormulario>(FORMULARIO_VACIO)
  const [errorFormulario, setErrorFormulario] = useState('')
  // Fotografía: `undefined` sin cambio, archivo nuevo o `null` para quitarla.
  const [cambioFoto, setCambioFoto] = useState<CambioFoto | undefined>(undefined)
  const [aDesactivar, setADesactivar] = useState<UsuarioCuenta | null>(null)
  const [errorDesactivar, setErrorDesactivar] = useState('')
  const [aReactivar, setAReactivar] = useState<UsuarioCuenta | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

  const { data: empleadoVinculado } = useEmpleado(enEdicion?.empleado ?? null)

  const opcionesEmpleado = (() => {
    const lista = [...(empleadosDisponibles ?? [])]
    if (empleadoVinculado && !lista.some((e) => e.id === empleadoVinculado.id)) {
      lista.push(empleadoVinculado)
    }
    return lista.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
  })()

  const resumen = useMemo(() => {
    const lista = usuarios ?? []
    const activos = lista.filter((u) => u.activo)
    return {
      activos: activos.length,
      administradores: activos.filter((u) => u.rol_usuario === 'admin').length,
      operadores: activos.filter((u) => u.rol_usuario === 'operador').length,
      inactivos: lista.length - activos.length,
    }
  }, [usuarios])

  function abrirCrear() {
    setEnEdicion(null)
    setValores(FORMULARIO_VACIO)
    setCambioFoto(undefined)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(usuario: UsuarioCuenta) {
    setEnEdicion(usuario)
    setValores({
      first_name: usuario.first_name,
      last_name: usuario.last_name,
      email: usuario.email,
      rol_usuario: usuario.rol_usuario,
      empleado: usuario.empleado,
      password: '',
    })
    setCambioFoto(undefined)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.email.trim()) {
      setErrorFormulario('Ingresa el correo del usuario.')
      return
    }
    if (!enEdicion && !valores.password) {
      setErrorFormulario('Ingresa una contraseña, o usa "Generar" para crear una.')
      return
    }

    // Sin cambio de fotografía, las peticiones son las mismas de siempre.
    const foto = cambioFoto === undefined ? {} : { foto_usuario: cambioFoto }

    try {
      if (enEdicion) {
        await editar.mutateAsync({
          id: enEdicion.id,
          datos: {
            first_name: valores.first_name,
            last_name: valores.last_name,
            email: valores.email,
            rol_usuario: valores.rol_usuario,
            empleado: valores.empleado,
            ...foto,
          },
        })
      } else {
        await crear.mutateAsync({
          first_name: valores.first_name,
          last_name: valores.last_name,
          email: valores.email,
          rol_usuario: valores.rol_usuario,
          empleado: valores.empleado,
          password: valores.password,
          ...foto,
        })
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(
        extraerMensajeError(
          err, ['email', 'password', 'empleado', 'rol_usuario', 'foto_usuario'],
          'No se pudo guardar el usuario. Intenta de nuevo.',
        ),
      )
    }
  }

  async function confirmarDesactivar() {
    if (!aDesactivar) return
    setErrorDesactivar('')
    try {
      await desactivar.mutateAsync(aDesactivar.id)
      setADesactivar(null)
    } catch (err) {
      setErrorDesactivar(extraerMensajeError(err, [], 'No se pudo desactivar el usuario.'))
    }
  }

  async function confirmarReactivar() {
    if (!aReactivar) return
    await reactivar.mutateAsync(aReactivar.id)
    setAReactivar(null)
  }

  // "Mostrar inactivos" es una preferencia de vista (por defecto ocultos,
  // según `010`); la búsqueda y el rol son los filtros que se limpian.
  const termino = normalizarBusqueda(busqueda)
  const lista = usuarios ?? []
  const usuariosVisibles = lista.filter(
    (u) =>
      (mostrarInactivos || u.activo) &&
      (!rolFiltro || u.rol_usuario === rolFiltro) &&
      (!termino || [nombreCompleto(u), u.username, u.email].some((t) => normalizarBusqueda(t).includes(termino))),
  )
  const hayFiltros = Boolean(busqueda.trim() || rolFiltro)

  function limpiarFiltros() {
    setBusqueda('')
    setRolFiltro('')
  }

  function nombreEmpleado(id: number | null): string {
    if (id === null) return 'Sin vincular'
    return empleados?.find((e) => e.id === id)?.nombre_completo ?? '…'
  }

  const columnas: ColumnaTabla<UsuarioCuenta>[] = [
    {
      clave: 'username',
      encabezado: 'Usuario',
      render: (fila) => {
        const nombre = nombreCompleto(fila)
        return (
          <div className={styles.identity}>
            <Avatar nombre={nombre || fila.username} foto={fila.foto_usuario} />
            <span className={styles.identityText}>
              {/* El botón lleva solo el nombre: el nombre de usuario va aparte. */}
              <button
                type="button"
                className="expandLink"
                onClick={() => setExpandidos((actual) => alternarEnConjunto(actual, fila.id))}
                aria-expanded={expandidos.has(fila.id)}
              >
                <span className="expandIndicator">{expandidos.has(fila.id) ? '▾' : '▸'}</span>
                {nombre || fila.username}
              </button>
              <span className={styles.identitySecondary}>
                <span>{fila.username}</span>
                {fila.email && fila.email !== fila.username && <> · {fila.email}</>}
              </span>
            </span>
          </div>
        )
      },
    },
    {
      clave: 'rol_usuario',
      encabezado: 'Rol',
      render: (fila) => (
        <span className={fila.rol_usuario === 'admin' ? 'status statusPrimary' : 'status statusNeutral'}>
          {ETIQUETAS_ROL[fila.rol_usuario]}
        </span>
      ),
    },
    { clave: 'empleado', encabezado: 'Empleado', render: (fila) => nombreEmpleado(fila.empleado) },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  const cifra = (valor: number) => (usuarios ? valor : '…')

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Usuarios</h1>
          <p className="pageHint">Cuentas de acceso al sistema, su rol y su vínculo con la plantilla de RRHH.</p>
        </div>
        <BotonPrimario onClick={abrirCrear}>Nuevo usuario</BotonPrimario>
      </div>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Usuarios activos</span>
          <span className="statValue">{cifra(resumen.activos)}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Administradores</span>
          <span className="statValue">{cifra(resumen.administradores)}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Operadores</span>
          <span className="statValue">{cifra(resumen.operadores)}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Inactivos</span>
          <span className="statValue">{cifra(resumen.inactivos)}</span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
          Buscar
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, usuario o correo"
          />
        </label>

        <label className="filterField">
          Rol
          <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value as FiltroRol)}>
            <option value="">Todos</option>
            <option value="admin">Administrador</option>
            <option value="operador">Operador</option>
          </select>
        </label>

        <label className="fieldCheckbox">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
          Mostrar inactivos
        </label>

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Cargando usuarios…</p>
      ) : (
        <>
          <span className="pageHint">{`Mostrando ${usuariosVisibles.length} de ${lista.length}`}</span>
          <Tabla
            columnas={columnas}
            datos={usuariosVisibles}
            mensajeVacio={
              hayFiltros ? 'Ningún usuario coincide con los filtros.' : 'Todavía no hay usuarios registrados.'
            }
            renderAcciones={(fila) => (
              <div className="rowActions">
                <button type="button" className="actionLink" onClick={() => abrirEditar(fila)}>
                  Editar
                </button>
                {fila.activo ? (
                  <button
                    type="button"
                    className="dangerActionLink"
                    onClick={() => {
                      setErrorDesactivar('')
                      setADesactivar(fila)
                    }}
                  >
                    Desactivar
                  </button>
                ) : (
                  <button type="button" className="actionLink" onClick={() => setAReactivar(fila)}>
                    Reactivar
                  </button>
                )}
              </div>
            )}
            renderExpandido={(fila) => (expandidos.has(fila.id) ? <AccesosDeUsuarioSeccion usuario={fila} /> : null)}
          />
        </>
      )}

      <Modal
        titulo={enEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        ancho="amplio"
      >
        <form className="form" onSubmit={alGuardar} noValidate>
          <h3 className="subtitle">Fotografía</h3>
          <SelectorFotoPerfil
            nombre={`${valores.first_name} ${valores.last_name}`.trim() || valores.email}
            fotoGuardada={enEdicion?.foto_usuario ?? null}
            cambio={cambioFoto}
            onCambiar={setCambioFoto}
          >
            <span className="fieldHint">JPG, PNG o WebP, hasta 2 MB. Opcional.</span>
          </SelectorFotoPerfil>

          <h3 className="subtitle">Datos personales</h3>
          <div className="formGrid">
            <label className="field">
              Nombre(s)
              <input
                type="text"
                value={valores.first_name}
                onChange={(e) => setValores((v) => ({ ...v, first_name: e.target.value }))}
              />
            </label>

            <label className="field">
              Apellido(s)
              <input
                type="text"
                value={valores.last_name}
                onChange={(e) => setValores((v) => ({ ...v, last_name: e.target.value }))}
              />
            </label>
          </div>

          <h3 className="subtitle">Acceso</h3>
          <div className="formGrid">
            <label className="field">
              Correo electrónico
              <input
                type="email"
                value={valores.email}
                onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
                required
              />
            </label>

            {/* La descripción va fuera de la etiqueta, enlazada como ayuda,
                para que el nombre accesible del campo siga siendo "Rol". */}
            <div className="field">
              <label htmlFor="usuario-rol">Rol</label>
              <select
                id="usuario-rol"
                value={valores.rol_usuario}
                onChange={(e) => setValores((v) => ({ ...v, rol_usuario: e.target.value as 'admin' | 'operador' }))}
                aria-describedby="usuario-rol-descripcion"
              >
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
              <span id="usuario-rol-descripcion" className="fieldHint">
                {DESCRIPCIONES_ROL[valores.rol_usuario]}
              </span>
            </div>

            {!enEdicion && (
              <div className="formGridFull">
                <CampoContrasena
                  etiqueta="Contraseña"
                  valor={valores.password}
                  onCambiar={(password) => setValores((v) => ({ ...v, password }))}
                  required
                  botonGenerar={{
                    onClick: () => setValores((v) => ({ ...v, password: generarPasswordAleatoria() })),
                  }}
                />
              </div>
            )}
          </div>

          <h3 className="subtitle">Vínculo con RRHH</h3>
          <div className="formGrid">
            <label className="field">
              Empleado vinculado (opcional)
              <select
                value={valores.empleado ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, empleado: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Sin vincular</option>
                {opcionesEmpleado.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre_completo}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {errorFormulario && (
            <p className="errorMessage" role="alert">
              {errorFormulario}
            </p>
          )}

          <div className="formActions">
            <BotonPrimario type="button" variante="secundario" onClick={() => setFormularioAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
              {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>

      <Modal titulo="Desactivar usuario" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres desactivar a "{aDesactivar?.username}"? Perderá acceso al sistema de inmediato; su
          sesión actual (si tiene una activa) queda invalidada.
        </p>
        {errorDesactivar && (
          <p className="errorMessage" role="alert">
            {errorDesactivar}
          </p>
        )}
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar usuario" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres reactivar a "{aReactivar?.username}"? Recuperará acceso al sistema.
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setAReactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarReactivar} disabled={reactivar.isPending}>
            {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
          </BotonPrimario>
        </div>
      </Modal>
    </div>
  )
}

function formatearFechaAcceso(fecha: string): string {
  return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

function AccesosDeUsuarioSeccion({ usuario }: { usuario: UsuarioCuenta }) {
  const [limite, setLimite] = useState<LimiteAccesos>('5')
  const { data: accesos, isLoading } = useAccesosUsuario(usuario.id, limite)

  // Resumen de los accesos cargados (5, 10 o todos), no de todo el historial.
  const lista = accesos ?? []
  const ultimoExitoso = lista
    .filter((a) => a.tipo === 'exitoso')
    .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0]
  const fallidos = lista.filter((a) => a.tipo === 'fallido').length

  const columnas: ColumnaTabla<RegistroAcceso>[] = [
    {
      clave: 'tipo',
      encabezado: 'Tipo',
      render: (fila) => (
        <span className={CLASES_TIPO_ACCESO[fila.tipo] ?? 'status statusNeutral'}>
          {ETIQUETAS_TIPO_ACCESO[fila.tipo] ?? fila.tipo}
        </span>
      ),
    },
    {
      clave: 'creado_en',
      encabezado: 'Fecha',
      render: (fila) => <span className="cellNoWrap">{formatearFechaAcceso(fila.creado_en)}</span>,
    },
    { clave: 'ip', encabezado: 'IP', render: (fila) => fila.ip ?? '—' },
  ]

  return (
    <div className="expandedSection">
      <div className="sectionHeader">
        <h3 className="subtitle">Historial de accesos de {usuario.username}</h3>
        <div className="segmented" role="group" aria-label="Cantidad de accesos a mostrar">
          {(['5', '10', 'todos'] as LimiteAccesos[]).map((valor) => (
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
      </div>

      {isLoading ? (
        <p>Cargando accesos…</p>
      ) : lista.length === 0 ? (
        <p className="emptyState">Este usuario todavía no tiene accesos registrados.</p>
      ) : (
        <>
          <dl className="factGrid">
            <div>
              <dt>Último inicio de sesión (en los accesos mostrados)</dt>
              <dd>{ultimoExitoso ? formatearFechaAcceso(ultimoExitoso.creado_en) : '—'}</dd>
            </div>
            <div>
              <dt>Intentos fallidos (en los accesos mostrados)</dt>
              <dd>{fallidos}</dd>
            </div>
          </dl>
          <Tabla columnas={columnas} datos={lista} />
        </>
      )}
    </div>
  )
}
