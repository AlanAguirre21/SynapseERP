import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import type { InformacionUsuarioFormulario } from '../../api/usuarios'
import { useActualizarMiInformacion, useUsuarioActual } from '../../hooks/useUsuarioActual'
import styles from './InformacionUsuario.module.css'

interface ErrorGuardarInformacion {
  detail?: string
  username?: string[]
  email?: string[]
  first_name?: string[]
  last_name?: string[]
  rol_usuario?: string[]
}

function extraerMensajeError(err: unknown): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: ErrorGuardarInformacion } }).response?.data
      : undefined
  return (
    datos?.detail ??
    datos?.username?.[0] ??
    datos?.email?.[0] ??
    datos?.first_name?.[0] ??
    datos?.last_name?.[0] ??
    datos?.rol_usuario?.[0] ??
    'No se pudo guardar la información. Intenta de nuevo.'
  )
}

export function InformacionUsuario() {
  const { data: usuario, isLoading } = useUsuarioActual()
  const actualizar = useActualizarMiInformacion()

  const [valores, setValores] = useState<InformacionUsuarioFormulario>({
    username: '', email: '', first_name: '', last_name: '',
  })
  const [usuarioIdCargado, setUsuarioIdCargado] = useState<number | null>(null)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirmacion, setErrorConfirmacion] = useState('')
  const [exito, setExito] = useState(false)

  const esAdmin = usuario?.rol === 'admin'

  // Precarga el formulario una sola vez, cuando `usuario` llega por primera
  // vez — ajustar estado durante el render (en vez de en un `useEffect`)
  // evita el render extra que produciría un efecto, y sigue sin pisar
  // ediciones en curso ante un refetch posterior en segundo plano.
  if (usuario && usuario.id !== usuarioIdCargado) {
    setUsuarioIdCargado(usuario.id)
    setValores({
      username: usuario.username,
      email: usuario.email,
      first_name: usuario.first_name,
      last_name: usuario.last_name,
      ...(usuario.rol === 'admin' ? { rol_usuario: usuario.rol } : {}),
    })
  }

  function actualizarCampo(campo: keyof InformacionUsuarioFormulario, valor: string) {
    setExito(false)
    setValores((v) => ({ ...v, [campo]: valor }))
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.username.trim() || !valores.email.trim() || !valores.first_name.trim() || !valores.last_name.trim()) {
      setErrorFormulario('Completa nombre de usuario, correo electrónico, nombre(s) y apellidos.')
      return
    }

    setErrorConfirmacion('')
    setConfirmando(true)
  }

  function cancelarConfirmacion() {
    setConfirmando(false)
  }

  async function confirmarGuardar() {
    setErrorConfirmacion('')
    try {
      await actualizar.mutateAsync(valores)
      setConfirmando(false)
      setExito(true)
    } catch (err) {
      setErrorConfirmacion(extraerMensajeError(err))
    }
  }

  const rolTexto = usuario?.rol === 'admin' ? 'Administrador' : 'Operador'

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>Información de Usuario</h1>

      {isLoading ? (
        <p>Cargando información…</p>
      ) : (
        <form className={styles.formulario} onSubmit={alEnviar} noValidate>
          <label className={styles.campo}>
            Nombre de usuario
            <input
              type="text"
              value={valores.username}
              onChange={(evento) => actualizarCampo('username', evento.target.value)}
              required
            />
          </label>

          <label className={styles.campo}>
            Correo electrónico
            <input
              type="email"
              value={valores.email}
              onChange={(evento) => actualizarCampo('email', evento.target.value)}
              required
            />
          </label>

          <Link to="/recuperar-contrasena" className={styles.enlace}>
            Cambiar contraseña
          </Link>

          <label className={styles.campo}>
            Nombre(s)
            <input
              type="text"
              value={valores.first_name}
              onChange={(evento) => actualizarCampo('first_name', evento.target.value)}
              required
            />
          </label>

          <label className={styles.campo}>
            Apellidos
            <input
              type="text"
              value={valores.last_name}
              onChange={(evento) => actualizarCampo('last_name', evento.target.value)}
              placeholder="Paterno y materno"
              required
            />
          </label>

          {esAdmin ? (
            <label className={styles.campo}>
              Rol
              <select
                value={valores.rol_usuario}
                onChange={(evento) => actualizarCampo('rol_usuario', evento.target.value)}
              >
                <option value="admin">Administrador</option>
                <option value="operador">Operador</option>
              </select>
            </label>
          ) : (
            <div className={styles.campo}>
              Rol
              <p className={styles.valorSoloLectura}>{rolTexto}</p>
            </div>
          )}

          {errorFormulario && (
            <p className={styles.error} role="alert">
              {errorFormulario}
            </p>
          )}

          {exito && (
            <p className={styles.exito} role="status">
              Tu información se actualizó correctamente.
            </p>
          )}

          <div className={styles.accionesFormulario}>
            <BotonPrimario type="submit">Guardar cambios</BotonPrimario>
          </div>
        </form>
      )}

      <Modal titulo="¿Estás seguro?" abierto={confirmando} onCerrar={cancelarConfirmacion}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres guardar los cambios en tu información de usuario?
        </p>

        {errorConfirmacion && (
          <p className={styles.error} role="alert">
            {errorConfirmacion}
          </p>
        )}

        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={cancelarConfirmacion}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarGuardar} disabled={actualizar.isPending}>
            {actualizar.isPending ? 'Guardando…' : 'Confirmar'}
          </BotonPrimario>
        </div>
      </Modal>
    </div>
  )
}
