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
    'No se pudo guardar la información. Intenta de nuevo.'
  )
}

export function InformacionUsuario() {
  const { data: usuario, isLoading } = useUsuarioActual()
  const actualizar = useActualizarMiInformacion()

  const [valores, setValores] = useState<InformacionUsuarioFormulario>({ username: '', email: '' })
  const [usuarioIdCargado, setUsuarioIdCargado] = useState<number | null>(null)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirmacion, setErrorConfirmacion] = useState('')
  const [exito, setExito] = useState(false)

  // Precarga el formulario una sola vez, cuando `usuario` llega por primera
  // vez — ajustar estado durante el render (en vez de en un `useEffect`)
  // evita el render extra que produciría un efecto, y sigue sin pisar
  // ediciones en curso ante un refetch posterior en segundo plano.
  if (usuario && usuario.id !== usuarioIdCargado) {
    setUsuarioIdCargado(usuario.id)
    setValores({ username: usuario.username, email: usuario.email })
  }

  function actualizarCampo(campo: keyof InformacionUsuarioFormulario, valor: string) {
    setExito(false)
    setValores((v) => ({ ...v, [campo]: valor }))
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.username.trim() || !valores.email.trim()) {
      setErrorFormulario('Completa nombre de usuario y correo electrónico.')
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

          <div className={styles.campo}>
            Rol
            <p className={styles.valorSoloLectura}>{rolTexto}</p>
          </div>

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
