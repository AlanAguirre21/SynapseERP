<<<<<<< HEAD
import { useState } from 'react'
=======
import { useMemo, useState } from 'react'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import { useNavigate } from 'react-router-dom'

import { ETIQUETAS_ESTADO_FACTURA, type EstadoFactura, type Factura } from '../../api/facturacion'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useClientes } from '../../hooks/useClientes'
import { useFacturas } from '../../hooks/useFacturas'
<<<<<<< HEAD
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
=======
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { formatearMoneda } from '../../utils/moneda'

function claseEstado(estado: EstadoFactura) {
  if (estado === 'timbrada') return 'status statusSuccess'
  if (estado === 'cancelada') return 'status statusError'
  if (estado === 'error') return 'status statusError'
  if (estado === 'pendiente_cancelacion') return 'status statusWarning'
  return 'status statusWarning'
}

// Facturas que siguen amparando ingresos ante el SAT: una pendiente de
// cancelación sigue vigente hasta que el receptor acepta o vencen las 72 h.
const ESTADOS_VIGENTES: EstadoFactura[] = ['timbrada', 'pendiente_cancelacion']

export function Facturacion() {
  const navigate = useNavigate()
  const { data: clientes } = useClientes()
  // El operador solo ve las facturas de sus propias ventas (lo filtra el backend).
  const { data: usuarioActual } = useUsuarioActual()
  const esAdmin = usuarioActual?.rol === 'admin'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
=======
  const hayFiltros = Boolean(estadoFiltro || clienteFiltro || fechaDesde || fechaHasta)

  function limpiarFiltros() {
    setEstadoFiltro('')
    setClienteFiltro('')
    setFechaDesde('')
    setFechaHasta('')
  }

  // Indicadores sobre la lista ya filtrada por el backend: cambian al filtrar.
  const resumen = useMemo(() => {
    const lista = facturas ?? []
    return {
      facturas: lista.length,
      importe: lista
        .filter((f) => ESTADOS_VIGENTES.includes(f.estado))
        .reduce((suma, f) => suma + Number(f.venta_total), 0),
      conError: lista.filter((f) => f.estado === 'error').length,
      pendientesCancelacion: lista.filter((f) => f.estado === 'pendiente_cancelacion').length,
    }
  }, [facturas])

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const columnas: ColumnaTabla<Factura>[] = [
    {
      clave: 'fecha_creacion',
      encabezado: 'Fecha',
<<<<<<< HEAD
      render: (fila) => new Date(fila.fecha_creacion).toLocaleDateString('es-MX'),
    },
    { clave: 'cliente_nombre', encabezado: 'Cliente' },
    {
      clave: 'folio_fiscal',
      encabezado: 'Folio fiscal',
      render: (fila) => (fila.serie && fila.folio_interno ? `${fila.serie}-${fila.folio_interno}` : '—'),
    },
    { clave: 'venta_total', encabezado: 'Total' },
=======
      render: (fila) => <span className="cellNoWrap">{new Date(fila.fecha_creacion).toLocaleDateString('es-MX')}</span>,
    },
    {
      clave: 'folio_interno',
      encabezado: 'Serie y folio',
      render: (fila) => (fila.serie && fila.folio_interno ? `${fila.serie}-${fila.folio_interno}` : '—'),
    },
    { clave: 'cliente_nombre', encabezado: 'Cliente' },
    {
      clave: 'venta',
      encabezado: 'Venta',
      render: (fila) => (
        <button type="button" className="actionLink cellNoWrap" onClick={() => navigate(`/ventas/${fila.venta}`)}>
          Venta #{fila.venta}
        </button>
      ),
    },
    {
      clave: 'venta_total',
      alineacion: 'derecha',
      encabezado: 'Total',
      render: (fila) => formatearMoneda(fila.venta_total),
    },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstado(fila.estado)}>{ETIQUETAS_ESTADO_FACTURA[fila.estado]}</span>,
    },
  ]

<<<<<<< HEAD
  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Facturación</h1>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
=======
  const cifra = (valor: number | string) => (facturas ? valor : '…')

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Facturación</h1>
          <p className="pageHint">
            {esAdmin
              ? 'Consulta las facturas emitidas (CFDI) y su estado ante el SAT. Se generan desde el detalle de cada venta.'
              : 'Facturas de tus ventas (CFDI) y su estado ante el SAT. Se generan desde el detalle de cada venta.'}
          </p>
        </div>
      </div>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Facturas</span>
          <span className="statValue">{cifra(resumen.facturas)}</span>
        </div>
        <div className="statTile statTileSale">
          <span className="statLabel">Importe facturado</span>
          <span className="statValue">{cifra(formatearMoneda(resumen.importe))}</span>
        </div>
        <div className={resumen.conError > 0 ? 'statTile statTileDanger' : 'statTile'}>
          <span className="statLabel">Con error</span>
          <span className="statValue">{cifra(resumen.conError)}</span>
        </div>
        <div className={resumen.pendientesCancelacion > 0 ? 'statTile statTileWarning' : 'statTile'}>
          <span className="statLabel">Pendientes de cancelación</span>
          <span className="statValue">{cifra(resumen.pendientesCancelacion)}</span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
        <p>Cargando facturas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={facturas ?? []}
<<<<<<< HEAD
          mensajeVacio="Todavía no hay facturas generadas."
          renderAcciones={(fila) => (
            <button type="button" className={styles.enlaceAccion} onClick={() => navigate(`/facturacion/${fila.id}`)}>
=======
          mensajeVacio={hayFiltros ? 'Ninguna factura coincide con los filtros.' : 'Todavía no hay facturas generadas.'}
          renderAcciones={(fila) => (
            <button type="button" className="actionLink" onClick={() => navigate(`/facturacion/${fila.id}`)}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              Ver detalle
            </button>
          )}
        />
      )}
    </div>
  )
}
