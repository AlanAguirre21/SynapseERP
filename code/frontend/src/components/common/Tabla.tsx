<<<<<<< HEAD
import type { ReactNode } from 'react'
=======
import { Fragment, type ReactNode } from 'react'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

import styles from './Tabla.module.css'

export interface ColumnaTabla<T> {
  clave: Extract<keyof T, string>
<<<<<<< HEAD
  encabezado: string
  render?: (fila: T) => ReactNode
=======
  // Texto, o un control (ej. la casilla "seleccionar todas" de Nóminas).
  encabezado: ReactNode
  render?: (fila: T) => ReactNode
  // 'derecha' para columnas numéricas o de dinero.
  alineacion?: 'derecha'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
}

interface TablaProps<T> {
  columnas: ColumnaTabla<T>[]
  datos: T[]
  claveFila?: keyof T
  renderAcciones?: (fila: T) => ReactNode
  mensajeVacio?: string
<<<<<<< HEAD
=======
  // Fila de totales opcional (ej. "Sumas" de un balance): una celda por
  // columna, con la misma alineación que su columna.
  filaPie?: ReactNode[]
  // Fila de detalle opcional bajo cada fila (ej. historial de un cliente):
  // si devuelve contenido, ocupa todo el ancho justo debajo de su fila.
  renderExpandido?: (fila: T) => ReactNode
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
}

export function Tabla<T>({
  columnas,
  datos,
  claveFila = 'id' as keyof T,
  renderAcciones,
  mensajeVacio = 'Sin datos para mostrar.',
<<<<<<< HEAD
}: TablaProps<T>) {
  return (
    <div className={styles.contenedor}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave}>{columna.encabezado}</th>
=======
  filaPie,
  renderExpandido,
}: TablaProps<T>) {
  const totalColumnas = columnas.length + (renderAcciones ? 1 : 0)

  return (
    <div className={styles.tableContainer}>
      <table className="dataTable">
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave} className={columna.alineacion === 'derecha' ? 'numeric' : undefined}>
                {columna.encabezado}
              </th>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            ))}
            {renderAcciones && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
<<<<<<< HEAD
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
=======
          {datos.map((fila) => {
            const expandido = renderExpandido?.(fila)
            return (
              <Fragment key={String(fila[claveFila])}>
                <tr>
                  {columnas.map((columna) => (
                    <td key={columna.clave} className={columna.alineacion === 'derecha' ? 'numeric' : undefined}>
                      {columna.render ? columna.render(fila) : (fila[columna.clave] as ReactNode)}
                    </td>
                  ))}
                  {renderAcciones && <td>{renderAcciones(fila)}</td>}
                </tr>
                {expandido != null && expandido !== false && (
                  <tr className="expandedRow">
                    <td colSpan={totalColumnas}>{expandido}</td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        {filaPie && datos.length > 0 && (
          <tfoot>
            <tr>
              {columnas.map((columna, indice) => (
                <td key={columna.clave} className={columna.alineacion === 'derecha' ? 'numeric' : undefined}>
                  {filaPie[indice]}
                </td>
              ))}
              {renderAcciones && <td />}
            </tr>
          </tfoot>
        )}
      </table>
      {datos.length === 0 && <p className={styles.tableEmpty}>{mensajeVacio}</p>}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    </div>
  )
}
