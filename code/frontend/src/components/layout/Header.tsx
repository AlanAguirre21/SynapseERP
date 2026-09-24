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
      <div className={styles.izquierda}>
        <button
          type="button"
          className={styles.botonSidebar}
          onClick={onToggleSidebar}
          aria-label="Mostrar u ocultar barra lateral"
        >
          <Icono nombre="menu" tamano={22} />
        </button>
        <Link to="/dashboard" className={styles.logo}>
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
            )}
          </button>
          {notificacionesAbiertas && (
            <div className={styles.dropdown} role="menu">
              {/* Mientras la petición no resuelve no se afirma "sin alertas":
                  sería contenido incorrecto, no un estado de carga. */}
              {alertasCargando ? (
                <p className={styles.dropdownVacio}>Cargando alertas…</p>
              ) : totalAlertas === 0 ? (
                <p className={styles.dropdownVacio}>Sin alertas de stock</p>
              ) : (
                <ul className={styles.listaAlertas}>
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
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

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
            </span>
          </button>
          {menuAbierto && (
            <div className={styles.dropdown} role="menu">
              <Link to="/informacion-usuario" className={styles.itemMenu}>
                Información de Usuario
              </Link>
              <button type="button" className={styles.itemMenu} onClick={cerrarSesion}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
