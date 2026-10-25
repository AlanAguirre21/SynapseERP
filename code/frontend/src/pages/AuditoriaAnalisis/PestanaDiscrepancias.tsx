import { useState } from 'react'

import type {
  CategoriaDiscrepancia,
  DiscrepanciaAuditoria,
  EstadoDiscrepancia,
  TipoAuditoria,
} from '../../api/auditoria'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useDiscrepancias } from '../../hooks/useAuditoria'
import { useSucursales } from '../../hooks/useSucursales'
import {
  ETIQUETAS_CATEGORIA,
  ETIQUETAS_ESTADO_DISCREPANCIA,
  ETIQUETAS_TIPO_AUDITORIA,
  claseDiferencia,
  claseEstadoDiscrepancia,
  formatearDiferencia,
  formatearFechaHora,
  formatearValor,
} from './formatoAuditoria'
import { ModalResolverDiscrepancia, type AccionResolver } from './ModalResolverDiscrepancia'

interface PestanaDiscrepanciasProps {
  sucursalInicial: number | null
}

export function PestanaDiscrepancias({ sucursalInicial }: PestanaDiscrepanciasProps) {
  const { data: sucursales } = useSucursales()

  const [tipo, setTipo] = useState<TipoAuditoria | ''>(sucursalInicial ? 'inventario' : '')
  const [categoria, setCategoria] = useState<CategoriaDiscrepancia | ''>('')
  const [estado, setEstado] = useState<EstadoDiscrepancia | ''>('abierta')
  const [sucursal, setSucursal] = useState<number | ''>(sucursalInicial ?? '')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [resolviendo, setResolviendo] = useState<{ discrepancia: DiscrepanciaAuditoria; accion: AccionResolver } | null>(
    null,
  )

  const { data: discrepancias, isLoading } = useDiscrepancias({
    tipo: tipo || undefined,
    categoria: categoria || undefined,
    estado: estado || undefined,
    sucursal: sucursal || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  })

  const hayFiltros = Boolean(tipo || categoria || estado || sucursal || fechaDesde || fechaHasta)
  const categoriasDisponibles = (Object.keys(ETIQUETAS_CATEGORIA) as CategoriaDiscrepancia[]).filter(
    (c) => !tipo || c.startsWith(tipo),
  )

  function limpiarFiltros() {
    setTipo('')
    setCategoria('')
    setEstado('')
    setSucursal('')
    setFechaDesde('')
    setFechaHasta('')
  }

  function cambiarTipo(valor: TipoAuditoria | '') {
    setTipo(valor)
    if (categoria && valor && !categoria.startsWith(valor)) setCategoria('')
    if (valor === 'caja') setSucursal('')
  }

  const columnas: ColumnaTabla<DiscrepanciaAuditoria>[] = [
    {
      clave: 'fecha_ejecucion',
      encabezado: 'Ejecución',
      render: (fila) => <span className="cellNoWrap">{formatearFechaHora(fila.fecha_ejecucion)}</span>,
    },
    {
      clave: 'categoria',
      encabezado: 'Categoría',
      render: (fila) => (
        <div className="cellStack">
          <span>{ETIQUETAS_CATEGORIA[fila.categoria]}</span>
          <span className="pageHint">{fila.descripcion}</span>
        </div>
      ),
    },
    {
      clave: 'sucursal_nombre',
      encabezado: 'Sucursal / ítem',
      render: (fila) =>
        fila.sucursal ? (
          <div className="cellStack">
            <span>{fila.sucursal_nombre}</span>
            <span className="pageHint">{fila.item_nombre}</span>
          </div>
        ) : (
          '—'
        ),
    },
    {
      clave: 'valor_esperado',
      alineacion: 'derecha',
      encabezado: 'Esperado',
      render: (fila) => <span className="cellNoWrap">{formatearValor(fila.categoria, fila.valor_esperado)}</span>,
    },
    {
      clave: 'valor_registrado',
      alineacion: 'derecha',
      encabezado: 'Registrado',
      render: (fila) => <span className="cellNoWrap">{formatearValor(fila.categoria, fila.valor_registrado)}</span>,
    },
    {
      clave: 'diferencia',
      alineacion: 'derecha',
      encabezado: 'Diferencia',
      render: (fila) => (
        <span className={`cellNoWrap ${claseDiferencia(fila.diferencia)}`}>
          {formatearDiferencia(fila.categoria, fila.diferencia)}
        </span>
      ),
    },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => (
        <div className="cellStack">
          <span className={claseEstadoDiscrepancia(fila.estado)}>{ETIQUETAS_ESTADO_DISCREPANCIA[fila.estado]}</span>
          {fila.estado !== 'abierta' && fila.comentario_resolucion && (
            <span className="pageHint">{fila.comentario_resolucion}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="tabPanel">
      <div className="filters">
        <label className="filterField">
          Tipo
          <select value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoAuditoria | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_TIPO_AUDITORIA) as TipoAuditoria[]).map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO_AUDITORIA[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
          Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDiscrepancia | '')}>
            <option value="">Todas</option>
            {categoriasDisponibles.map((c) => (
              <option key={c} value={c}>
                {ETIQUETAS_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoDiscrepancia | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO_DISCREPANCIA) as EstadoDiscrepancia[]).map((e) => (
              <option key={e} value={e}>
                {ETIQUETAS_ESTADO_DISCREPANCIA[e]}
              </option>
            ))}
          </select>
        </label>

        {tipo !== 'caja' && (
          <label className="filterField">
            Sucursal
            <select value={sucursal} onChange={(e) => setSucursal(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Todas</option>
              {(sucursales ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre_sucursal}
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
        <p>Cargando discrepancias…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={discrepancias ?? []}
          mensajeVacio={hayFiltros ? 'Ninguna discrepancia coincide con los filtros.' : 'No hay discrepancias registradas.'}
          renderAcciones={(fila) =>
            fila.estado === 'abierta' ? (
              <div className="rowActions">
                {fila.categoria === 'inventario_conteo' && (
                  <button
                    type="button"
                    className="actionLink"
                    onClick={() => setResolviendo({ discrepancia: fila, accion: 'ajustar' })}
                  >
                    Ajustar
                  </button>
                )}
                <button
                  type="button"
                  className="actionLink"
                  onClick={() => setResolviendo({ discrepancia: fila, accion: 'justificar' })}
                >
                  Justificar
                </button>
              </div>
            ) : null
          }
        />
      )}

      {resolviendo && (
        <ModalResolverDiscrepancia
          discrepancia={resolviendo.discrepancia}
          accion={resolviendo.accion}
          onCerrar={() => setResolviendo(null)}
        />
      )}
    </div>
  )
}
