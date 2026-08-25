import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { EstadoVenta, Venta } from '../../api/ventas'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { useVentas } from '../../hooks/useVentas'
import styles from './Ventas.module.css'

const ETIQUETAS_ESTADO: Record<EstadoVenta, string> = {
  pendiente: 'Pendiente',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
}

function claseEstado(estado: EstadoVenta) {
  if (estado === 'entregada') return styles.estadoEntregada
  if (estado === 'cancelada') return styles.estadoCancelada
  return styles.estadoPendiente
}

export function Ventas() {
  const navigate = useNavigate()
  const { data: sucursales } = useSucursales()
  const { data: clientes } = useClientes()
  const { data: productos } = useProductos()

  const [sucursalFiltro, setSucursalFiltro] = useState<number | ''>('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoVenta | ''>('')
  const [clienteFiltro, setClienteFiltro] = useState<number | ''>('')
  const [productoFiltro, setProductoFiltro] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: ventas, isLoading } = useVentas({
    sucursal: sucursalFiltro || undefined,
    estado: estadoFiltro || undefined,
    cliente: clienteFiltro || undefined,
    producto: productoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const columnas: ColumnaTabla<Venta>[] = [
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => new Date(fila.fecha).toLocaleDateString('es-MX') },
    { clave: 'cliente_nombre', encabezado: 'Cliente' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal' },
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
        <h1 className={styles.titulo}>Ventas</h1>
        <BotonPrimario onClick={() => navigate('/ventas/nueva')}>Nueva venta</BotonPrimario>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
          Sucursal
          <select
            value={sucursalFiltro}
            onChange={(e) => setSucursalFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todas</option>
            {(sucursales ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_sucursal}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.campoFiltro}>
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoVenta | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO) as EstadoVenta[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO[estado]}
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
          Producto
          <select
            value={productoFiltro}
            onChange={(e) => setProductoFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos</option>
            {(productos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_producto}
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
        <p>Cargando ventas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={ventas ?? []}
          mensajeVacio="Todavía no hay ventas registradas."
          renderAcciones={(fila) => (
            <button type="button" className={styles.enlaceAccion} onClick={() => navigate(`/ventas/${fila.id}`)}>
              Ver detalle
            </button>
          )}
        />
      )}
    </div>
  )
}
