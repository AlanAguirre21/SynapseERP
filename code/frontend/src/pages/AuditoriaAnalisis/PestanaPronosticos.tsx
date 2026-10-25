import { useState } from 'react'

import type {
  GeneracionPronostico,
  GranularidadPronostico,
  HorizontePronostico,
  Pronostico,
  VistaPronostico,
} from '../../api/analitica'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import {
  useDemandaPronosticada,
  useGeneracionesPronostico,
  usePronosticosDeGeneracion,
  useVistaPronostico,
} from '../../hooks/useAnalitica'
import { formatearMoneda } from '../../utils/moneda'
import {
  ETIQUETAS_HORIZONTE,
  clasePrecision,
  datosGraficaPronostico,
  etiquetaPeriodo,
  fechaLarga,
  mensajeInsuficiente,
  textoPrecision,
} from '../Dashboard/compartido/formatoPronostico'
import { GraficaPronostico } from '../Dashboard/compartido/GraficaPronostico'
import { claseEstadoEjecucion, ETIQUETAS_ESTADO_EJECUCION, ETIQUETAS_ORIGEN, formatearFechaHora } from './formatoAuditoria'
import { ModalGenerarPronostico } from './ModalGenerarPronostico'

const HORIZONTES: HorizontePronostico[] = ['dias_7', 'semanas_4', 'meses_3', 'personalizado']

const formatearUnidades = (valor: number | string) => Number(valor).toLocaleString('es-MX', { maximumFractionDigits: 2 })

export function PestanaPronosticos() {
  const [horizonte, setHorizonte] = useState<HorizontePronostico>('semanas_4')
  const [generacionElegida, setGeneracionElegida] = useState<number | ''>('')
  const [generando, setGenerando] = useState(false)

  const { data: generaciones } = useGeneracionesPronostico(horizonte)
  const exitosas = (generaciones ?? []).filter((g) => g.estado === 'exitosa')
  const generacion = exitosas.find((g) => g.id === generacionElegida) ?? exitosas[0]

  function cambiarHorizonte(valor: HorizontePronostico) {
    setHorizonte(valor)
    setGeneracionElegida('')
  }

  return (
    <div className="tabPanel">
      <div className="sectionHeader">
        <div className="segmented" role="group" aria-label="Horizonte del pronóstico">
          {HORIZONTES.map((h) => (
            <button
              key={h}
              type="button"
              className={horizonte === h ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
              aria-pressed={horizonte === h}
              onClick={() => cambiarHorizonte(h)}
            >
              {ETIQUETAS_HORIZONTE[h]}
            </button>
          ))}
        </div>
        <BotonPrimario onClick={() => setGenerando(true)}>Generar ahora</BotonPrimario>
      </div>

      {exitosas.length > 0 && (
        <label className="filterField">
          Generación
          <select
            value={generacion?.id ?? ''}
            onChange={(e) => setGeneracionElegida(e.target.value ? Number(e.target.value) : '')}
          >
            {exitosas.map((g, indice) => (
              <option key={g.id} value={g.id}>
                {formatearFechaHora(g.fecha_inicio)}
                {indice === 0 ? ' (más reciente)' : ''} · {etiquetaPeriodo(g.periodo_desde, g.granularidad)} –{' '}
                {etiquetaPeriodo(g.periodo_hasta, g.granularidad)}
              </option>
            ))}
          </select>
        </label>
      )}

      {!generacion ? (
        <p className="emptyState">
          {horizonte === 'personalizado'
            ? 'Todavía no hay pronósticos para un rango personalizado. Usa «Generar ahora».'
            : 'Todavía no hay pronósticos para este horizonte. Se generan cada lunes, o usa «Generar ahora».'}
        </p>
      ) : (
        <SeccionesPronostico horizonte={horizonte} generacion={generacion} />
      )}

      <ListaGeneraciones />

      {generando && <ModalGenerarPronostico onCerrar={() => setGenerando(false)} />}
    </div>
  )
}

function SeccionesPronostico({ horizonte, generacion }: { horizonte: HorizontePronostico; generacion: GeneracionPronostico }) {
  const base = { horizonte, generacion: generacion.id }
  const { data: monto } = useVistaPronostico({ ...base, metrica: 'monto_ventas' })
  const { data: numero } = useVistaPronostico({ ...base, metrica: 'numero_ventas' })
  const { data: nuevos } = useVistaPronostico({ ...base, metrica: 'clientes_nuevos' })
  const { data: activos } = useVistaPronostico({ ...base, metrica: 'clientes_activos' })
  const { data: baseClientes } = useVistaPronostico({ ...base, metrica: 'base_clientes' })
  const granularidad = generacion.granularidad

  return (
    <>
      <p className="pageHint">
        Generado el {formatearFechaHora(generacion.fecha_inicio)} · periodos del {fechaLarga(generacion.periodo_desde)} al{' '}
        {fechaLarga(generacion.periodo_hasta)}
        {generacion.historial_desde && ` · historial desde el ${fechaLarga(generacion.historial_desde)}`}.
      </p>

      <section className="card" aria-label="Pronóstico de ventas">
        <h2 className="sectionTitle">Ventas</h2>
        <TotalesVentas monto={monto} numero={numero} />
        <div className="chartGrid">
          <GraficaMetrica titulo="Monto vendido" vista={monto} granularidad={granularidad} formato={formatearMoneda} ejeY="Monto ($)" />
          <GraficaMetrica titulo="Número de ventas" vista={numero} granularidad={granularidad} formato={formatearUnidades} ejeY="Ventas" />
        </div>
        <PrecisionReal vista={monto} granularidad={granularidad} formato={formatearMoneda} />
      </section>

      <SeccionCategorias generacion={generacion.id} />
      <SeccionDemanda generacion={generacion.id} />

      <section className="card" aria-label="Proyección de clientes">
        <h2 className="sectionTitle">Clientes</h2>
        <div className="statRow">
          <Indicador etiqueta="Clientes nuevos en el horizonte" vista={nuevos} formato={formatearUnidades} />
          <Indicador etiqueta="Clientes activos (suma de periodos)" vista={activos} formato={formatearUnidades} />
          <Indicador etiqueta="Base de clientes al final" vista={baseClientes} formato={formatearUnidades} />
        </div>
        <div className="chartGrid">
          <GraficaMetrica titulo="Clientes nuevos" vista={nuevos} granularidad={granularidad} formato={formatearUnidades} ejeY="Clientes" />
          <GraficaMetrica titulo="Base de clientes" vista={baseClientes} granularidad={granularidad} formato={formatearUnidades} ejeY="Clientes" />
        </div>
      </section>
    </>
  )
}

function GraficaMetrica({
  titulo,
  vista,
  granularidad,
  formato,
  ejeY,
}: {
  titulo: string
  vista: VistaPronostico | undefined
  granularidad: GranularidadPronostico
  formato: (valor: number) => string
  ejeY: string
}) {
  if (!vista) return <p>Cargando…</p>
  const pronostico = vista.pronostico
  const datos = pronostico?.estado === 'generado' ? datosGraficaPronostico(vista.historial, pronostico, granularidad) : []
  return (
    <div className="cellStack">
      <GraficaPronostico
        titulo={titulo}
        datos={datos}
        etiquetaEjeY={ejeY}
        formatoValor={formato}
        mensajeVacio={pronostico ? mensajeInsuficiente(pronostico) : 'Sin pronóstico'}
      />
      {pronostico?.estado === 'generado' && <span className={clasePrecision(pronostico.precision)}>{textoPrecision(pronostico)}</span>}
    </div>
  )
}

function Indicador({
  etiqueta,
  vista,
  formato,
}: {
  etiqueta: string
  vista: VistaPronostico | undefined
  formato: (valor: number | string) => string
}) {
  const pronostico = vista?.pronostico
  const generado = pronostico?.estado === 'generado' && pronostico.total_pronosticado !== null
  return (
    <div className="statTile">
      <span className="statLabel">{etiqueta}</span>
      <span className="statValue">{!vista ? '…' : generado ? formato(pronostico.total_pronosticado ?? 0) : '—'}</span>
      {generado && (
        <span className="pageHint">
          Rango {formato(pronostico.total_inferior ?? 0)} – {formato(pronostico.total_superior ?? 0)}
        </span>
      )}
    </div>
  )
}

function TotalesVentas({ monto, numero }: { monto: VistaPronostico | undefined; numero: VistaPronostico | undefined }) {
  // Variación contra el mismo número de periodos anteriores (los más recientes del historial).
  const variacion = (() => {
    const pronostico = monto?.pronostico
    if (!monto || pronostico?.estado !== 'generado' || pronostico.total_pronosticado === null) return null
    const anteriores = monto.historial.slice(-pronostico.puntos.length)
    const totalAnterior = anteriores.reduce((suma, p) => suma + Number(p.valor), 0)
    if (anteriores.length < pronostico.puntos.length || totalAnterior === 0) return null
    return ((Number(pronostico.total_pronosticado) - totalAnterior) / totalAnterior) * 100
  })()

  return (
    <div className="statRow">
      <Indicador etiqueta="Monto pronosticado" vista={monto} formato={formatearMoneda} />
      <Indicador etiqueta="Número de ventas pronosticado" vista={numero} formato={formatearUnidades} />
      <div className="statTile">
        <span className="statLabel">Variación contra los periodos anteriores</span>
        <span className={`statValue ${variacion === null ? '' : variacion < 0 ? 'textError' : 'textSuccess'}`}>
          {variacion === null ? '—' : `${variacion > 0 ? '+' : variacion < 0 ? '−' : ''}${Math.abs(variacion).toFixed(1)} %`}
        </span>
      </div>
    </div>
  )
}

function PrecisionReal({
  vista,
  granularidad,
  formato,
}: {
  vista: VistaPronostico | undefined
  granularidad: GranularidadPronostico
  formato: (valor: number | string) => string
}) {
  const precision = vista?.precision_real
  if (!precision) return null
  const wape = precision.wape === null ? null : Number(precision.wape)
  return (
    <div className="expandedSection">
      <h3 className="sectionTitle">Precisión real del pronóstico anterior</h3>
      <p className="pageHint">
        Lo pronosticado en la generación #{precision.generacion} frente a lo realmente vendido
        {wape === null ? '.' : ` · error ${(wape * 100).toFixed(1)} %.`}
      </p>
      <table className="linesTable">
        <thead>
          <tr>
            <th>Periodo</th>
            <th className="numeric">Pronosticado</th>
            <th className="numeric">Real</th>
          </tr>
        </thead>
        <tbody>
          {precision.puntos.map((p) => (
            <tr key={p.periodo_inicio}>
              <td>{etiquetaPeriodo(p.periodo_inicio, granularidad)}</td>
              <td className="numeric">{formato(p.pronosticado)}</td>
              <td className="numeric">{formato(p.real)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeccionCategorias({ generacion }: { generacion: number }) {
  const { data: pronosticos, isLoading } = usePronosticosDeGeneracion(generacion, 'monto_categoria')
  const filas = [...(pronosticos ?? [])].sort(
    (a, b) => Number(b.total_pronosticado ?? -1) - Number(a.total_pronosticado ?? -1),
  )
  const columnas: ColumnaTabla<Pronostico>[] = [
    { clave: 'categoria_nombre', encabezado: 'Categoría' },
    {
      clave: 'total_pronosticado',
      alineacion: 'derecha',
      encabezado: 'Monto pronosticado',
      render: (fila) =>
        fila.estado === 'generado' && fila.total_pronosticado !== null ? formatearMoneda(fila.total_pronosticado) : '—',
    },
    {
      clave: 'precision',
      encabezado: 'Precisión',
      render: (fila) =>
        fila.estado === 'generado' ? (
          <span className={clasePrecision(fila.precision)}>{textoPrecision(fila)}</span>
        ) : (
          <span className="pageHint">{mensajeInsuficiente(fila)}</span>
        ),
    },
  ]
  return (
    <section className="card" aria-label="Pronóstico por categoría">
      <h2 className="sectionTitle">Categorías</h2>
      {isLoading ? <p>Cargando…</p> : <Tabla columnas={columnas} datos={filas} mensajeVacio="Sin ventas por categoría." />}
    </section>
  )
}

function SeccionDemanda({ generacion }: { generacion: number }) {
  const { data: demanda, isLoading } = useDemandaPronosticada('semanas_4', undefined, true, generacion)
  const filas = (demanda?.productos ?? []).map((p) => ({ ...p, id: p.producto }))
  type Fila = (typeof filas)[number]
  const columnas: ColumnaTabla<Fila>[] = [
    { clave: 'producto_nombre', encabezado: 'Producto' },
    {
      clave: 'unidades',
      alineacion: 'derecha',
      encabezado: 'Unidades pronosticadas',
      render: (fila) => formatearUnidades(fila.unidades),
    },
    {
      clave: 'limite_inferior',
      alineacion: 'derecha',
      encabezado: 'Rango',
      render: (fila) => `${formatearUnidades(fila.limite_inferior)} – ${formatearUnidades(fila.limite_superior)}`,
    },
    {
      clave: 'precision',
      encabezado: 'Precisión',
      render: (fila) => <span className={clasePrecision(fila.precision)}>{textoPrecision(fila)}</span>,
    },
    {
      clave: 'stock_total',
      alineacion: 'derecha',
      encabezado: 'Stock total actual',
      render: (fila) => (
        <span className={fila.insuficiente ? 'textError' : undefined}>{formatearUnidades(fila.stock_total)}</span>
      ),
    },
  ]
  return (
    <section className="card" aria-label="Demanda por producto">
      <h2 className="sectionTitle">Demanda por producto</h2>
      <p className="pageHint">Stock total de todas las sucursales, como referencia. En rojo, los que no alcanzarían.</p>
      {isLoading ? (
        <p>Cargando…</p>
      ) : (
        <Tabla columnas={columnas} datos={filas} mensajeVacio="Ningún producto tiene historial suficiente todavía." />
      )}
    </section>
  )
}

function ListaGeneraciones() {
  const { data: generaciones, isLoading } = useGeneracionesPronostico()
  const columnas: ColumnaTabla<GeneracionPronostico>[] = [
    {
      clave: 'fecha_inicio',
      encabezado: 'Fecha',
      render: (fila) => <span className="cellNoWrap">{formatearFechaHora(fila.fecha_inicio)}</span>,
    },
    { clave: 'horizonte', encabezado: 'Horizonte', render: (fila) => ETIQUETAS_HORIZONTE[fila.horizonte] },
    {
      clave: 'origen',
      encabezado: 'Origen',
      render: (fila) =>
        fila.iniciada_por_nombre ? `${ETIQUETAS_ORIGEN[fila.origen]} · ${fila.iniciada_por_nombre}` : ETIQUETAS_ORIGEN[fila.origen],
    },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => (
        <div className="cellStack">
          <span className={claseEstadoEjecucion(fila.estado)}>{ETIQUETAS_ESTADO_EJECUCION[fila.estado]}</span>
          {fila.mensaje_error && <span className="pageHint">{fila.mensaje_error}</span>}
        </div>
      ),
    },
  ]
  return (
    <section className="card" aria-label="Generaciones de pronósticos">
      <h2 className="sectionTitle">Generaciones</h2>
      <p className="pageHint">Se generan automáticamente cada lunes a las 00:30.</p>
      {isLoading ? (
        <p>Cargando…</p>
      ) : (
        <Tabla columnas={columnas} datos={(generaciones ?? []).slice(0, 15)} mensajeVacio="Todavía no hay generaciones." />
      )}
    </section>
  )
}

