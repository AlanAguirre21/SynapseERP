import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { solicitarRecuperacion, verificarCodigo } from '../../api/auth'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { PaginaAuth } from '../../components/common/PaginaAuth'
import styles from './RecuperarContrasena.module.css'

const MENSAJE_ENVIO_GENERICO = 'Si el correo está registrado, te enviamos un código de verificación.'
const MENSAJE_ERROR_CODIGO = 'Código inválido o expirado.'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EstadoNavegacion {
  mensaje?: string
}

export function RecuperarContrasena() {
  const location = useLocation()
  const estadoNavegacion = location.state as EstadoNavegacion | null
  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState(estadoNavegacion?.mensaje ?? '')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  async function enviarCodigo() {
    try {
      const { detail } = await solicitarRecuperacion(email)
      setMensaje(detail ?? MENSAJE_ENVIO_GENERICO)
    } catch {
      setMensaje(MENSAJE_ENVIO_GENERICO)
    }
  }

  async function alEnviarCorreo(evento: FormEvent<HTMLFormElement>) {
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

    setCargando(true)
    await enviarCodigo()
    setCargando(false)
    setPaso('codigo')
  }

  async function alReenviar() {
    setError('')
    setCargando(true)
    await enviarCodigo()
    setCargando(false)
  }

  async function alVerificarCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')

    if (codigo.length !== 6) {
      setError('Ingresa el código de 6 dígitos.')
      return
    }

    setCargando(true)
    try {
      await verificarCodigo(email, codigo)
      navigate('/cambiar-contrasena', { replace: true, state: { email } })
    } catch (err) {
      const detalle =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      setError(detalle ?? MENSAJE_ERROR_CODIGO)
    } finally {
      setCargando(false)
    }
  }

  return paso === 'correo' ? (
    <PaginaAuth titulo="Recuperar contraseña" subtitulo="Te enviaremos un código de verificación por correo">
      <form className={styles.formulario} onSubmit={alEnviarCorreo} noValidate>
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

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <BotonPrimario type="submit" disabled={cargando}>
          {cargando ? 'Enviando…' : 'Enviar código'}
        </BotonPrimario>

        <Link to="/login" className={styles.enlace}>
          Volver a iniciar sesión
        </Link>
      </form>
    </PaginaAuth>
  ) : (
    <PaginaAuth titulo="Verifica tu código" subtitulo={`Enviamos un código de 6 dígitos a ${email}`}>
      <form className={styles.formulario} onSubmit={alVerificarCodigo} noValidate>
        {mensaje && <p className={styles.mensaje}>{mensaje}</p>}

        <label className={styles.campo}>
          Código de 6 dígitos
          <input
            type="text"
            inputMode="numeric"
            className={styles.inputCodigo}
            maxLength={6}
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value.replace(/\D/g, ''))}
            required
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <BotonPrimario type="submit" disabled={cargando || codigo.length !== 6}>
          {cargando ? 'Verificando…' : 'Verificar código'}
        </BotonPrimario>

        <button
          type="button"
          className={styles.enlaceBoton}
          onClick={alReenviar}
          disabled={cargando}
        >
          Reenviar código
        </button>

        <Link to="/login" className={styles.enlace}>
          Volver a iniciar sesión
        </Link>
      </form>
    </PaginaAuth>
  )
}
