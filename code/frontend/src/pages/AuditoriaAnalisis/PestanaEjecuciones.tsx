import { useState } from 'react'

import { descargarReporteEjecucion, type EjecucionAuditoria, type TipoAuditoria } from '../../api/auditoria'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useEjecucionesAuditoria, useEjecutarAuditoria } from '../../hooks/useAuditoria'
import {
  ETIQUETAS_ESTADO_EJECUCION,
  ETIQUETAS_ORIGEN,
  ETIQUETAS_TIPO_AUDITORIA,
  claseEstadoEjecucion,
  extraerMensajeError,
  formatearFechaHora,
} from './formatoAuditoria'

export function PestanaEjecuciones() {
  const [tipo, setTipo] = useState<TipoAuditoria | ''>('')
  const { data: ejecuciones, isLoading } = useEjecucionesAuditoria(tipo || undefined)
  const ejecutar = useEjecutarAuditoria()
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  async function ejecutarAhora(tipoAuditoria: TipoAuditoria) {
    setMensaje('')
    setError('')
    try {
      const ejecucion = await ejecutar.mutateAsync(tipoAuditoria)
      if (ejecucion.estado === 'fallida') {
        setError(`La ${ETIQUETAS_TIPO_AUDITORIA[tipoAuditoria].toLowerCase()} falló: ${ejecucion.mensaje_error}`)
      } else {
        setMensaje(
          `${ETIQUETAS_TIPO_AUDITORIA[tipoAuditoria]}: ${ejecucion.elementos_revisados} elemento(s) revisado(s), ` +
            `${ejecucion.discrepancias_encontradas} discrepancia(s).`,
        )
      }
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo ejecutar la auditoría. Intenta de nuevo.'))
    }
  }

  async function verReporte(id: number) {
    setError('')
    try {
      const blob = await descargarReporteEjecucion(id)
      window.open(URL.createObjectURL(blob), '_blank')
    } catch {
      setError('No se pudo generar el reporte en PDF.')
    }
  }

  const columnas: ColumnaTabla<EjecucionAuditoria>[] = [
    {
      clave: 'fecha_inicio',
      encabezado: 'Inicio',
      render: (fila) => <span className="cellNoWrap">{formatearFechaHora(fila.fecha_inicio)}</span>,
    },
    { clave: 'tipo', encabezado: 'Tipo', render: (fila) => ETIQUETAS_TIPO_AUDITORIA[fila.tipo] },
    {
      clave: 'origen',
      encabezado: 'Origen',
      render: (fila) =>
        fila.iniciada_por_nombre ? `${ETIQUETAS_ORIGEN[fila.origen]} · ${fila.iniciada_por_nombre}` : ETIQUETAS_ORIGEN[fila.origen],
    },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => (
        <div className="cellStack">
          <span className={claseEstadoEjecucion(fila.estado)}>{ETIQUETAS_ESTADO_EJECUCION[fila.estado]}</span>
          {fila.mensaje_error && <span className="pageHint">{fila.mensaje_error}</span>}
        </div>
      ),
    },
    { clave: 'elementos_revisados', alineacion: 'derecha', encabezado: 'Revisados' },
    { clave: 'discrepancias_encontradas', alineacion: 'derecha', encabezado: 'Discrepancias' },
  ]

  return (
    <div className="tabPanel">
      <div className="sectionHeader">
        <label className="filterField">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAuditoria | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_TIPO_AUDITORIA) as TipoAuditoria[]).map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO_AUDITORIA[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="pageActions">
          <BotonPrimario variante="secundario" onClick={() => ejecutarAhora('caja')} disabled={ejecutar.isPending}>
            Ejecutar conciliación de caja
          </BotonPrimario>
          <BotonPrimario onClick={() => ejecutarAhora('inventario')} disabled={ejecutar.isPending}>
            Ejecutar auditoría de inventario
          </BotonPrimario>
        </div>
      </div>

      <p className="pageHint">
        Programadas: conciliación de caja todos los días a las 23:30 y auditoría de inventario los domingos a las 23:45.
      </p>

      {ejecutar.isPending && <p>Ejecutando…</p>}
      {mensaje && (
        <p className="successMessage" role="status">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="errorMessage" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p>Cargando ejecuciones…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={ejecuciones ?? []}
          mensajeVacio="Todavía no hay ejecuciones registradas."
          renderAcciones={(fila) =>
            fila.estado === 'en_curso' ? null : (
              <button type="button" className="actionLink" onClick={() => verReporte(fila.id)}>
                Ver reporte
              </button>
            )
          }
        />
      )}
    </div>
  )
}
