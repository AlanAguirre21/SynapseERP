import { useState } from 'react'

import type { ConfianzaAsistente, MensajeRegistroAsistente } from '../../api/asistente'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useRegistroAsistente } from '../../hooks/useAsistente'
import { useUsuarios } from '../../hooks/useUsuarios'
import { formatearFechaHora } from './formatoAuditoria'

const ETIQUETAS_CONFIANZA: Record<ConfianzaAsistente, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  boton: 'Botón',
}

// Espejo de las intenciones de `apps/asistente/catalogo.py` (versión del catálogo actual).
const ETIQUETAS_INTENCION: Record<string, string> = {
  ventas_total: 'Total vendido',
  ventas_numero: 'Número de ventas',
  ventas_top_productos: 'Productos más vendidos',
  ventas_top_clientes: 'Clientes con más compras',
  ganancia_periodo: 'Ganancia',
  compras_total: 'Total comprado',
  compras_numero: 'Número de compras',
  compras_top_proveedores: 'Proveedores con más compras',
  pronostico_ventas: 'Pronóstico de ventas',
  pronostico_demanda: 'Demanda pronosticada',
  pronostico_clientes: 'Crecimiento de clientes',
  menu: 'Menú principal',
  ayuda: 'Ayuda',
}

function claseConfianza(confianza: ConfianzaAsistente): string {
  if (confianza === 'alta') return 'status statusSuccess'
  if (confianza === 'media') return 'status statusWarning'
  if (confianza === 'baja') return 'status statusError'
  return 'status statusNeutral'
}

// Registro de auditoría del asistente (024), solo admin. "Solo dudosas" lista
// las preguntas escritas de confianza media o baja: la materia prima para
// ampliar las frases de ejemplo del catálogo en la siguiente versión.
export function PestanaRegistroAsistente() {
  const { data: usuarios } = useUsuarios()
  const [usuario, setUsuario] = useState<number | ''>('')
  const [intencion, setIntencion] = useState('')
  const [confianza, setConfianza] = useState<ConfianzaAsistente | ''>('')
  const [soloDudosas, setSoloDudosas] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: mensajes, isLoading } = useRegistroAsistente({
    usuario: usuario || undefined,
    intencion: intencion || undefined,
    confianza: confianza || undefined,
    solo_dudosas: soloDudosas ? 'true' : undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const columnas: ColumnaTabla<MensajeRegistroAsistente>[] = [
    {
      clave: 'fecha',
      encabezado: 'Fecha',
      render: (fila) => <span className="cellNoWrap">{formatearFechaHora(fila.fecha)}</span>,
    },
    { clave: 'usuario_nombre', encabezado: 'Usuario' },
    {
      clave: 'entrada_texto',
      encabezado: 'Pregunta',
      render: (fila) =>
        fila.entrada_tipo === 'texto' ? `«${fila.entrada_texto}»` : <span className="pageHint">Botón: {fila.nodo_solicitado}</span>,
    },
    {
      clave: 'confianza',
      encabezado: 'Entendió',
      render: (fila) => (
        <div className="cellStack">
          <span className={claseConfianza(fila.confianza)}>
            {ETIQUETAS_CONFIANZA[fila.confianza]}
            {fila.puntuacion !== null && ` · ${Number(fila.puntuacion).toFixed(2)}`}
          </span>
          <span className="pageHint">{ETIQUETAS_INTENCION[fila.intencion] ?? (fila.intencion || '—')}</span>
        </div>
      ),
    },
    { clave: 'respuesta_texto', encabezado: 'Respuesta' },
  ]

  return (
    <div className="tabPanel">
      <div className="filters">
        <label className="filterField">
          Usuario
          <select value={usuario} onChange={(e) => setUsuario(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todos</option>
            {(usuarios ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {`${u.first_name} ${u.last_name}`.trim() || u.username}
              </option>
            ))}
          </select>
        </label>
        <label className="filterField">
          Intención
          <select value={intencion} onChange={(e) => setIntencion(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ETIQUETAS_INTENCION).map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="filterField">
          Confianza
          <select value={confianza} onChange={(e) => setConfianza(e.target.value as ConfianzaAsistente | '')}>
            <option value="">Todas</option>
            {(Object.keys(ETIQUETAS_CONFIANZA) as ConfianzaAsistente[]).map((c) => (
              <option key={c} value={c}>
                {ETIQUETAS_CONFIANZA[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="filterField">
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label className="filterField">
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
        <label className="fieldCheckbox">
          <input type="checkbox" checked={soloDudosas} onChange={(e) => setSoloDudosas(e.target.checked)} />
          Solo preguntas dudosas (confianza media o baja)
        </label>
      </div>

      {isLoading ? (
        <p>Cargando registro…</p>
      ) : (
        <Tabla columnas={columnas} datos={mensajes ?? []} mensajeVacio="Todavía no hay conversaciones registradas." />
      )}
    </div>
  )
}
