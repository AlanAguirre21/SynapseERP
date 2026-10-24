import { NavLink } from 'react-router-dom'

import type { ModuloMenu } from '../../api/usuarios'
import { Icono, type NombreIcono } from '../common/Icono'
import styles from './Sidebar.module.css'

interface SidebarProps {
  modulos: ModuloMenu[]
  colapsado: boolean
<<<<<<< HEAD
=======
  // Se llama al elegir un destino; el layout lo usa para cerrar el panel en móvil.
  onNavegar?: () => void
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
}

const ICONO_POR_SLUG: Record<string, NombreIcono> = {
  ventas: 'ventas',
  compras: 'compras',
  produccion: 'produccion',
  inventario: 'inventario',
  facturacion: 'facturacion',
  caja: 'caja',
  catalogo: 'catalogo',
  rrhh: 'rrhh',
  terceros: 'personas',
  sucursales: 'sucursales',
  contabilidad: 'contabilidad',
  configuracion_fiscal: 'configuracionFiscal',
  usuarios: 'usuarios',
}

<<<<<<< HEAD
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
=======
// Agrupación solo de presentación: qué módulos existen y cuáles ve cada rol lo
// decide el backend (`modulos`); aquí únicamente se ordenan bajo un rótulo.
const GRUPOS: { titulo: string; slugs: string[] }[] = [
  { titulo: 'Operación', slugs: ['ventas', 'compras', 'produccion', 'inventario'] },
  { titulo: 'Finanzas', slugs: ['facturacion', 'caja', 'contabilidad', 'configuracion_fiscal'] },
  { titulo: 'Administración', slugs: ['catalogo', 'rrhh', 'terceros', 'usuarios', 'sucursales'] },
]

function agruparModulos(modulos: ModuloMenu[]): { titulo: string; modulos: ModuloMenu[] }[] {
  const agrupados = new Set<string>()
  const grupos = GRUPOS.map((grupo) => {
    const delGrupo = grupo.slugs
      .map((slug) => modulos.find((modulo) => modulo.slug === slug))
      .filter((modulo): modulo is ModuloMenu => modulo !== undefined)
    delGrupo.forEach((modulo) => agrupados.add(modulo.slug))
    return { titulo: grupo.titulo, modulos: delGrupo }
  })

  const sinGrupo = modulos.filter((modulo) => !agrupados.has(modulo.slug))
  if (sinGrupo.length > 0) grupos.push({ titulo: 'Otros', modulos: sinGrupo })

  return grupos.filter((grupo) => grupo.modulos.length > 0)
}

export function Sidebar({ modulos, colapsado, onNavegar }: SidebarProps) {
  const grupos = agruparModulos(modulos)

  return (
    <aside className={`${styles.sidebar} ${colapsado ? styles.collapsed : ''}`}>
      <nav>
        <ul className={styles.homeList}>
          <li>
            <NavLink
              to="/dashboard"
              title="Inicio"
              onClick={onNavegar}
              className={({ isActive }) =>
                isActive ? `${styles.homeLink} ${styles.homeLinkActive}` : styles.homeLink
              }
            >
              <Icono nombre="casa" tamano={19} className={styles.homeIcon} />
              <span className={styles.navLabel}>Inicio</span>
            </NavLink>
          </li>
        </ul>

        {grupos.map((grupo) => (
          <div key={grupo.titulo} className={styles.navGroup}>
            <p className={styles.navGroupTitle}>{grupo.titulo}</p>
            <ul className={styles.navList}>
              {grupo.modulos.map((modulo) => {
                const icono = ICONO_POR_SLUG[modulo.slug]
                return (
                  <li key={modulo.slug}>
                    <NavLink
                      to={modulo.ruta}
                      title={modulo.nombre}
                      onClick={onNavegar}
                      className={({ isActive }) =>
                        isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                      }
                    >
                      {icono && <Icono nombre={icono} tamano={19} className={styles.navIcon} />}
                      <span className={styles.navLabel}>{modulo.nombre}</span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      </nav>
    </aside>
  )
}
