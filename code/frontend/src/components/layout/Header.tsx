<<<<<<< HEAD
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import logoSynapse from '../../assets/synapse_img/synapseErp_logo_transparent.png'
import { useAuth } from '../../context/AuthContext'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import {
  useAprobarSolicitudNomina,
  useRechazarSolicitudNomina,
  useSolicitudesNominaPendientes,
} from '../../hooks/useSolicitudesNomina'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { obtenerIniciales } from '../../utils/texto'
=======
import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import logoFlebosil from '../../assets/flebosil_transparentbg/logo_flebosil.png'
import { useAuth } from '../../context/AuthContext'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import { useSolicitudesNominaPendientes } from '../../hooks/useSolicitudesNomina'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { formatearMoneda } from '../../utils/moneda'
import { Avatar } from '../common/Avatar'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import { Icono } from '../common/Icono'
import styles from './Header.module.css'

interface HeaderProps {
  onToggleSidebar: () => void
}

<<<<<<< HEAD
=======
type Desplegable = 'notificaciones' | 'usuario'

const RUTA_NOMINAS = '/rrhh?pestana=nominas'

// `AAAA-MM-DD` -> `DD/MM/AAAA`, sin pasar por `Date` (evita el corrimiento de zona horaria).
function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
export function Header({ onToggleSidebar }: HeaderProps) {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const { data: alertas, isLoading: alertasCargando } = useAlertasStock()
<<<<<<< HEAD
  // Solo admin puede ver/resolver solicitudes de nómina (008 · RRHH) — ni
  // siquiera se pide el endpoint para operador, que de todos modos lo
  // tiene vedado en el backend.
  const { data: solicitudesNomina, isLoading: solicitudesCargando } = useSolicitudesNominaPendientes(esAdmin)
  const aprobar = useAprobarSolicitudNomina()
  const rechazar = useRechazarSolicitudNomina()
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

=======
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

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const totalAlertas = alertas?.length ?? 0
  const totalSolicitudes = esAdmin ? solicitudesNomina?.length ?? 0 : 0
  const totalNotificaciones = totalAlertas + totalSolicitudes

  function cerrarSesion() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className={styles.header}>
<<<<<<< HEAD
      <div className={styles.izquierda}>
        <button
          type="button"
          className={styles.botonSidebar}
=======
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.sidebarToggle}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          onClick={onToggleSidebar}
          aria-label="Mostrar u ocultar barra lateral"
        >
          <Icono nombre="menu" tamano={22} />
        </button>
        <Link to="/dashboard" className={styles.logo}>
<<<<<<< HEAD
          <img src={logoSynapse} alt="SynapseERP" className={styles.logoImg} />
        </Link>
      </div>

      <div className={styles.derecha}>
        <div className={styles.notificaciones}>
          <button
            type="button"
            className={styles.botonNotificaciones}
            onClick={() => setNotificacionesAbiertas((abierto) => !abierto)}
            aria-label="Alertas de stock"
          >
            <Icono nombre="campana" tamano={20} />
            {totalNotificaciones > 0 && (
              <span className={styles.contador}>{totalNotificaciones}</span>
=======
          <img src={logoFlebosil} alt="FleboSil" className={styles.logoImage} />
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
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            )}
          </button>
          {notificacionesAbiertas && (
            <div className={styles.dropdown} role="menu">
<<<<<<< HEAD
              {/* Mientras la petición no resuelve no se afirma "sin alertas":
                  sería contenido incorrecto, no un estado de carga. */}
              {alertasCargando ? (
                <p className={styles.dropdownVacio}>Cargando alertas…</p>
              ) : totalAlertas === 0 ? (
                <p className={styles.dropdownVacio}>Sin alertas de stock</p>
              ) : (
                <ul className={styles.listaAlertas}>
=======
              <p className={styles.dropdownSection}>Stock bajo el mínimo</p>
              {/* Mientras la petición no resuelve no se afirma "sin alertas":
                  sería contenido incorrecto, no un estado de carga. */}
              {alertasCargando ? (
                <p className={styles.dropdownEmpty}>Cargando alertas…</p>
              ) : totalAlertas === 0 ? (
                <p className={styles.dropdownEmpty}>Sin alertas de stock</p>
              ) : (
                <ul className={styles.alertList}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
                  <p className={styles.dropdownSeccion}>Solicitudes de nómina</p>
                  {solicitudesCargando ? (
                    <p className={styles.dropdownVacio}>Cargando solicitudes…</p>
                  ) : totalSolicitudes === 0 ? (
                    <p className={styles.dropdownVacio}>Sin solicitudes pendientes</p>
                  ) : (
                    <ul className={styles.listaSolicitudes}>
                      {(solicitudesNomina ?? []).map((solicitud) => (
                        <li key={solicitud.id}>
                          <div className={styles.datosSolicitud}>
                            <strong>Empleado #{solicitud.empleado}</strong>
                            <span>
                              {solicitud.periodo_inicio} — {solicitud.periodo_fin} · ${solicitud.monto}
                            </span>
                          </div>
                          <div className={styles.accionesSolicitud}>
                            <button
                              type="button"
                              className={styles.botonAprobar}
                              onClick={() => aprobar.mutate(solicitud.id)}
                              disabled={aprobar.isPending || rechazar.isPending}
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              className={styles.botonRechazar}
                              onClick={() => rechazar.mutate(solicitud.id)}
                              disabled={aprobar.isPending || rechazar.isPending}
                            >
                              Rechazar
                            </button>
                          </div>
=======
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
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                        </li>
                      ))}
                    </ul>
                  )}
<<<<<<< HEAD
=======
                  <Link to={RUTA_NOMINAS} className={`${styles.menuItem} ${styles.dropdownFooter}`}>
                    Ver nóminas
                  </Link>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                </>
              )}
            </div>
          )}
        </div>

<<<<<<< HEAD
        <div className={styles.usuario}>
          <button
            type="button"
            className={styles.botonUsuario}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <span className={styles.avatar} aria-hidden="true">
              {obtenerIniciales(usuario?.nombre)}
            </span>
            <span className={styles.datosUsuario}>
              <span className={styles.nombreUsuario}>{usuario?.nombre ?? '…'}</span>
              <span className={styles.rolUsuario}>{usuario?.rol ?? ''}</span>
=======
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
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            </span>
          </button>
          {menuAbierto && (
            <div className={styles.dropdown} role="menu">
<<<<<<< HEAD
              <Link to="/informacion-usuario" className={styles.itemMenu}>
                Información de Usuario
              </Link>
              <button type="button" className={styles.itemMenu} onClick={cerrarSesion}>
=======
              <Link to="/informacion-usuario" className={styles.menuItem}>
                Información de Usuario
              </Link>
              <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={cerrarSesion}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
