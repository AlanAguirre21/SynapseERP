import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { Compra, EstadoCompra } from '../../api/compras'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useCompras } from '../../hooks/useCompras'
import { useProveedores } from '../../hooks/useProveedores'
import styles from './Compras.module.css'

const ETIQUETAS_ESTADO: Record<EstadoCompra, string> = {
  pendiente: 'Pendiente',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

function claseEstado(estado: EstadoCompra) {
  if (estado === 'recibida') return styles.estadoRecibida
  if (estado === 'cancelada') return styles.estadoCancelada
  return styles.estadoPendiente
}

export function Compras() {
  const navigate = useNavigate()
  const { data: proveedores } = useProveedores()

  const [proveedorFiltro, setProveedorFiltro] = useState<number | ''>('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoCompra | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: compras, isLoading } = useCompras({
    proveedor: proveedorFiltro || undefined,
    estado: estadoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const columnas: ColumnaTabla<Compra>[] = [
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => new Date(fila.fecha).toLocaleDateString('es-MX') },
    { clave: 'proveedor_nombre', encabezado: 'Proveedor' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal destino' },
    { clave: 'total', encabezado: 'Total' },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstado(fila.estado)}>{ETIQUETAS_ESTADO[fila.estado]}</span>,
    },
  ]

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Compras</h1>
        <BotonPrimario onClick={() => navigate('/compras/nueva')}>Nueva compra</BotonPrimario>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
          Proveedor
          <select
            value={proveedorFiltro}
            onChange={(e) => setProveedorFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos</option>
            {(proveedores ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_proveedor}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campoFiltro}>
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoCompra | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO) as EstadoCompra[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO[estado]}
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
        <p>Cargando compras…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={compras ?? []}
          mensajeVacio="Todavía no hay compras registradas."
          renderAcciones={(fila) => (
            <button type="button" className={styles.enlaceAccion} onClick={() => navigate(`/compras/${fila.id}`)}>
              Ver detalle
            </button>
          )}
        />
      )}
    </div>
  )
}
