<<<<<<< HEAD
import { useState, type FormEvent } from 'react'
=======
import { useState, type FormEvent, type ReactNode } from 'react'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import { Link } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Icono } from '../../components/common/Icono'
import { Modal } from '../../components/common/Modal'
<<<<<<< HEAD
import type { InformacionUsuarioFormulario } from '../../api/usuarios'
import { useActualizarMiInformacion, useUsuarioActual } from '../../hooks/useUsuarioActual'
import { obtenerIniciales } from '../../utils/texto'
=======
import { SelectorFotoPerfil } from '../../components/common/SelectorFotoPerfil'
import {
  DESCRIPCIONES_ROL,
  ETIQUETAS_ROL,
  type CambioFoto,
  type InformacionUsuarioFormulario,
  type Usuario,
} from '../../api/usuarios'
import { useActualizarMiInformacion, useUsuarioActual } from '../../hooks/useUsuarioActual'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import styles from './InformacionUsuario.module.css'

interface ErrorGuardarInformacion {
  detail?: string
  username?: string[]
  email?: string[]
  first_name?: string[]
  last_name?: string[]
  rol_usuario?: string[]
<<<<<<< HEAD
=======
  foto_usuario?: string[]
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
=======
    datos?.foto_usuario?.[0] ??
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    'No se pudo guardar la información. Intenta de nuevo.'
  )
}

<<<<<<< HEAD
=======
const CAMPOS: (keyof InformacionUsuarioFormulario)[] = ['username', 'email', 'first_name', 'last_name', 'rol_usuario']

// Valores guardados con la misma forma que el formulario: `rol_usuario` solo
// viaja si el usuario es admin (el backend lo rechaza para operador).
function valoresDe(usuario: Usuario): InformacionUsuarioFormulario {
  return {
    username: usuario.username,
    email: usuario.email,
    first_name: usuario.first_name,
    last_name: usuario.last_name,
    ...(usuario.rol === 'admin' ? { rol_usuario: usuario.rol } : {}),
  }
}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
=======
  // Fotografía: `undefined` sin cambio, archivo nuevo o `null` para quitarla.
  // Se guarda con el resto del formulario, por la misma confirmación.
  const [cambioFoto, setCambioFoto] = useState<CambioFoto | undefined>(undefined)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

  const esAdmin = usuario?.rol === 'admin'

  // Precarga el formulario una sola vez, cuando `usuario` llega por primera
  // vez — ajustar estado durante el render (en vez de en un `useEffect`)
  // evita el render extra que produciría un efecto, y sigue sin pisar
  // ediciones en curso ante un refetch posterior en segundo plano.
  if (usuario && usuario.id !== usuarioIdCargado) {
    setUsuarioIdCargado(usuario.id)
<<<<<<< HEAD
    setValores({
      username: usuario.username,
      email: usuario.email,
      first_name: usuario.first_name,
      last_name: usuario.last_name,
      ...(usuario.rol === 'admin' ? { rol_usuario: usuario.rol } : {}),
    })
  }

=======
    setValores(valoresDe(usuario))
  }

  const valoresGuardados = usuario ? valoresDe(usuario) : null
  const hayCambios =
    valoresGuardados !== null &&
    (cambioFoto !== undefined || CAMPOS.some((campo) => valores[campo] !== valoresGuardados[campo]))

  // Un admin que se cambia a operador pierde los módulos de admin al guardar.
  const seDegrada = esAdmin && valores.rol_usuario === 'operador'

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  function actualizarCampo(campo: keyof InformacionUsuarioFormulario, valor: string) {
    setExito(false)
    setValores((v) => ({ ...v, [campo]: valor }))
  }

<<<<<<< HEAD
=======
  function cambiarFoto(cambio: CambioFoto | undefined) {
    setExito(false)
    setCambioFoto(cambio)
  }

  function descartarCambios() {
    if (!valoresGuardados) return
    setValores(valoresGuardados)
    setCambioFoto(undefined)
    setErrorFormulario('')
    setExito(false)
  }

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
      await actualizar.mutateAsync(valores)
      setConfirmando(false)
=======
      // Sin cambio de fotografía, la petición es la misma de siempre.
      await actualizar.mutateAsync(cambioFoto === undefined ? valores : { ...valores, foto_usuario: cambioFoto })
      setConfirmando(false)
      setCambioFoto(undefined)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      setExito(true)
    } catch (err) {
      setErrorConfirmacion(extraerMensajeError(err))
    }
  }

<<<<<<< HEAD
  const rolTexto = usuario?.rol === 'admin' ? 'Administrador' : 'Operador'

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>Información de Usuario</h1>

      {isLoading ? (
        <p>Cargando información…</p>
      ) : (
        <>
          <div className={styles.identidad}>
            <span className={styles.avatar} aria-hidden="true">
              {obtenerIniciales(usuario?.nombre)}
            </span>
            <div>
              <p className={styles.nombreCompleto}>{usuario?.nombre}</p>
              <p className={styles.usernameEtiqueta}>@{usuario?.username}</p>
            </div>
          </div>

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
              <Icono nombre="candado" tamano={14} />
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
=======
  const rolGuardado = usuario?.rol ?? 'operador'
  // Para admin, la descripción sigue al valor elegido en el selector.
  const rolDescrito = esAdmin ? (valores.rol_usuario ?? rolGuardado) : rolGuardado

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Información de Usuario</h1>
          <p className="pageHint">Consulta y actualiza los datos de tu cuenta.</p>
        </div>
      </div>

      {isLoading || !usuario ? (
        <p>Cargando información…</p>
      ) : (
        <>
          <section className={styles.profileHeader} aria-label="Perfil">
            <SelectorFotoPerfil
              nombre={usuario.nombre}
              fotoGuardada={usuario.foto_usuario}
              cambio={cambioFoto}
              onCambiar={cambiarFoto}
              tono="marca"
            >
              <p className={styles.profileName}>{usuario.nombre}</p>
              <p className={styles.profileMeta}>{`@${usuario.username} · ${ETIQUETAS_ROL[usuario.rol]}`}</p>
            </SelectorFotoPerfil>
          </section>

          <form onSubmit={alEnviar} noValidate>
            <FilaAjustes titulo="Datos personales" descripcion="Tu nombre como lo ven los demás usuarios del sistema.">
              <div className="formGrid">
                <label className="field">
                  Nombre(s)
                  <input
                    type="text"
                    value={valores.first_name}
                    onChange={(evento) => actualizarCampo('first_name', evento.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  Apellidos
                  <input
                    type="text"
                    value={valores.last_name}
                    onChange={(evento) => actualizarCampo('last_name', evento.target.value)}
                    placeholder="Paterno y materno"
                    required
                  />
                </label>
              </div>
            </FilaAjustes>

            <FilaAjustes titulo="Cuenta" descripcion="Los datos con los que te identificas en el sistema.">
              <div className="formGrid">
                <label className="field">
                  Nombre de usuario
                  <input
                    type="text"
                    value={valores.username}
                    onChange={(evento) => actualizarCampo('username', evento.target.value)}
                    required
                  />
                </label>

                <div className="field">
                  <label className="field">
                    Correo electrónico
                    <input
                      type="email"
                      value={valores.email}
                      onChange={(evento) => actualizarCampo('email', evento.target.value)}
                      aria-describedby="ayuda-correo"
                      required
                    />
                  </label>
                  <span id="ayuda-correo" className="fieldHint">
                    Con este correo inicias sesión y recibes el código para cambiar tu contraseña.
                  </span>
                </div>
              </div>
            </FilaAjustes>

            <FilaAjustes titulo="Seguridad" descripcion="Cómo proteges el acceso a tu cuenta.">
              <div className={styles.securityRow}>
                <div className={styles.securityText}>
                  <span className={styles.securityTitle}>Contraseña</span>
                  <span className="fieldHint">Se cambia con un código que enviamos a tu correo.</span>
                </div>
                <Link to="/recuperar-contrasena" className="link">
                  <Icono nombre="candado" tamano={14} />
                  Cambiar contraseña
                </Link>
              </div>
            </FilaAjustes>

            <FilaAjustes titulo="Rol y acceso" descripcion="Qué puedes hacer en el sistema según tu rol.">
              {esAdmin ? (
                <div className="field">
                  <label className="field">
                    Rol
                    <select
                      value={valores.rol_usuario}
                      onChange={(evento) => actualizarCampo('rol_usuario', evento.target.value)}
                      aria-describedby={seDegrada ? 'descripcion-rol aviso-rol' : 'descripcion-rol'}
                    >
                      <option value="admin">Administrador</option>
                      <option value="operador">Operador</option>
                    </select>
                  </label>
                  <span id="descripcion-rol" className="fieldHint">
                    {DESCRIPCIONES_ROL[rolDescrito]}
                  </span>
                  {seDegrada && (
                    <span id="aviso-rol" className="fieldWarning">
                      Al guardar perderás el acceso a Caja, Recursos Humanos, Usuarios, Contabilidad y Configuración
                      Fiscal.
                    </span>
                  )}
                </div>
              ) : (
                <div className="field">
                  Rol
                  <span className="status statusNeutral">{ETIQUETAS_ROL[rolGuardado]}</span>
                  <span className="fieldHint">{DESCRIPCIONES_ROL[rolDescrito]}</span>
                </div>
              )}

              <div className="field">
                <span>{`Módulos con acceso (${usuario.modulos.length})`}</span>
                {usuario.modulos.length === 0 ? (
                  <span className="emptyState">—</span>
                ) : (
                  <ul className={styles.moduleList}>
                    {usuario.modulos.map((modulo) => (
                      <li key={modulo.slug} className="status statusNeutral">
                        {modulo.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FilaAjustes>

            <div className={styles.saveArea}>
              {errorFormulario && (
                <p className="errorMessage" role="alert">
                  {errorFormulario}
                </p>
              )}

              {exito && (
                <p className="successMessage" role="status">
                  Tu información se actualizó correctamente.
                </p>
              )}

              <div className={styles.saveBar}>
                <span className={styles.saveNote}>{hayCambios ? 'Tienes cambios sin guardar' : ''}</span>
                <div className={styles.saveActions}>
                  {hayCambios && (
                    <button type="button" className="actionLink" onClick={descartarCambios}>
                      Descartar cambios
                    </button>
                  )}
                  <BotonPrimario type="submit">Guardar cambios</BotonPrimario>
                </div>
              </div>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            </div>
          </form>
        </>
      )}

      <Modal titulo="¿Estás seguro?" abierto={confirmando} onCerrar={cancelarConfirmacion}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
=======
        <p className="confirmText">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          ¿Confirmas que quieres guardar los cambios en tu información de usuario?
        </p>

        {errorConfirmacion && (
<<<<<<< HEAD
          <p className={styles.error} role="alert">
=======
          <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            {errorConfirmacion}
          </p>
        )}

<<<<<<< HEAD
        <div className={styles.accionesFormulario}>
=======
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
=======

// Fila de ajustes: título y explicación a la izquierda, tarjeta a la derecha
// (mismo marcado que en Configuración Fiscal; las clases son globales).
function FilaAjustes({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section className="settingsRow">
      <div className="settingsIntro">
        <h2 className="sectionTitle">{titulo}</h2>
        <p className="settingsDescription">{descripcion}</p>
      </div>
      <div className="card">{children}</div>
    </section>
  )
}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
