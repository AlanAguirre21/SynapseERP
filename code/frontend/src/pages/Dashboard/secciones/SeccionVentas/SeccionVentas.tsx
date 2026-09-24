import { useNavigate } from 'react-router-dom'

import type { PeriodoDashboard, PuntoMonto } from '../../../../api/reportes'
import { BotonPrimario } from '../../../../components/common/BotonPrimario'
import { formatearEtiquetaFecha, formatearMoneda } from '../../compartido/formato'
import { GraficaBarras } from '../../compartido/GraficaBarras'
import { GraficaLinea } from '../../compartido/GraficaLinea'
import { useResumenDashboard } from '../../../../hooks/useResumenDashboard'
import { useResumenVentas } from '../../../../hooks/useResumenVentas'
import styles from '../../compartido/SeccionOperacion.module.css'

interface SeccionVentasProps {
  periodo: PeriodoDashboard
}

export function SeccionVentas({ periodo }: SeccionVentasProps) {
  const navigate = useNavigate()
  const { data: resumen, isLoading } = useResumenVentas(periodo)
  const { data: resumenGeneral } = useResumenDashboard(periodo)

  const mapear = (puntos: PuntoMonto[] = []) =>
    puntos.map((punto) => ({ etiqueta: formatearEtiquetaFecha(punto.fecha, periodo), valor: Number(punto.monto) }))

  const datosConteo = (resumen?.conteo_estado ?? []).map((fila) => ({ etiqueta: fila.tipo, valor: fila.cantidad }))

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.tituloSeccion}>Resumen de ventas</h2>
        <div className={styles.accionesSeccion}>
          <span className={styles.indicadorSeccion}>
            <span className={styles.indicadorEtiqueta}>Ganancia de ventas</span>
            <span className={styles.indicadorMonto}>
              {resumenGeneral ? formatearMoneda(resumenGeneral.ventas_total) : '…'}
            </span>
          </span>
          <BotonPrimario onClick={() => navigate('/ventas/nueva')}>Nueva venta</BotonPrimario>
        </div>
      </div>

      {isLoading || !resumen ? (
        <p>Cargando resumen de ventas…</p>
      ) : (
        <>
          <div className={styles.filaTresGraficas}>
            <GraficaLinea titulo="Ventas con envío" datos={mapear(resumen.con_envio)} color="var(--color-primario)" />
            <GraficaLinea titulo="Ventas sin envío" datos={mapear(resumen.sin_envio)} color="var(--color-secundario)" />
            <GraficaLinea titulo="Costo de envío" datos={mapear(resumen.envio)} color="var(--color-advertencia)" />
          </div>
          <div className={styles.filaUnaGrafica}>
            <GraficaBarras
              titulo="Ventas pendientes y entregadas"
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
