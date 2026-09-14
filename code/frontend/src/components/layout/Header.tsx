import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import logoFlebosil from '../../assets/flebosil_transparentbg/logo_flebosil.png'
import { useAuth } from '../../context/AuthContext'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { obtenerIniciales } from '../../utils/texto'
import { Icono } from '../common/Icono'
import styles from './Header.module.css'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { data: usuario } = useUsuarioActual()
  const { data: alertas, isLoading: alertasCargando } = useAlertasStock()
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const totalAlertas = alertas?.length ?? 0

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
          <img src={logoFlebosil} alt="FleboSil" className={styles.logoImg} />
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
            {totalAlertas > 0 && (
              <span className={styles.contador}>{totalAlertas}</span>
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
