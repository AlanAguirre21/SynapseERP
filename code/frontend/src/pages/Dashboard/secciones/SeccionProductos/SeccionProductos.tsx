import { useState } from 'react'

import type { OrdenTop, PeriodoDashboard } from '../../../../api/reportes'
import { GraficaBarras } from '../../compartido/GraficaBarras'
import { useProductosTop } from '../../../../hooks/useProductosTop'
import styles from '../../compartido/SeccionTop.module.css'

interface SeccionProductosProps {
  periodo: PeriodoDashboard
}

export function SeccionProductos({ periodo }: SeccionProductosProps) {
  const [orden, setOrden] = useState<OrdenTop>('mas')
  const { data: productos, isLoading } = useProductosTop(periodo, orden)

  const datos = (productos ?? []).map((producto) => ({ etiqueta: producto.producto, valor: Number(producto.cantidad) }))

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.tituloSeccion}>Resumen de productos</h2>
        <div className={styles.selectorOrden} role="group" aria-label="Orden del ranking de productos">
          <button
            type="button"
            className={orden === 'mas' ? `${styles.opcionOrden} ${styles.opcionOrdenActiva}` : styles.opcionOrden}
            aria-pressed={orden === 'mas'}
            onClick={() => setOrden('mas')}
          >
            Más vendidos
          </button>
          <button
            type="button"
            className={orden === 'menos' ? `${styles.opcionOrden} ${styles.opcionOrdenActiva}` : styles.opcionOrden}
            aria-pressed={orden === 'menos'}
            onClick={() => setOrden('menos')}
          >
            Menos vendidos
          </button>
        </div>
      </div>

      {isLoading ? (
        <p>Cargando productos…</p>
      ) : datos.length === 0 ? (
        <p className={styles.sinDatos}>No hay ventas de productos en este periodo.</p>
      ) : (
        <GraficaBarras
          titulo={orden === 'mas' ? 'Top 5 productos más vendidos' : 'Top 5 productos menos vendidos'}
          datos={datos}
          colores={['var(--color-primario)']}
          etiquetaEjeY="Cantidad vendida"
        />
      )}
    </section>
  )
}
