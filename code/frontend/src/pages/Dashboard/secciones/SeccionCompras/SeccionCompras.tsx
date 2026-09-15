import { useNavigate } from 'react-router-dom'

import type { PeriodoDashboard, PuntoMonto } from '../../../../api/reportes'
import { BotonPrimario } from '../../../../components/common/BotonPrimario'
import { formatearEtiquetaFecha, formatearMoneda } from '../../compartido/formato'
import { GraficaBarras } from '../../compartido/GraficaBarras'
import { GraficaLinea } from '../../compartido/GraficaLinea'
import { useResumenCompras } from '../../../../hooks/useResumenCompras'
import { useResumenDashboard } from '../../../../hooks/useResumenDashboard'
import styles from '../../compartido/SeccionOperacion.module.css'

interface SeccionComprasProps {
  periodo: PeriodoDashboard
}

export function SeccionCompras({ periodo }: SeccionComprasProps) {
  const navigate = useNavigate()
  const { data: resumen, isLoading } = useResumenCompras(periodo)
  const { data: resumenGeneral } = useResumenDashboard(periodo)

  const mapear = (puntos: PuntoMonto[] = []) =>
    puntos.map((punto) => ({ etiqueta: formatearEtiquetaFecha(punto.fecha, periodo), valor: Number(punto.monto) }))

  const datosConteo = (resumen?.conteo_estado ?? []).map((fila) => ({ etiqueta: fila.tipo, valor: fila.cantidad }))

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.tituloSeccion}>Resumen de compras</h2>
        <div className={styles.accionesSeccion}>
          <span className={styles.indicadorSeccion}>
            <span className={styles.indicadorEtiqueta}>Gasto en compras</span>
            <span className={styles.indicadorMonto}>
              {resumenGeneral ? formatearMoneda(resumenGeneral.compras_total) : '…'}
            </span>
          </span>
          <BotonPrimario variante="secundario" onClick={() => navigate('/compras/nueva')}>
            Nueva compra
          </BotonPrimario>
        </div>
      </div>

      {isLoading || !resumen ? (
        <p>Cargando resumen de compras…</p>
      ) : (
        <>
          <div className={styles.filaTresGraficas}>
            <GraficaLinea titulo="Todas las compras" datos={mapear(resumen.todas)} color="var(--color-primario)" />
            <GraficaLinea titulo="Compras de productos" datos={mapear(resumen.productos)} color="var(--color-secundario)" />
            <GraficaLinea titulo="Compras de insumos" datos={mapear(resumen.insumos)} color="var(--color-advertencia)" />
          </div>
          <div className={styles.filaUnaGrafica}>
            <GraficaBarras
              titulo="Compras pendientes y recibidas"
              datos={datosConteo}
              colores={['var(--color-advertencia)', 'var(--color-exito)']}
              etiquetaEjeY="Cantidad"
            />
          </div>
        </>
      )}
    </section>
  )
}
