import type { ReactNode } from 'react'

import styles from './Tabla.module.css'

export interface ColumnaTabla<T> {
  clave: Extract<keyof T, string>
  encabezado: string
  render?: (fila: T) => ReactNode
}

interface TablaProps<T> {
  columnas: ColumnaTabla<T>[]
  datos: T[]
  claveFila?: keyof T
  renderAcciones?: (fila: T) => ReactNode
  mensajeVacio?: string
}

export function Tabla<T>({
  columnas,
  datos,
  claveFila = 'id' as keyof T,
  renderAcciones,
  mensajeVacio = 'Sin datos para mostrar.',
}: TablaProps<T>) {
  return (
    <div className={styles.contenedor}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave}>{columna.encabezado}</th>
            ))}
            {renderAcciones && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {datos.map((fila) => (
            <tr key={String(fila[claveFila])}>
              {columnas.map((columna) => (
                <td key={columna.clave}>
                  {columna.render ? columna.render(fila) : (fila[columna.clave] as ReactNode)}
                </td>
              ))}
              {renderAcciones && <td>{renderAcciones(fila)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {datos.length === 0 && <p className={styles.vacio}>{mensajeVacio}</p>}
    </div>
  )
}
