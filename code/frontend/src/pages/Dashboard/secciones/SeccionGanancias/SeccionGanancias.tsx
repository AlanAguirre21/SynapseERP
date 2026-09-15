import { useState } from 'react'

import type { LimiteMovimientos, PeriodoDashboard } from '../../../../api/reportes'
import { formatearEtiquetaFecha, formatearFechaMovimiento, formatearMoneda } from '../../compartido/formato'
import { GraficaLinea } from '../../compartido/GraficaLinea'
import { useMovimientosCajaDashboard } from '../../../../hooks/useMovimientosCajaDashboard'
import { useResumenDashboard } from '../../../../hooks/useResumenDashboard'
import styles from './SeccionGanancias.module.css'

interface SeccionGananciasProps {
  periodo: PeriodoDashboard
}

const OPCIONES_LIMITE: { valor: LimiteMovimientos; etiqueta: string }[] = [
  { valor: '5', etiqueta: '5' },
  { valor: '10', etiqueta: '10' },
  { valor: 'todos', etiqueta: 'Todos' },
]

const ETIQUETA_TIPO: Record<string, string> = { ingreso: 'Ingreso', retiro: 'Retiro' }

export function SeccionGanancias({ periodo }: SeccionGananciasProps) {
  const { data: resumen, isLoading } = useResumenDashboard(periodo)
  const [limite, setLimite] = useState<LimiteMovimientos>('5')
  const { data: movimientos, isLoading: cargandoMovimientos } = useMovimientosCajaDashboard(periodo, limite)

  const datosGrafica = (resumen?.serie ?? []).map((punto) => ({
    etiqueta: formatearEtiquetaFecha(punto.fecha, periodo),
    valor: Number(punto.ganancia),
  }))

  const sinDatos = !isLoading && resumen && Number(resumen.ventas_total) === 0 && Number(resumen.compras_total) === 0

  return (
    <section className={styles.seccion}>
      <h2 className={styles.tituloSeccion}>Ganancias del periodo</h2>

      <div
        className={`${styles.tarjetaGanancia} ${
          resumen && Number(resumen.ganancia) < 0 ? styles.gananciaNegativa : styles.gananciaPositiva
        }`}
      >
        <span className={styles.gananciaEtiqueta}>Ganancia del periodo</span>
        <span className={styles.gananciaMonto}>{isLoading || !resumen ? '…' : formatearMoneda(resumen.ganancia)}</span>
      </div>

      {isLoading || !resumen ? (
        <p>Cargando resumen…</p>
      ) : sinDatos ? (
        <div className={styles.estadoVacio}>
          <span className={styles.estadoVacioTitulo}>Todavía no hay suficientes datos para este periodo</span>
          <span>Registra una venta o compra para empezar a ver aquí la evolución de ganancias.</span>
        </div>
      ) : (
        <GraficaLinea titulo="Evolución de ganancia" datos={datosGrafica} color="var(--color-primario)" />
      )}

      <div className={styles.movimientos}>
        <div className={styles.movimientosEncabezado}>
          <h3 className={styles.movimientosTitulo}>Movimientos financieros del periodo</h3>
          <div className={styles.selectorLimite} role="group" aria-label="Cantidad de movimientos a mostrar">
            {OPCIONES_LIMITE.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                className={
                  limite === opcion.valor ? `${styles.opcionLimite} ${styles.opcionLimiteActiva}` : styles.opcionLimite
                }
                aria-pressed={limite === opcion.valor}
                onClick={() => setLimite(opcion.valor)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.listaContenedor}>
          <div className={styles.listaContenido}>
            {cargandoMovimientos || !movimientos ? (
              <p className={styles.listaMensaje}>Cargando movimientos…</p>
            ) : movimientos.length === 0 ? (
              <p className={styles.listaMensaje}>No hay movimientos de caja en este periodo.</p>
            ) : (
              <ul className={styles.lista}>
                {movimientos.map((movimiento, indice) => (
                  <li key={`${movimiento.fecha}-${indice}`} className={styles.movimientoFila}>
                    <span className={styles.movimientoFecha}>{formatearFechaMovimiento(movimiento.fecha)}</span>
                    <span
                      className={
                        movimiento.tipo_movimiento === 'ingreso'
                          ? styles.movimientoTipoIngreso
                          : styles.movimientoTipoRetiro
                      }
                    >
                      {ETIQUETA_TIPO[movimiento.tipo_movimiento]}
                    </span>
                    <span className={styles.movimientoDescripcion}>{movimiento.observacion}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
