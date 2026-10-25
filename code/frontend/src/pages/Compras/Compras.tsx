import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ETIQUETAS_ESTADO_COMPRA, type Compra, type EstadoCompra } from '../../api/compras'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useCompras } from '../../hooks/useCompras'
import { useProveedores } from '../../hooks/useProveedores'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { DemandaPronosticadaResumen } from '../Dashboard/compartido/DemandaPronosticadaResumen'
import { useUsuarios } from '../../hooks/useUsuarios'
import { formatearMoneda } from '../../utils/moneda'

function claseEstado(estado: EstadoCompra) {
  if (estado === 'recibida') return 'status statusSuccess'
  if (estado === 'cancelada') return 'status statusError'
  return 'status statusWarning'
}

export function Compras() {
  const navigate = useNavigate()
  const { data: proveedores } = useProveedores()
  // El operador solo ve las compras que él registró (el backend las filtra);
  // el admin ve todas y puede filtrar por quién las registró.
  const { data: usuarioActual } = useUsuarioActual()
  const esAdmin = usuarioActual?.rol === 'admin'
  const { data: usuarios } = useUsuarios(esAdmin)

  const [proveedorFiltro, setProveedorFiltro] = useState<number | ''>('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoCompra | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | ''>('')

  const { data: compras, isLoading } = useCompras({
    proveedor: proveedorFiltro || undefined,
    estado: estadoFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
    usuario: (esAdmin && usuarioFiltro) || undefined,
  })

  const columnas: ColumnaTabla<Compra>[] = [
    { clave: 'id', encabezado: 'Folio', render: (fila) => `#${fila.id}` },
    { clave: 'fecha', encabezado: 'Fecha', render: (fila) => new Date(fila.fecha).toLocaleDateString('es-MX') },
    { clave: 'proveedor_nombre', encabezado: 'Proveedor' },
    { clave: 'sucursal_nombre', encabezado: 'Sucursal destino' },
    ...(esAdmin ? [{ clave: 'usuario_nombre' as const, encabezado: 'Registrada por' }] : []),
    { clave: 'total', alineacion: 'derecha', encabezado: 'Total', render: (fila) => formatearMoneda(fila.total) },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstado(fila.estado)}>{ETIQUETAS_ESTADO_COMPRA[fila.estado]}</span>,
    },
  ]

  // Indicadores sobre la lista ya filtrada por el backend; el importe no cuenta las canceladas.
  const lista = compras ?? []
  const vigentes = lista.filter((compra) => compra.estado !== 'cancelada')
  const importe = vigentes.reduce((acumulado, compra) => acumulado + Number(compra.total), 0)
  const pendientes = lista.filter((compra) => compra.estado === 'pendiente').length
  const recibidas = lista.filter((compra) => compra.estado === 'recibida').length

  const hayFiltros = Boolean(proveedorFiltro || estadoFiltro || fechaDesde || fechaHasta || usuarioFiltro)

  function limpiarFiltros() {
    setProveedorFiltro('')
    setEstadoFiltro('')
    setFechaDesde('')
    setFechaHasta('')
    setUsuarioFiltro('')
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Compras</h1>
          <p className="pageHint">
            {esAdmin
              ? 'Consulta las compras a proveedores y da seguimiento a su recepción.'
              : 'Tus compras registradas: consúltalas y da seguimiento a su recepción.'}
          </p>
        </div>
        <BotonPrimario onClick={() => navigate('/compras/nueva')}>Nueva compra</BotonPrimario>
      </div>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Compras</span>
          <span className="statValue">{compras ? lista.length : '…'}</span>
        </div>
        <div className="statTile statTilePurchase">
          <span className="statLabel">Importe comprado</span>
          <span className="statValue">{compras ? formatearMoneda(importe) : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Pendientes de recibir</span>
          <span className="statValue">{compras ? pendientes : '…'}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Recibidas</span>
          <span className="statValue">{compras ? recibidas : '…'}</span>
        </div>
      </div>

      {/* 023 · Analítica predictiva: solo admin. */}
      {esAdmin && <DemandaPronosticadaResumen />}

      <div className="filters">
        <label className="filterField">
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

        <label className="filterField">
          Estado
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoCompra | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO_COMPRA) as EstadoCompra[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETAS_ESTADO_COMPRA[estado]}
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
        <p>Cargando compras…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={compras ?? []}
          mensajeVacio={
            hayFiltros
              ? 'Ninguna compra coincide con los filtros.'
              : esAdmin
                ? 'Todavía no hay compras registradas.'
                : 'Todavía no has registrado compras.'
          }
          renderAcciones={(fila) => (
            <button type="button" className="actionLink" onClick={() => navigate(`/compras/${fila.id}`)}>
              Ver detalle
            </button>
          )}
        />
      )}
    </div>
  )
}
