import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { cambiarContrasena } from '../../api/auth'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { CampoContrasena } from '../../components/common/CampoContrasena'
import { PaginaAuth } from '../../components/common/PaginaAuth'
import { useAuth } from '../../context/AuthContext'
<<<<<<< HEAD
import styles from './CambiarContrasena.module.css'
=======
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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
<<<<<<< HEAD
      <form className={styles.formulario} onSubmit={alEnviar} noValidate>
=======
      <form className="form" onSubmit={alEnviar} noValidate>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        <CampoContrasena etiqueta="Nueva contraseña" valor={password} onCambiar={setPassword} required />

        <CampoContrasena
          etiqueta="Confirmar nueva contraseña"
          valor={confirmacion}
          onCambiar={setConfirmacion}
          required
        />

<<<<<<< HEAD
        <Link to="/login" className={styles.enlace}>
=======
        <Link to="/login" className="link linkCentered">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Volver a la página de inicio
        </Link>

        {error && (
<<<<<<< HEAD
          <p className={styles.error} role="alert">
=======
          <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
