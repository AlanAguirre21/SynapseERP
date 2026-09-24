import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ETIQUETAS_ESTADO_FACTURA, type EstadoFactura, type Factura } from '../../api/facturacion'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useClientes } from '../../hooks/useClientes'
import { useFacturas } from '../../hooks/useFacturas'
import styles from './Facturacion.module.css'

function claseEstado(estado: EstadoFactura) {
  if (estado === 'timbrada') return styles.estadoTimbrada
  if (estado === 'cancelada') return styles.estadoCancelada
  if (estado === 'error') return styles.estadoError
  if (estado === 'pendiente_cancelacion') return styles.estadoPendienteCancelacion
  return styles.estadoPendiente
}

export function Facturacion() {
  const navigate = useNavigate()
  const { data: clientes } = useClientes()

  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFactura | ''>('')
  const [clienteFiltro, setClienteFiltro] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: facturas, isLoading } = useFacturas({
    estado: estadoFiltro || undefined,
    cliente: clienteFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const columnas: ColumnaTabla<Factura>[] = [
    {
      clave: 'fecha_creacion',
      encabezado: 'Fecha',
      render: (fila) => new Date(fila.fecha_creacion).toLocaleDateString('es-MX'),
    },
    { clave: 'cliente_nombre', encabezado: 'Cliente' },
    {
      clave: 'folio_fiscal',
      encabezado: 'Folio fiscal',
      render: (fila) => (fila.serie && fila.folio_interno ? `${fila.serie}-${fila.folio_interno}` : '—'),
    },
    { clave: 'venta_total', encabezado: 'Total' },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstado(fila.estado)}>{ETIQUETAS_ESTADO_FACTURA[fila.estado]}</span>,
    },
  ]

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Facturación</h1>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoFactura | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO_FACTURA) as EstadoFactura[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO_FACTURA[estado]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campoFiltro}>
          Cliente
          <select
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos</option>
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_cliente}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campoFiltro}>
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

        <label className={styles.campoFiltro}>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
      </div>

      {isLoading ? (
        <p>Cargando facturas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={facturas ?? []}
          mensajeVacio="Todavía no hay facturas generadas."
          renderAcciones={(fila) => (
            <button type="button" className={styles.enlaceAccion} onClick={() => navigate(`/facturacion/${fila.id}`)}>
              Ver detalle
            </button>
          )}
        />
      )}
    </div>
  )
}
