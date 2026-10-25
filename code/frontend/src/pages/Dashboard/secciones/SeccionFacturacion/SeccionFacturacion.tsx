import { Link } from 'react-router-dom'

import { ETIQUETAS_ESTADO_FACTURA, type EstadoFactura } from '../../../../api/facturacion'
import type { FacturaPorAtender, PeriodoDashboard, PuntoFacturacion } from '../../../../api/reportes'
import { Tabla, type ColumnaTabla } from '../../../../components/common/Tabla'
import { useResumenFacturacion } from '../../../../hooks/useResumenFacturacion'
import { formatearEtiquetaFecha, formatearMoneda } from '../../compartido/formato'
import { GraficaBarras } from '../../compartido/GraficaBarras'
import { GraficaLinea } from '../../compartido/GraficaLinea'
import styles from '../../compartido/SeccionOperacion.module.css'

// Sección 6 del Dashboard — `016`, "Actualización: Resumen facturación con
// datos". Mismo contenido para admin y operador.

interface SeccionFacturacionProps {
  periodo: PeriodoDashboard
}

const CLASES_ESTADO: Record<EstadoFactura, string> = {
  timbrada: 'status statusSuccess',
  pendiente: 'status statusWarning',
  error: 'status statusError',
  pendiente_cancelacion: 'status statusWarning',
  cancelada: 'status statusNeutral',
}

// Mismo orden que `conteo_estado`: Timbrada, Pendiente, Error, Pendiente de cancelación, Cancelada.
const COLORES_ESTADO = [
  'var(--color-exito)',
  'var(--color-advertencia)',
  'var(--color-error)',
  'var(--color-inicio)',
  'var(--color-texto-suave)',
]

function folio(factura: FacturaPorAtender): string {
  return factura.serie && factura.folio_interno !== null
    ? `${factura.serie}-${factura.folio_interno}`
    : `Factura #${factura.id}`
}

function formatearPorcentaje(valor: string | null): string {
  if (valor === null) return '—'
  return `${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

const COLUMNAS_ATENCION: ColumnaTabla<FacturaPorAtender>[] = [
  {
    clave: 'id',
    encabezado: 'Factura',
    render: (fila) => (
      <Link to={`/facturacion/${fila.id}`} className="link">
        {folio(fila)}
      </Link>
    ),
  },
  { clave: 'cliente', encabezado: 'Cliente' },
  { clave: 'total', encabezado: 'Importe', alineacion: 'derecha', render: (fila) => formatearMoneda(fila.total) },
  {
    clave: 'estado',
    encabezado: 'Estado',
    render: (fila) => <span className={CLASES_ESTADO[fila.estado]}>{ETIQUETAS_ESTADO_FACTURA[fila.estado]}</span>,
  },
]

export function SeccionFacturacion({ periodo }: SeccionFacturacionProps) {
  const { data: resumen, isLoading } = useResumenFacturacion(periodo)

  const mapear = (campo: 'total' | 'pue' | 'ppd', puntos: PuntoFacturacion[] = []) =>
    puntos.map((punto) => ({ etiqueta: formatearEtiquetaFecha(punto.fecha, periodo), valor: Number(punto[campo]) }))

  const datosConteo = (resumen?.conteo_estado ?? []).map((fila) => ({ etiqueta: fila.tipo, valor: fila.cantidad }))
  const porCobrar = resumen ? Number(resumen.por_cobrar_ppd) : 0

  return (
    <section className="card">
      <h2 className="sectionTitle">Resumen facturación</h2>

      {isLoading || !resumen ? (
        <p>Cargando resumen de facturación…</p>
      ) : (
        <>
          <div className="statRow">
            <div className="statTile">
              <span className="statLabel">Facturado</span>
              <span className="statValue">{formatearMoneda(resumen.facturado_total)}</span>
            </div>
            <div className="statTile">
              <span className="statLabel">Facturas emitidas</span>
              <span className="statValue">{resumen.facturas_emitidas}</span>
            </div>
            <div className={porCobrar > 0 ? 'statTile statTileWarning' : 'statTile'}>
              <span className="statLabel">Por cobrar (PPD)</span>
              <span className="statValue">{formatearMoneda(resumen.por_cobrar_ppd)}</span>
            </div>
            <div className="statTile">
              <span className="statLabel">% de ventas facturadas</span>
              <span className="statValue">{formatearPorcentaje(resumen.porcentaje_facturado)}</span>
            </div>
          </div>

          <div className={styles.chartRowThree}>
            <GraficaLinea titulo="Facturado total" datos={mapear('total', resumen.serie)} color="var(--color-primario)" />
            <GraficaLinea titulo="Facturado PUE" datos={mapear('pue', resumen.serie)} color="var(--color-secundario)" />
            <GraficaLinea titulo="Facturado PPD" datos={mapear('ppd', resumen.serie)} color="var(--color-inicio)" />
          </div>
          <div className={styles.chartRowOne}>
            <GraficaBarras
              titulo="Facturas por estado"
              datos={datosConteo}
              colores={COLORES_ESTADO}
              etiquetaEjeY="Cantidad"
            />
          </div>

          <div className="sectionHeader">
            <div className="pageHeading">
              <h3 className="subtitle">Requiere atención</h3>
              <span className="fieldHint">
                Facturas con error de timbrado o pendientes de cancelación, sin importar el periodo.
              </span>
            </div>
            <Link to="/facturacion" className="link">
              Ver todas en Facturación
            </Link>
          </div>
          <Tabla
            columnas={COLUMNAS_ATENCION}
            datos={resumen.requiere_atencion}
            mensajeVacio="No hay facturas que requieran atención."
          />
        </>
      )}
    </section>
  )
}
