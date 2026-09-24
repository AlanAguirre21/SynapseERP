import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { CampoContrasena } from '../../components/common/CampoContrasena'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { generarPasswordAleatoria, type LimiteAccesos, type UsuarioCuenta } from '../../api/usuarios'
import { useEmpleado, useEmpleadosDisponibles } from '../../hooks/useEmpleadosRRHH'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import {
  useAccesosUsuario,
  useCrearUsuario,
  useDesactivarUsuario,
  useEditarUsuario,
  useReactivarUsuario,
  useUsuarios,
} from '../../hooks/useUsuarios'
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

function UsuariosContenido() {
  const { data: usuarios, isLoading } = useUsuarios()
  const crear = useCrearUsuario()
  const editar = useEditarUsuario()
  const desactivar = useDesactivarUsuario()
  const reactivar = useReactivarUsuario()
  const { data: empleadosDisponibles } = useEmpleadosDisponibles()

  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<UsuarioCuenta | null>(null)
  const [valores, setValores] = useState<ValoresFormulario>(FORMULARIO_VACIO)
  const [errorFormulario, setErrorFormulario] = useState('')
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

  function abrirCrear() {
    setEnEdicion(null)
    setValores(FORMULARIO_VACIO)
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
        })
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(
        extraerMensajeError(
          err, ['email', 'password', 'empleado', 'rol_usuario'],
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

  const usuariosVisibles = (usuarios ?? []).filter((u) => mostrarInactivos || u.activo)

  const columnas: ColumnaTabla<UsuarioCuenta>[] = [
    {
      clave: 'username',
      encabezado: 'Usuario',
      render: (fila) => (
        <button
          type="button"
          className={styles.enlaceExpandir}
          onClick={() => setExpandidos((actual) => alternarEnConjunto(actual, fila.id))}
          aria-expanded={expandidos.has(fila.id)}
        >
          <span className={styles.indicadorExpandir}>{expandidos.has(fila.id) ? '▾' : '▸'}</span>
          {fila.username}
        </button>
      ),
    },
    {
      clave: 'first_name',
      encabezado: 'Nombre',
      render: (fila) => `${fila.first_name} ${fila.last_name}`.trim() || '—',
    },
    { clave: 'email', encabezado: 'Correo' },
    {
      clave: 'rol_usuario',
      encabezado: 'Rol',
      render: (fila) => (fila.rol_usuario === 'admin' ? 'Administrador' : 'Operador'),
    },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Usuarios</h1>
        <div className={styles.accionesEncabezado}>
          <label className={styles.toggleInactivos}>
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            Mostrar inactivos
          </label>
          <BotonPrimario onClick={abrirCrear}>Nuevo usuario</BotonPrimario>
        </div>
      </div>

      {isLoading ? (
        <p>Cargando usuarios…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={usuariosVisibles}
          mensajeVacio="Todavía no hay usuarios registrados."
          renderAcciones={(fila) => (
            <div className={styles.acciones}>
              <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                Editar
              </button>
              {fila.activo ? (
                <button
                  type="button"
                  className={styles.enlaceAccionPeligro}
                  onClick={() => {
                    setErrorDesactivar('')
                    setADesactivar(fila)
                  }}
                >
                  Desactivar
                </button>
              ) : (
                <button type="button" className={styles.enlaceAccion} onClick={() => setAReactivar(fila)}>
                  Reactivar
                </button>
              )}
            </div>
          )}
        />
      )}

      {[...expandidos].map((id) => {
        const usuario = usuariosVisibles.find((u) => u.id === id)
        return usuario ? <AccesosDeUsuarioSeccion key={id} usuario={usuario} /> : null
      })}

      <Modal
        titulo={enEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre(s)
            <input
              type="text"
              value={valores.first_name}
              onChange={(e) => setValores((v) => ({ ...v, first_name: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Apellido(s)
            <input
              type="text"
              value={valores.last_name}
              onChange={(e) => setValores((v) => ({ ...v, last_name: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Correo electrónico
            <input
              type="email"
              value={valores.email}
              onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Rol
            <select
              value={valores.rol_usuario}
              onChange={(e) => setValores((v) => ({ ...v, rol_usuario: e.target.value as 'admin' | 'operador' }))}
            >
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <label className={styles.campo}>
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

          {!enEdicion && (
            <CampoContrasena
              etiqueta="Contraseña"
              valor={valores.password}
              onCambiar={(password) => setValores((v) => ({ ...v, password }))}
              required
              botonGenerar={{
                onClick: () => setValores((v) => ({ ...v, password: generarPasswordAleatoria() })),
              }}
            />
          )}

          {errorFormulario && (
            <p className={styles.error} role="alert">
              {errorFormulario}
            </p>
          )}

          <div className={styles.accionesFormulario}>
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
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{aDesactivar?.username}"? Perderá acceso al sistema de inmediato; su
          sesión actual (si tiene una activa) queda invalidada.
        </p>
        {errorDesactivar && (
          <p className={styles.error} role="alert">
            {errorDesactivar}
          </p>
        )}
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar usuario" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar a "{aReactivar?.username}"? Recuperará acceso al sistema.
        </p>
        <div className={styles.accionesFormulario}>
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

function AccesosDeUsuarioSeccion({ usuario }: { usuario: UsuarioCuenta }) {
  const [limite, setLimite] = useState<LimiteAccesos>('5')
  const { data: accesos, isLoading } = useAccesosUsuario(usuario.id, limite)

  return (
    <div className={styles.seccionExpandida}>
      <div className={styles.encabezadoExpandido}>
        <h3 className={styles.subtituloExpandido}>Historial de accesos de {usuario.username}</h3>
        <div className={styles.selectorLimite} role="group" aria-label="Cantidad de accesos a mostrar">
          {(['5', '10', 'todos'] as LimiteAccesos[]).map((valor) => (
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
      </div>

      {isLoading ? (
        <p>Cargando accesos…</p>
      ) : !accesos || accesos.length === 0 ? (
        <p className={styles.vacio}>Este usuario todavía no tiene accesos registrados.</p>
      ) : (
        <ul className={styles.listaExpandida}>
          {accesos.map((registro) => (
            <li key={registro.id}>
              <span>{ETIQUETAS_TIPO_ACCESO[registro.tipo] ?? registro.tipo}</span>
              <span>{new Date(registro.creado_en).toLocaleString('es-MX')}</span>
              <span>{registro.ip ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
