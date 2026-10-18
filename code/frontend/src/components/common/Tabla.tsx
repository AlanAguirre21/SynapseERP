import { Fragment, type ReactNode } from 'react'

import styles from './Tabla.module.css'

export interface ColumnaTabla<T> {
  clave: Extract<keyof T, string>
  encabezado: string
  render?: (fila: T) => ReactNode
  // 'derecha' para columnas numéricas o de dinero.
  alineacion?: 'derecha'
}

interface TablaProps<T> {
  columnas: ColumnaTabla<T>[]
  datos: T[]
  claveFila?: keyof T
  renderAcciones?: (fila: T) => ReactNode
  mensajeVacio?: string
  // Fila de totales opcional (ej. "Sumas" de un balance): una celda por
  // columna, con la misma alineación que su columna.
  filaPie?: ReactNode[]
  // Fila de detalle opcional bajo cada fila (ej. historial de un cliente):
  // si devuelve contenido, ocupa todo el ancho justo debajo de su fila.
  renderExpandido?: (fila: T) => ReactNode
}

export function Tabla<T>({
  columnas,
  datos,
  claveFila = 'id' as keyof T,
  renderAcciones,
  mensajeVacio = 'Sin datos para mostrar.',
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
            ))}
            {renderAcciones && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
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
    </div>
  )
}
