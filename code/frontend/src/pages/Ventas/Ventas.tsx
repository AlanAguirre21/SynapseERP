import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

<<<<<<< HEAD
import type { EstadoVenta, Venta } from '../../api/ventas'
=======
import { ETIQUETAS_ESTADO_VENTA, type EstadoVenta, type Venta } from '../../api/ventas'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
<<<<<<< HEAD
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
=======
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { useUsuarios } from '../../hooks/useUsuarios'
import { useVentas } from '../../hooks/useVentas'
import { formatearMoneda } from '../../utils/moneda'

function claseEstado(estado: EstadoVenta) {
  if (estado === 'entregada') return 'status statusSuccess'
  if (estado === 'cancelada') return 'status statusError'
  return 'status statusWarning'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
}

export function Ventas() {
  const navigate = useNavigate()
  const { data: sucursales } = useSucursales()
  const { data: clientes } = useClientes()
  const { data: productos } = useProductos()
<<<<<<< HEAD
=======
  // El operador solo ve las ventas que él registró (el backend las filtra);
  // el admin ve todas y puede filtrar por quién las registró.
  const { data: usuarioActual } = useUsuarioActual()
  const esAdmin = usuarioActual?.rol === 'admin'
  const { data: usuarios } = useUsuarios(esAdmin)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

  const [sucursalFiltro, setSucursalFiltro] = useState<number | ''>('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoVenta | ''>('')
  const [clienteFiltro, setClienteFiltro] = useState<number | ''>('')
  const [productoFiltro, setProductoFiltro] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
<<<<<<< HEAD
=======
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | ''>('')
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

  const { data: ventas, isLoading } = useVentas({
    sucursal: sucursalFiltro || undefined,
    estado: estadoFiltro || undefined,
    cliente: clienteFiltro || undefined,
    producto: productoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
<<<<<<< HEAD
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
=======
    usuario: (esAdmin && usuarioFiltro) || undefined,
  })

  const columnas: ColumnaTabla<Venta>[] = [
    { clave: 'id', encabezado: 'Folio', render: (fila) => `#${fila.id}` },
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => new Date(fila.fecha).toLocaleDateString('es-MX') },
    { clave: 'cliente_nombre', encabezado: 'Cliente' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal' },
    ...(esAdmin ? [{ clave: 'usuario_nombre' as const, encabezado: 'Registrada por' }] : []),
    { clave: 'total', alineacion: 'derecha', encabezado: 'Total', render: (fila) => formatearMoneda(fila.total) },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstado(fila.estado)}>{ETIQUETAS_ESTADO_VENTA[fila.estado]}</span>,
    },
  ]

  // Indicadores sobre la lista ya filtrada por el backend; el importe no cuenta las canceladas.
  const lista = ventas ?? []
  const vigentes = lista.filter((venta) => venta.estado !== 'cancelada')
  const importe = vigentes.reduce((acumulado, venta) => acumulado + Number(venta.total), 0)
  const pendientes = lista.filter((venta) => venta.estado === 'pendiente').length
  const entregadas = lista.filter((venta) => venta.estado === 'entregada').length

  const hayFiltros = Boolean(
    sucursalFiltro || estadoFiltro || clienteFiltro || productoFiltro || fechaDesde || fechaHasta || usuarioFiltro,
  )

  function limpiarFiltros() {
    setSucursalFiltro('')
    setEstadoFiltro('')
    setClienteFiltro('')
    setProductoFiltro('')
    setFechaDesde('')
    setFechaHasta('')
    setUsuarioFiltro('')
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Ventas</h1>
          <p className="pageHint">
            {esAdmin
              ? 'Consulta las ventas registradas y da seguimiento a sus entregas.'
              : 'Tus ventas registradas: consúltalas y da seguimiento a sus entregas.'}
          </p>
        </div>
        <BotonPrimario onClick={() => navigate('/ventas/nueva')}>Nueva venta</BotonPrimario>
      </div>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Ventas</span>
          <span className="statValue">{ventas ? lista.length : '…'}</span>
        </div>
        <div className="statTile statTileSale">
          <span className="statLabel">Importe vendido</span>
          <span className="statValue">{ventas ? formatearMoneda(importe) : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Pendientes de entrega</span>
          <span className="statValue">{ventas ? pendientes : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Entregadas</span>
          <span className="statValue">{ventas ? entregadas : '…'}</span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoVenta | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO) as EstadoVenta[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO[estado]}
=======
        <label className="filterField">
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoVenta | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO_VENTA) as EstadoVenta[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO_VENTA[estado]}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              </option>
            ))}
          </select>
        </label>

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
=======
        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
=======
        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
=======
        {esAdmin && (
          <label className="filterField">
            Registrada por
            <select
              value={usuarioFiltro}
              onChange={(e) => setUsuarioFiltro(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Todos</option>
              {(usuarios ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.first_name} ${u.last_name}`.trim() || u.username}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

<<<<<<< HEAD
        <label className={styles.campoFiltro}>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
=======
        <label className="filterField">
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      </div>

      {isLoading ? (
        <p>Cargando ventas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={ventas ?? []}
<<<<<<< HEAD
          mensajeVacio="Todavía no hay ventas registradas."
          renderAcciones={(fila) => (
            <button type="button" className={styles.enlaceAccion} onClick={() => navigate(`/ventas/${fila.id}`)}>
=======
          mensajeVacio={
            hayFiltros
              ? 'Ninguna venta coincide con los filtros.'
              : esAdmin
                ? 'Todavía no hay ventas registradas.'
                : 'Todavía no has registrado ventas.'
          }
          renderAcciones={(fila) => (
            <button type="button" className="actionLink" onClick={() => navigate(`/ventas/${fila.id}`)}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              Ver detalle
            </button>
          )}
        />
      )}
    </div>
  )
}
