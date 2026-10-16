import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import logoFlebosil from '../../assets/flebosil_transparentbg/logo_flebosil.png'
import { useAuth } from '../../context/AuthContext'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import {
  useAprobarSolicitudNomina,
  useRechazarSolicitudNomina,
  useSolicitudesNominaPendientes,
} from '../../hooks/useSolicitudesNomina'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { obtenerIniciales } from '../../utils/texto'
import { Icono } from '../common/Icono'
import styles from './Header.module.css'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const { data: alertas, isLoading: alertasCargando } = useAlertasStock()
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
          <img src={logoFlebosil} alt="FleboSil" className={styles.logoImage} />
        </Link>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.notifications}>
          <button
            type="button"
            className={styles.notificationsButton}
            onClick={() => setNotificacionesAbiertas((abierto) => !abierto)}
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
                    <ul className={styles.requestList}>
                      {(solicitudesNomina ?? []).map((solicitud) => (
                        <li key={solicitud.id}>
                          <div className={styles.requestData}>
                            <strong>Empleado #{solicitud.empleado}</strong>
                            <span>
                              {solicitud.periodo_inicio} — {solicitud.periodo_fin} · ${solicitud.monto}
                            </span>
                          </div>
                          <div className={styles.requestActions}>
                            <button
                              type="button"
                              className={styles.approveButton}
                              onClick={() => aprobar.mutate(solicitud.id)}
                              disabled={aprobar.isPending || rechazar.isPending}
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              onClick={() => rechazar.mutate(solicitud.id)}
                              disabled={aprobar.isPending || rechazar.isPending}
                            >
                              Rechazar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.userMenu}>
          <button
            type="button"
            className={styles.userButton}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
          >
            <span className={styles.avatar} aria-hidden="true">
              {obtenerIniciales(usuario?.nombre)}
            </span>
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
