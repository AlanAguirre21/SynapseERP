import { NavLink } from 'react-router-dom'

import type { ModuloMenu } from '../../api/usuarios'
import { Icono, type NombreIcono } from '../common/Icono'
import styles from './Sidebar.module.css'

interface SidebarProps {
  modulos: ModuloMenu[]
  colapsado: boolean
}

const ICONO_POR_SLUG: Record<string, NombreIcono> = {
  ventas: 'ventas',
  compras: 'compras',
  produccion: 'produccion',
  inventario: 'inventario',
  facturacion: 'facturacion',
  caja: 'caja',
  catalogo: 'catalogo',
  personas: 'personas',
  sucursales: 'sucursales',
  contabilidad: 'contabilidad',
  configuracion_fiscal: 'configuracionFiscal',
  usuarios: 'usuarios',
}

export function Sidebar({ modulos, colapsado }: SidebarProps) {
  return (
    <aside className={`${styles.sidebar} ${colapsado ? styles.colapsado : ''}`}>
      <nav>
        <ul className={styles.listaInicio}>
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? `${styles.enlaceInicio} ${styles.activoInicio}` : styles.enlaceInicio
              }
            >
              <Icono nombre="casa" tamano={19} className={styles.iconoInicio} />
              <span>Inicio</span>
            </NavLink>
          </li>
        </ul>
        <ul className={styles.lista}>
          {modulos.map((modulo) => {
            const icono = ICONO_POR_SLUG[modulo.slug]
            return (
              <li key={modulo.slug}>
                <NavLink
                  to={modulo.ruta}
                  className={({ isActive }) =>
                    isActive ? `${styles.enlace} ${styles.activo}` : styles.enlace
                  }
                >
                  {icono && <Icono nombre={icono} tamano={19} className={styles.icono} />}
                  <span>{modulo.nombre}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
