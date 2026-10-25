import { useState, type FormEvent } from 'react'

import type { CorteCaja } from '../../api/auditoria'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useCortesCaja, useCrearCorteCaja } from '../../hooks/useAuditoria'
import { formatearMoneda } from '../../utils/moneda'
import {
  ETIQUETAS_ESTADO_CORTE,
  claseDiferencia,
  claseEstadoRegistro,
  extraerMensajeError,
  formatearDiferencia,
  formatearFechaHora,
} from './formatoAuditoria'

const PATRON_MONTO = /^\d+(\.\d{1,2})?$/

export function PestanaCortesCaja() {
  const { data: cortes, isLoading } = useCortesCaja()
  // `null`: cerrado; `{}`: corte nuevo; `{ reemplaza }`: corrige un corte pendiente.
  const [formulario, setFormulario] = useState<{ reemplaza?: CorteCaja } | null>(null)

  const columnas: ColumnaTabla<CorteCaja>[] = [
    {
      clave: 'fecha_hora_corte',
      encabezado: 'Corte',
      render: (fila) => <span className="cellNoWrap">{formatearFechaHora(fila.fecha_hora_corte)}</span>,
    },
    {
      clave: 'monto_contado',
      alineacion: 'derecha',
      encabezado: 'Contado',
      render: (fila) => formatearMoneda(fila.monto_contado),
    },
    {
      clave: 'saldo_esperado',
      alineacion: 'derecha',
      encabezado: 'Saldo esperado',
      render: (fila) => (fila.saldo_esperado === null ? '—' : formatearMoneda(fila.saldo_esperado)),
    },
    {
      clave: 'diferencia',
      alineacion: 'derecha',
      encabezado: 'Diferencia',
      render: (fila) =>
        fila.diferencia === null ? (
          '—'
        ) : (
          <span className={claseDiferencia(fila.diferencia)}>{formatearDiferencia('caja_corte', fila.diferencia)}</span>
        ),
    },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstadoRegistro(fila.estado)}>{ETIQUETAS_ESTADO_CORTE[fila.estado]}</span>,
    },
    {
      clave: 'observacion',
      encabezado: 'Observación',
      render: (fila) => (
        <div className="cellStack">
          <span>{fila.observacion || '—'}</span>
          {fila.reemplaza && <span className="pageHint">Reemplaza al corte #{fila.reemplaza}</span>}
        </div>
      ),
    },
    { clave: 'usuario_nombre', encabezado: 'Registró' },
  ]

  return (
    <div className="tabPanel">
      <div className="sectionHeader">
        <p className="pageHint">
          Registra el efectivo contado al cerrar. La conciliación lo compara contra el saldo de la caja (incluidos los
          envíos) al momento del corte.
        </p>
        <BotonPrimario onClick={() => setFormulario({})}>Registrar corte</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando cortes…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={cortes ?? []}
          mensajeVacio="Todavía no hay cortes de caja registrados."
          renderAcciones={(fila) =>
            fila.estado === 'pendiente' ? (
              <button type="button" className="actionLink" onClick={() => setFormulario({ reemplaza: fila })}>
                Reemplazar
              </button>
            ) : null
          }
        />
      )}

      {formulario && <ModalCorteCaja reemplaza={formulario.reemplaza} onCerrar={() => setFormulario(null)} />}
    </div>
  )
}

function ModalCorteCaja({ reemplaza, onCerrar }: { reemplaza?: CorteCaja; onCerrar: () => void }) {
  const crear = useCrearCorteCaja()
  const [monto, setMonto] = useState('')
  // Vacío = ahora; el backend rechaza una fecha futura.
  const [fechaHora, setFechaHora] = useState('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState('')

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')
    if (!PATRON_MONTO.test(monto.trim())) {
      setError('Ingresa el monto contado, con máximo 2 decimales.')
      return
    }
    try {
      await crear.mutateAsync({
        monto_contado: monto.trim(),
        fecha_hora_corte: fechaHora ? new Date(fechaHora).toISOString() : undefined,
        observacion,
        reemplaza: reemplaza?.id,
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo registrar el corte. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo={reemplaza ? `Reemplazar corte #${reemplaza.id}` : 'Registrar corte de caja'} abierto onCerrar={onCerrar}>
      <form className="form" onSubmit={alGuardar} noValidate>
        {reemplaza && (
          <p className="notice">
            El corte #{reemplaza.id} ({formatearMoneda(reemplaza.monto_contado)}) quedará como reemplazado y ya no se
            auditará.
          </p>
        )}

        <label className="field">
          Monto contado
          <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>

        <label className="field">
          Fecha y hora del corte
          <input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} />
          <span className="fieldHint">Déjalo vacío para usar el momento actual.</span>
        </label>

        <label className="field">
          Observación (opcional)
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </label>

        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}

        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={onCerrar} disabled={crear.isPending}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Registrar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}
