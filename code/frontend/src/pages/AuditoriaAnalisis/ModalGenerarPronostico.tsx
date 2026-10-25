import { useState } from 'react'

import type { GranularidadPronostico } from '../../api/analitica'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useGenerarPronosticos } from '../../hooks/useAnalitica'
import { ETIQUETAS_GRANULARIDAD } from '../Dashboard/compartido/formatoPronostico'
import { extraerMensajeError } from './formatoAuditoria'

type Modo = 'estandar' | 'personalizado'

// Límites de periodos por granularidad (los valida también el backend).
const MAXIMO_PERIODOS: Record<GranularidadPronostico, string> = {
  dia: 'hasta 90 días',
  semana: 'hasta 26 semanas',
  mes: 'hasta 12 meses',
}

export function ModalGenerarPronostico({ onCerrar }: { onCerrar: () => void }) {
  const generar = useGenerarPronosticos()
  const [modo, setModo] = useState<Modo>('estandar')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [granularidad, setGranularidad] = useState<GranularidadPronostico>('semana')
  const [error, setError] = useState('')

  async function confirmar() {
    setError('')
    if (modo === 'personalizado' && (!desde || !hasta)) {
      setError('Elige la fecha inicial y la final del rango.')
      return
    }
    try {
      await generar.mutateAsync(modo === 'estandar' ? {} : { horizonte: 'personalizado', desde, hasta, granularidad })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudieron generar los pronósticos. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Generar pronósticos" abierto onCerrar={onCerrar}>
      <div className="form">
        <div className="segmented" role="group" aria-label="Tipo de generación">
          <button
            type="button"
            className={modo === 'estandar' ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
            aria-pressed={modo === 'estandar'}
            onClick={() => setModo('estandar')}
          >
            Horizontes estándar
          </button>
          <button
            type="button"
            className={modo === 'personalizado' ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
            aria-pressed={modo === 'personalizado'}
            onClick={() => setModo('personalizado')}
          >
            Rango personalizado
          </button>
        </div>

        {modo === 'estandar' ? (
          <p className="confirmText">Se generarán los pronósticos de los próximos 7 días, 4 semanas y 3 meses.</p>
        ) : (
          <>
            <div className="fieldRow">
              <label className="field">
                Desde
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label className="field">
                Hasta
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </label>
            </div>
            <label className="field">
              Granularidad
              <select value={granularidad} onChange={(e) => setGranularidad(e.target.value as GranularidadPronostico)}>
                {(Object.keys(ETIQUETAS_GRANULARIDAD) as GranularidadPronostico[]).map((g) => (
                  <option key={g} value={g}>
                    {ETIQUETAS_GRANULARIDAD[g]}
                  </option>
                ))}
              </select>
              <span className="fieldHint">Fechas futuras, {MAXIMO_PERIODOS[granularidad]}.</span>
            </label>
          </>
        )}

        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}

        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={onCerrar} disabled={generar.isPending}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmar} disabled={generar.isPending}>
            {generar.isPending ? 'Generando…' : 'Generar'}
          </BotonPrimario>
        </div>
      </div>
    </Modal>
  )
}
