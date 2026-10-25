import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import logoSynapse from '../../assets/synapse_img/synapseErp_logo_transparent.png'
import { useAuth } from '../../context/AuthContext'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import { useSolicitudesNominaPendientes } from '../../hooks/useSolicitudesNomina'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { formatearMoneda } from '../../utils/moneda'
import { Avatar } from '../common/Avatar'
import { Icono } from '../common/Icono'
import styles from './Header.module.css'

interface HeaderProps {
  onToggleSidebar: () => void
}

type Desplegable = 'notificaciones' | 'usuario'

const RUTA_NOMINAS = '/rrhh?pestana=nominas'

// `AAAA-MM-DD` -> `DD/MM/AAAA`, sin pasar por `Date` (evita el corrimiento de zona horaria).
function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const { data: alertas, isLoading: alertasCargando } = useAlertasStock()
  // Solo admin puede ver solicitudes de nómina (008 · RRHH) — ni siquiera se
  // pide el endpoint para operador, que de todos modos lo tiene vedado en el
  // backend. Se resuelven en la pestaña "Nóminas" de RRHH, no aquí.
  const { data: solicitudesNomina, isLoading: solicitudesCargando } = useSolicitudesNominaPendientes(esAdmin)
  // Un solo estado para los dos desplegables: abrir uno cierra el otro.
  const [desplegable, setDesplegable] = useState<Desplegable | null>(null)
  const notificacionesAbiertas = desplegable === 'notificaciones'
  const menuAbierto = desplegable === 'usuario'
  const contenedorNotificaciones = useRef<HTMLDivElement>(null)
  const contenedorUsuario = useRef<HTMLDivElement>(null)
  const botonNotificaciones = useRef<HTMLButtonElement>(null)
  const botonUsuario = useRef<HTMLButtonElement>(null)
  const { logout } = useAuth()
  const navigate = useNavigate()

  // Cierra el desplegable al cambiar de ruta (el Header no se vuelve a montar
  // al navegar). Se ajusta durante el render, sin un efecto extra. Cuenta
  // también la búsqueda: un enlace a /rrhh?pestana=nominas estando ya en
  // /rrhh también es una navegación.
  const { pathname, search } = useLocation()
  const ruta = pathname + search
  const [rutaActual, setRutaActual] = useState(ruta)
  if (ruta !== rutaActual) {
    setRutaActual(ruta)
    setDesplegable(null)
  }

  // Con un desplegable abierto: clic o toque fuera de él (y de su botón) lo
  // cierra sin bloquear ese clic, y Escape lo cierra devolviendo el foco a
  // su botón. Los oyentes solo existen mientras hay uno abierto.
  useEffect(() => {
    if (!desplegable) return
    const contenedorAbierto = (desplegable === 'notificaciones' ? contenedorNotificaciones : contenedorUsuario).current
    const botonAbierto = (desplegable === 'notificaciones' ? botonNotificaciones : botonUsuario).current

    function alPulsar(evento: PointerEvent) {
      if (!contenedorAbierto?.contains(evento.target as Node)) setDesplegable(null)
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      setDesplegable(null)
      botonAbierto?.focus()
    }

    document.addEventListener('pointerdown', alPulsar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alPulsar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [desplegable])

  function alternar(cual: Desplegable) {
    setDesplegable((actual) => (actual === cual ? null : cual))
  }

  // Cierre al salir el foco con el teclado. Sin `relatedTarget` (clic en una
  // zona sin controles dentro del desplegable) no se cierra: el clic fuera ya
  // lo cubre el oyente de arriba.
  function alPerderFoco(cual: Desplegable, evento: FocusEvent<HTMLDivElement>) {
    const siguiente = evento.relatedTarget
    if (siguiente && !evento.currentTarget.contains(siguiente)) {
      setDesplegable((actual) => (actual === cual ? null : actual))
    }
  }

  const totalAlertas = alertas?.length ?? 0
  const totalSolicitudes = esAdmin ? solicitudesNomina?.length ?? 0 : 0
  const totalNotificaciones = totalAlertas + totalSolicitudes

  function cerrarSesion() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={onToggleSidebar}
          aria-label="Mostrar u ocultar barra lateral"
        >
          <Icono nombre="menu" tamano={22} />
        </button>
        <Link to="/dashboard" className={styles.logo}>
          <img src={logoSynapse} alt="SynapseERP" className={styles.logoImage} />
        </Link>
      </div>

      <div className={styles.headerRight}>
        <div
          ref={contenedorNotificaciones}
          className={styles.notifications}
          onBlur={(evento) => alPerderFoco('notificaciones', evento)}
        >
          <button
            ref={botonNotificaciones}
            type="button"
            className={styles.notificationsButton}
            onClick={() => alternar('notificaciones')}
            aria-label="Alertas de stock"
            aria-haspopup="menu"
            aria-expanded={notificacionesAbiertas}
          >
            <Icono nombre="campana" tamano={20} />
            {totalNotificaciones > 0 && (
              <span className={styles.counter}>{totalNotificaciones}</span>
            )}
          </button>
          {notificacionesAbiertas && (
            <div className={styles.dropdown} role="menu">
              <p className={styles.dropdownSection}>Stock bajo el mínimo</p>
              {/* Mientras la petición no resuelve no se afirma "sin alertas":
                  sería contenido incorrecto, no un estado de carga. */}
              {alertasCargando ? (
                <p className={styles.dropdownEmpty}>Cargando alertas…</p>
              ) : totalAlertas === 0 ? (
                <p className={styles.dropdownEmpty}>Sin alertas de stock</p>
              ) : (
                <ul className={styles.alertList}>
                  {(alertas ?? []).map((alerta) => (
                    <li key={`${alerta.tipo}-${alerta.nombre}-${alerta.sucursal}`}>
                      <strong>{alerta.nombre}</strong>
                      <span>{alerta.sucursal}</span>
                    </li>
                  ))}
                </ul>
              )}

              {esAdmin && (
                <>
                  <p className={styles.dropdownSection}>Solicitudes de nómina</p>
                  {solicitudesCargando ? (
                    <p className={styles.dropdownEmpty}>Cargando solicitudes…</p>
                  ) : totalSolicitudes === 0 ? (
                    <p className={styles.dropdownEmpty}>Sin solicitudes pendientes</p>
                  ) : (
                    // Pagar mueve la caja: se resuelve en la pestaña "Nóminas"
                    // de RRHH, con el monto y el saldo a la vista y confirmación.
                    <ul className={styles.requestList}>
                      {(solicitudesNomina ?? []).map((solicitud) => (
                        <li key={solicitud.id}>
                          <Link to={RUTA_NOMINAS} className={styles.requestLink}>
                            <strong>{solicitud.empleado_nombre}</strong>
                            <span>
                              {fechaCorta(solicitud.periodo_inicio)} – {fechaCorta(solicitud.periodo_fin)} ·{' '}
                              {formatearMoneda(solicitud.monto)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link to={RUTA_NOMINAS} className={`${styles.menuItem} ${styles.dropdownFooter}`}>
                    Ver nóminas
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <div
          ref={contenedorUsuario}
          className={styles.userMenu}
          onBlur={(evento) => alPerderFoco('usuario', evento)}
        >
          <button
            ref={botonUsuario}
            type="button"
            className={styles.userButton}
            onClick={() => alternar('usuario')}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
          >
            <Avatar nombre={usuario?.nombre} foto={usuario?.foto_usuario} />
            <span className={styles.userData}>
              <span className={styles.userName}>{usuario?.nombre ?? '…'}</span>
              <span className={styles.userRole}>{usuario?.rol ?? ''}</span>
            </span>
            <span className={styles.caret} aria-hidden="true">
              ▾
            </span>
          </button>
          {menuAbierto && (
            <div className={styles.dropdown} role="menu">
              <Link to="/informacion-usuario" className={styles.menuItem}>
                Información de Usuario
              </Link>
              <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={cerrarSesion}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
