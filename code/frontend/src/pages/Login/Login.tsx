import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { CampoContrasena } from '../../components/common/CampoContrasena'
import { PaginaAuth } from '../../components/common/PaginaAuth'
import { useAuth } from '../../context/AuthContext'
import styles from './Login.module.css'

const MENSAJE_ERROR_PREDETERMINADO = 'Correo o contraseña incorrectos.'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.')
      return
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('Ingresa un correo electrónico válido.')
      return
    }
    if (!password) {
      setError('Ingresa tu contraseña.')
      return
    }

    setCargando(true)

    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const detalle =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      setError(detalle ?? MENSAJE_ERROR_PREDETERMINADO)
    } finally {
      setCargando(false)
    }
  }

  return (
    <PaginaAuth titulo="Bienvenido" subtitulo="Ingresa a tu cuenta para continuar">
      <form className={styles.formulario} onSubmit={alEnviar} noValidate>
        <label className={styles.campo}>
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <CampoContrasena
          etiqueta="Contraseña"
          valor={password}
          onCambiar={setPassword}
          autoComplete="current-password"
          required
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <BotonPrimario type="submit" disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </BotonPrimario>

        <Link to="/recuperar-contrasena" className={styles.enlace}>
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </PaginaAuth>
  )
}
