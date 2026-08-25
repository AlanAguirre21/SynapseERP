import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { PeriodoDashboard, PuntoResumenDashboard } from '../../api/reportes'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { useResumenDashboard } from '../../hooks/useResumenDashboard'
import styles from './Dashboard.module.css'

const ETIQUETAS_PERIODO: { clave: PeriodoDashboard; etiqueta: string }[] = [
  { clave: 'dia', etiqueta: 'Día' },
  { clave: 'semana', etiqueta: 'Semana' },
  { clave: 'mes', etiqueta: 'Mes' },
]

function formatearMoneda(valor: string) {
  return `$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatearEtiquetaFecha(fecha: string, periodo: PeriodoDashboard) {
  const valor = new Date(fecha)
  if (periodo === 'dia') {
    return valor.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return valor.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
}

export function Dashboard() {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('dia')
  const { data: resumen, isLoading } = useResumenDashboard(periodo)

  const sinDatos = !isLoading && resumen && Number(resumen.ventas_total) === 0 && Number(resumen.compras_total) === 0

  const datosGrafica = (resumen?.serie ?? []).map((punto: PuntoResumenDashboard) => ({
    etiqueta: formatearEtiquetaFecha(punto.fecha, periodo),
    ganancia: Number(punto.ganancia),
  }))

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Resumen FleboSil</h1>
        <div className={styles.accesosDirectos}>
          <BotonPrimario variante="secundario" onClick={() => navigate('/compras/nueva')}>
            Nueva compra
          </BotonPrimario>
          <BotonPrimario onClick={() => navigate('/ventas/nueva')}>Nueva venta</BotonPrimario>
        </div>
      </div>

      <div className={styles.controles}>
        <div className={styles.pestañas} role="tablist" aria-label="Periodo">
          {ETIQUETAS_PERIODO.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={periodo === p.clave}
              className={periodo === p.clave ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
              onClick={() => setPeriodo(p.clave)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tarjetas}>
        <div className={styles.tarjeta}>
          <span className={styles.tarjetaEtiqueta}>Ventas totales</span>
          <span className={styles.tarjetaMonto}>{isLoading || !resumen ? '…' : formatearMoneda(resumen.ventas_total)}</span>
        </div>

        <div className={styles.tarjeta}>
          <span className={styles.tarjetaEtiqueta}>Compras totales</span>
          <span className={styles.tarjetaMonto}>{isLoading || !resumen ? '…' : formatearMoneda(resumen.compras_total)}</span>
        </div>

        <div
          className={`${styles.tarjeta} ${
            resumen && Number(resumen.ganancia) < 0 ? styles.tarjetaGananciaNegativa : styles.tarjetaGananciaPositiva
          }`}
        >
          <span className={styles.tarjetaEtiqueta}>Ganancia del periodo</span>
          <span className={styles.tarjetaMonto}>{isLoading || !resumen ? '…' : formatearMoneda(resumen.ganancia)}</span>
        </div>
      </div>

      {isLoading || !resumen ? (
        <p>Cargando resumen…</p>
      ) : sinDatos ? (
        <div className={styles.estadoVacio}>
          <span className={styles.estadoVacioTitulo}>Todavía no hay suficientes datos para este periodo</span>
          <span>Registra una venta o compra para empezar a ver aquí la evolución de ganancias.</span>
        </div>
      ) : (
        <div className={styles.graficaContenedor}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datosGrafica} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-texto)" opacity={0.1} />
              <XAxis dataKey="etiqueta" stroke="var(--color-texto)" opacity={0.6} fontSize={12} />
              <YAxis stroke="var(--color-texto)" opacity={0.6} fontSize={12} />
              <Tooltip
                formatter={(valor) => [`$${Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Ganancia']}
              />
              <Line type="monotone" dataKey="ganancia" stroke="var(--color-primario)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
