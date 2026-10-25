import { useState, type FormEvent } from 'react'

import type { DiscrepanciaAuditoria } from '../../api/auditoria'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useAjustarDiscrepancia, useJustificarDiscrepancia } from '../../hooks/useAuditoria'
import { ETIQUETAS_CATEGORIA, extraerMensajeError, formatearDiferencia, formatearValor } from './formatoAuditoria'

export type AccionResolver = 'ajustar' | 'justificar'

interface ModalResolverDiscrepanciaProps {
  discrepancia: DiscrepanciaAuditoria
  accion: AccionResolver
  onCerrar: () => void
}

export function ModalResolverDiscrepancia({ discrepancia, accion, onCerrar }: ModalResolverDiscrepanciaProps) {
  const ajustar = useAjustarDiscrepancia()
  const justificar = useJustificarDiscrepancia()
  const mutacion = accion === 'ajustar' ? ajustar : justificar

  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')

  const diferencia = Number(discrepancia.diferencia)
  const cantidad = formatearValor(discrepancia.categoria, String(Math.abs(diferencia)))

  async function alConfirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError('')
    if (accion === 'justificar' && !comentario.trim()) {
      setError('Escribe la justificación.')
      return
    }
    try {
      await mutacion.mutateAsync({ id: discrepancia.id, comentario: comentario.trim() })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo resolver la discrepancia. Intenta de nuevo.'))
    }
  }

  return (
    <Modal
      titulo={accion === 'ajustar' ? 'Ajustar stock' : 'Justificar discrepancia'}
      abierto
      onCerrar={onCerrar}
    >
      <form className="form" onSubmit={alConfirmar} noValidate>
        <dl className="factGrid">
          <div>
            <dt>Categoría</dt>
            <dd>{ETIQUETAS_CATEGORIA[discrepancia.categoria]}</dd>
          </div>
          <div>
            <dt>Detalle</dt>
            <dd>{discrepancia.descripcion}</dd>
          </div>
          <div>
            <dt>Esperado / registrado</dt>
            <dd>
              {formatearValor(discrepancia.categoria, discrepancia.valor_esperado)} /{' '}
              {formatearValor(discrepancia.categoria, discrepancia.valor_registrado)}
            </dd>
          </div>
          <div>
            <dt>Diferencia</dt>
            <dd>{formatearDiferencia(discrepancia.categoria, discrepancia.diferencia)}</dd>
          </div>
        </dl>

        {accion === 'ajustar' ? (
          <p className="confirmText">
            Se registrará una {diferencia > 0 ? 'entrada' : 'salida'} de <strong>{cantidad}</strong> de{' '}
            <strong>{discrepancia.item_nombre}</strong> en <strong>{discrepancia.sucursal_nombre}</strong> (movimiento
            de inventario con motivo «Ajuste»).
          </p>
        ) : (
          <p className="confirmText">
            La discrepancia se cerrará sin tocar el stock ni la caja.
            {discrepancia.tipo === 'caja' && ' Si hace falta corregir el saldo, registra un movimiento manual en Caja.'}
          </p>
        )}

        <label className="field">
          {accion === 'ajustar' ? 'Comentario (opcional)' : 'Justificación'}
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </label>

        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}

        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={onCerrar} disabled={mutacion.isPending}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario type="submit" disabled={mutacion.isPending}>
            {mutacion.isPending ? 'Guardando…' : accion === 'ajustar' ? 'Aplicar ajuste' : 'Justificar'}
          </BotonPrimario>
        </div>
      </form>
    </Modal>
  )
}
