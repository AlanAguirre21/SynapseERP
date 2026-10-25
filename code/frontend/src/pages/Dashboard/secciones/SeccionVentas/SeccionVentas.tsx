import { useNavigate } from 'react-router-dom'

import type { PeriodoProyeccion } from '../../../../api/analitica'
import type { PeriodoDashboard, PuntoMonto } from '../../../../api/reportes'
import { BotonPrimario } from '../../../../components/common/BotonPrimario'
import { formatearEtiquetaFecha, formatearMoneda } from '../../compartido/formato'
import { GraficaBarras } from '../../compartido/GraficaBarras'
import { etiquetaPeriodo } from '../../compartido/formatoPronostico'
import { GraficaLinea } from '../../compartido/GraficaLinea'
import { GraficaPronostico } from '../../compartido/GraficaPronostico'
import { useProyeccionDashboard } from '../../../../hooks/useAnalitica'
import { useResumenDashboard } from '../../../../hooks/useResumenDashboard'
import { useResumenVentas } from '../../../../hooks/useResumenVentas'
import styles from '../../compartido/SeccionOperacion.module.css'

interface SeccionVentasProps {
  periodo: PeriodoDashboard
  // 023: la proyección de ventas es solo para admin.
  esAdmin?: boolean
}

export function SeccionVentas({ periodo, esAdmin = false }: SeccionVentasProps) {
  const navigate = useNavigate()
  const { data: resumen, isLoading } = useResumenVentas(periodo)
  const { data: resumenGeneral } = useResumenDashboard(periodo)

  const mapear = (puntos: PuntoMonto[] = []) =>
    puntos.map((punto) => ({ etiqueta: formatearEtiquetaFecha(punto.fecha, periodo), valor: Number(punto.monto) }))

  const datosConteo = (resumen?.conteo_estado ?? []).map((fila) => ({ etiqueta: fila.tipo, valor: fila.cantidad }))

  return (
    <section className="card">
      <div className="sectionHeader">
        <h2 className="sectionTitle">Resumen de ventas</h2>
        <div className="headerActions">
          <span className={styles.indicator}>
            <span className={styles.indicatorLabel}>Ganancia de ventas</span>
            <span className={styles.indicatorAmount}>
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
          <div className={styles.chartRowThree}>
            <GraficaLinea titulo="Ventas con envío" datos={mapear(resumen.con_envio)} color="var(--color-primario)" />
            <GraficaLinea titulo="Ventas sin envío" datos={mapear(resumen.sin_envio)} color="var(--color-secundario)" />
            <GraficaLinea titulo="Costo de envío" datos={mapear(resumen.envio)} color="var(--color-inicio)" />
          </div>
          <div className={styles.chartRowOne}>
            <GraficaBarras
              titulo="Ventas pendientes y entregadas"
              datos={datosConteo}
              colores={['var(--color-advertencia)', 'var(--color-exito)']}
              etiquetaEjeY="Cantidad"
            />
          </div>
          {esAdmin && periodo !== 'dia' && <ProyeccionVentas periodo={periodo} />}
        </>
      )}
    </section>
  )
}

// Ventas reales del periodo + línea punteada de proyección sobre los periodos
// que faltan, con el pronóstico vigente (023). "Día" es por hora: sin proyección.
function ProyeccionVentas({ periodo }: { periodo: PeriodoProyeccion }) {
  const { data: proyeccion, isLoading } = useProyeccionDashboard(periodo)
  if (isLoading || !proyeccion) return <p>Cargando proyección…</p>

  const granularidad = proyeccion.granularidad
  const datos = [
    ...proyeccion.real.map((p) => ({ etiqueta: etiquetaPeriodo(p.periodo_inicio, granularidad), real: Number(p.valor) })),
    ...proyeccion.proyeccion.map((p) => ({
      etiqueta: etiquetaPeriodo(p.periodo_inicio, granularidad),
      pronostico: Number(p.valor),
      rango: [Number(p.limite_inferior), Number(p.limite_superior)] as [number, number],
    })),
  ]
  return (
    <div className={styles.chartRowOne}>
      <GraficaPronostico
        titulo={
          proyeccion.proyeccion.length > 0
            ? 'Ventas del periodo y proyección'
            : 'Ventas del periodo (sin pronóstico vigente para proyectar)'
        }
        datos={datos}
        etiquetaEjeY="Monto ($)"
        formatoValor={(valor) => formatearMoneda(valor)}
      />
    </div>
  )
}
