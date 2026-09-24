import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { cambiarContrasena } from '../../api/auth'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { CampoContrasena } from '../../components/common/CampoContrasena'
import { PaginaAuth } from '../../components/common/PaginaAuth'
import { useAuth } from '../../context/AuthContext'
import styles from './CambiarContrasena.module.css'

const MENSAJE_SIN_CONTEXTO =
  'Tu sesión de recuperación expiró o no es válida. Solicita un nuevo código.'
const MENSAJE_ERROR_GENERICO = 'No se pudo cambiar la contraseña. Intenta de nuevo.'

interface EstadoNavegacion {
  email?: string
}

interface ErrorCambioContrasena {
  detail?: string
  password?: string[]
  password_confirmacion?: string[]
}

export function CambiarContrasena() {
  const location = useLocation()
  const navigate = useNavigate()
  const { iniciarSesionConTokens } = useAuth()
  const estadoNavegacion = location.state as EstadoNavegacion | null
  const email = estadoNavegacion?.email

  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  if (!email) {
    return (
      <Navigate to="/recuperar-contrasena" replace state={{ mensaje: MENSAJE_SIN_CONTEXTO }} />
    )
  }

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError('')

    if (!password || !confirmacion) {
      setError('Completa ambos campos de contraseña.')
      return
    }

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    try {
      const { access, refresh } = await cambiarContrasena(email, password, confirmacion)
      iniciarSesionConTokens(access, refresh)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const datos =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: ErrorCambioContrasena } }).response?.data
          : undefined
      setError(
        datos?.detail ??
          datos?.password?.[0] ??
          datos?.password_confirmacion?.[0] ??
          MENSAJE_ERROR_GENERICO,
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <PaginaAuth titulo="Nueva contraseña" subtitulo="Elige una contraseña nueva para tu cuenta">
      <form className={styles.formulario} onSubmit={alEnviar} noValidate>
        <CampoContrasena etiqueta="Nueva contraseña" valor={password} onCambiar={setPassword} required />

        <CampoContrasena
          etiqueta="Confirmar nueva contraseña"
          valor={confirmacion}
          onCambiar={setConfirmacion}
          required
        />

        <Link to="/login" className={styles.enlace}>
          Volver a la página de inicio
        </Link>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <BotonPrimario type="submit" disabled={cargando}>
          {cargando ? 'Guardando…' : 'Guardar nueva contraseña'}
        </BotonPrimario>
      </form>
    </PaginaAuth>
  )
}
