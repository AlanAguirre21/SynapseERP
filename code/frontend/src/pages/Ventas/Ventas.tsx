import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ETIQUETAS_ESTADO_VENTA, type EstadoVenta, type Venta } from '../../api/ventas'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { useUsuarios } from '../../hooks/useUsuarios'
import { useVentas } from '../../hooks/useVentas'
import { formatearMoneda } from '../../utils/moneda'
import { PronosticoVinculado } from '../Dashboard/compartido/PronosticoVinculado'

function claseEstado(estado: EstadoVenta) {
  if (estado === 'entregada') return 'status statusSuccess'
  if (estado === 'cancelada') return 'status statusError'
  return 'status statusWarning'
}

export function Ventas() {
  const navigate = useNavigate()
  const { data: sucursales } = useSucursales()
  const { data: clientes } = useClientes()
  const { data: productos } = useProductos()
  // El operador solo ve las ventas que él registró (el backend las filtra);
  // el admin ve todas y puede filtrar por quién las registró.
  const { data: usuarioActual } = useUsuarioActual()
  const esAdmin = usuarioActual?.rol === 'admin'
  const { data: usuarios } = useUsuarios(esAdmin)

  const [sucursalFiltro, setSucursalFiltro] = useState<number | ''>('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoVenta | ''>('')
  const [clienteFiltro, setClienteFiltro] = useState<number | ''>('')
  const [productoFiltro, setProductoFiltro] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | ''>('')

  const { data: ventas, isLoading } = useVentas({
    sucursal: sucursalFiltro || undefined,
    estado: estadoFiltro || undefined,
    cliente: clienteFiltro || undefined,
    producto: productoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
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

      {/* 023 · Analítica predictiva: solo admin (el backend tampoco se lo da al operador). */}
      {esAdmin && (
        <PronosticoVinculado
          titulo="Pronóstico de ventas"
          metricas={[
            { metrica: 'monto_ventas', titulo: 'Monto vendido', ejeY: 'Monto ($)', formato: formatearMoneda },
            { metrica: 'numero_ventas', titulo: 'Número de ventas', ejeY: 'Ventas', formato: (valor) => valor.toLocaleString('es-MX', { maximumFractionDigits: 0 }) },
          ]}
        />
      )}

      <div className="filters">
        <label className="filterField">
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

        <label className="filterField">
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoVenta | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO_VENTA) as EstadoVenta[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO_VENTA[estado]}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
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

        <label className="filterField">
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
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

        <label className="filterField">
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Cargando ventas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={ventas ?? []}
          mensajeVacio={
            hayFiltros
              ? 'Ninguna venta coincide con los filtros.'
              : esAdmin
                ? 'Todavía no hay ventas registradas.'
                : 'Todavía no has registrado ventas.'
          }
          renderAcciones={(fila) => (
            <button type="button" className="actionLink" onClick={() => navigate(`/ventas/${fila.id}`)}>
              Ver detalle
            </button>
          )}
        />
      )}
    </div>
  )
}
