import { useState } from 'react'

import type { ConteoFisico } from '../../api/auditoria'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useConteosFisicos, useDescartarConteoFisico } from '../../hooks/useAuditoria'
import {
  ETIQUETAS_ESTADO_CONTEO,
  ETIQUETAS_TIPO_ITEM,
  claseEstadoRegistro,
  extraerMensajeError,
  formatearFechaHora,
} from './formatoAuditoria'
import { ModalConteoFisico } from './ModalConteoFisico'

export function PestanaConteos({ esAdmin }: { esAdmin: boolean }) {
  const { data: conteos, isLoading } = useConteosFisicos()
  const descartar = useDescartarConteoFisico()
  const [capturando, setCapturando] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function descartarConteo(id: number) {
    setError('')
    try {
      await descartar.mutateAsync(id)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo descartar el conteo.'))
    }
  }

  const columnas: ColumnaTabla<ConteoFisico>[] = [
    {
      clave: 'fecha_conteo',
      encabezado: 'Fecha',
      render: (fila) => <span className="cellNoWrap">{formatearFechaHora(fila.fecha_conteo)}</span>,
    },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal' },
    {
      clave: 'detalles',
      alineacion: 'derecha',
      encabezado: 'Ítems',
      render: (fila) => (
        <button
          type="button"
          className="expandLink"
          aria-expanded={expandido === fila.id}
          onClick={() => setExpandido(expandido === fila.id ? null : fila.id)}
        >
          {fila.detalles.length} {expandido === fila.id ? '▴' : '▾'}
        </button>
      ),
    },
    { clave: 'usuario_nombre', encabezado: 'Contó' },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstadoRegistro(fila.estado)}>{ETIQUETAS_ESTADO_CONTEO[fila.estado]}</span>,
    },
    { clave: 'observacion', encabezado: 'Observación', render: (fila) => fila.observacion || '—' },
  ]

  return (
    <div className="tabPanel">
      <div className="sectionHeader">
        <p className="pageHint">
          El conteo es ciego: cuenta lo que hay físicamente sin ver el stock del sistema. La auditoría semanal lo
          compara con el stock registrado al momento del conteo.
        </p>
        <BotonPrimario onClick={() => setCapturando(true)}>Registrar conteo</BotonPrimario>
      </div>

      {error && (
        <p className="errorMessage" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p>Cargando conteos…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={conteos ?? []}
          mensajeVacio="Todavía no hay conteos físicos registrados."
          renderAcciones={
            esAdmin
              ? (fila) =>
                  fila.estado === 'pendiente' ? (
                    <button
                      type="button"
                      className="dangerActionLink"
                      onClick={() => descartarConteo(fila.id)}
                      disabled={descartar.isPending}
                    >
                      Descartar
                    </button>
                  ) : null
              : undefined
          }
          renderExpandido={(fila) =>
            expandido === fila.id ? (
              <div className="expandedSection">
                <table className="linesTable">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Ítem</th>
                      <th className="numeric">Contado</th>
                      {esAdmin && <th className="numeric">Stock del sistema</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {fila.detalles.map((detalle) => (
                      <tr key={detalle.id}>
                        <td>{ETIQUETAS_TIPO_ITEM[detalle.tipo_item]}</td>
                        <td>{detalle.item_nombre}</td>
                        <td className="numeric">{detalle.cantidad_contada}</td>
                        {esAdmin && <td className="numeric">{detalle.stock_teorico ?? '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null
          }
        />
      )}

      {capturando && <ModalConteoFisico onCerrar={() => setCapturando(false)} />}
    </div>
  )
}
