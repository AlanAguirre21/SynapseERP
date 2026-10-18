import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import {
  ETIQUETAS_ORIGEN_ASIENTO,
  ETIQUETAS_TIPO_CUENTA,
  type AsientoContable,
  type CuentaContable,
  type CuentaContableFormulario,
  type FilaBalance,
  type TipoCuenta,
  type TipoOrigenAsiento,
} from '../../api/contabilidad'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { useBalanceComprobacion } from '../../hooks/useBalanceComprobacion'
import {
  useCrearCuentaContable,
  useCuentasContables,
  useDesactivarCuentaContable,
  useEditarCuentaContable,
  useReactivarCuentaContable,
} from '../../hooks/useCuentasContables'
import { useExportarContabilidad, useLibroDiario } from '../../hooks/useLibroDiario'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { formatearImporte } from '../../utils/numeros'
import styles from './Contabilidad.module.css'

function extraerMensajeError(err: unknown, mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined

  if (typeof datos?.detail === 'string') return datos.detail

  for (const valor of Object.values(datos ?? {})) {
    if (typeof valor === 'string') return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
  }

  return mensajePorDefecto
}

function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}

// Dos sumas "cuadran" si difieren en menos de medio centavo: los Decimal del
// backend llegan como texto y se suman como Number solo para mostrarlos.
function cuadran(cargos: number, abonos: number): boolean {
  return Math.abs(cargos - abonos) < 0.005
}

function EtiquetaCuadre({ cargos, abonos }: { cargos: number; abonos: number }) {
  return cuadran(cargos, abonos) ? (
    <span className="status statusSuccess">Cuadra</span>
  ) : (
    <span className="status statusError">Descuadre de {formatearImporte(Math.abs(cargos - abonos))}</span>
  )
}

type LimiteLista = '5' | '10' | 'todos'

const ETIQUETAS_LIMITE: Record<LimiteLista, string> = { '5': '5', '10': '10', todos: 'Todos' }

type Pestaña = 'cuentas' | 'libro' | 'balance'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'cuentas', etiqueta: 'Catálogo de cuentas' },
  { clave: 'libro', etiqueta: 'Libro diario' },
  { clave: 'balance', etiqueta: 'Balance de comprobación' },
]

export function Contabilidad() {
  const { data: usuario, isLoading } = useUsuarioActual()

  // Exclusiva de admin: la barra lateral ya oculta el enlace para
  // operador, esto bloquea también el acceso directo por URL — mismo
  // patrón que `013 · Caja`/`016 · Configuración Fiscal`. El backend
  // rechaza los endpoints igual de todas formas.
  if (isLoading) {
    return <p>Cargando…</p>
  }

  if (usuario?.rol !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <ContabilidadContenido />
}

function ContabilidadContenido() {
  const [pestaña, setPestaña] = useState<Pestaña>('cuentas')

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Contabilidad</h1>
          <p className="pageHint">
            Catálogo de cuentas, pólizas del libro diario y balance de comprobación de la empresa.
          </p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {PESTAÑAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestaña === p.clave}
            className={pestaña === p.clave ? 'tab tabActive' : 'tab'}
            onClick={() => setPestaña(p.clave)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestaña === 'cuentas' && <CatalogoCuentasSeccion />}
      {pestaña === 'libro' && <LibroDiarioSeccion />}
      {pestaña === 'balance' && <BalanceComprobacionSeccion />}
    </div>
  )
}

// --- Catálogo de cuentas -------------------------------------------------

const CUENTA_VACIA: CuentaContableFormulario = { codigo: '', nombre: '', tipo: 'activo', cuenta_padre: null }

// De qué lado crece el saldo de cada tipo de cuenta.
const NATURALEZA_POR_TIPO: Record<TipoCuenta, string> = {
  activo: 'Deudora',
  egreso: 'Deudora',
  pasivo: 'Acreedora',
  capital: 'Acreedora',
  ingreso: 'Acreedora',
}

interface CuentaEnJerarquia extends CuentaContable {
  nivel: number
  tieneSubcuentas: boolean
  naturaleza: string
}

// Recorrido en profundidad por código: cada cuenta de mayor seguida de sus
// subcuentas. Una cuenta cuyo padre no esté en la lista va al primer nivel;
// `visitadas` evita repetir cuentas si `cuenta_padre` llegara a formar un ciclo.
function ordenarJerarquia(cuentas: CuentaContable[]): CuentaEnJerarquia[] {
  const porCodigo = (a: CuentaContable, b: CuentaContable) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })
  const ids = new Set(cuentas.map((c) => c.id))
  const hijos = new Map<number, CuentaContable[]>()
  for (const cuenta of cuentas) {
    if (cuenta.cuenta_padre !== null && ids.has(cuenta.cuenta_padre)) {
      hijos.set(cuenta.cuenta_padre, [...(hijos.get(cuenta.cuenta_padre) ?? []), cuenta])
    }
  }

  const resultado: CuentaEnJerarquia[] = []
  const visitadas = new Set<number>()
  function visitar(cuenta: CuentaContable, nivel: number) {
    if (visitadas.has(cuenta.id)) return
    visitadas.add(cuenta.id)
    const subcuentas = (hijos.get(cuenta.id) ?? []).sort(porCodigo)
    resultado.push({
      ...cuenta,
      nivel,
      tieneSubcuentas: subcuentas.length > 0,
      naturaleza: NATURALEZA_POR_TIPO[cuenta.tipo],
    })
    for (const subcuenta of subcuentas) visitar(subcuenta, nivel + 1)
  }

  const raices = cuentas.filter((c) => c.cuenta_padre === null || !ids.has(c.cuenta_padre)).sort(porCodigo)
  for (const raiz of raices) visitar(raiz, 0)
  // Cuentas atrapadas en un ciclo (sin raíz alcanzable): al final, en el primer nivel.
  for (const cuenta of [...cuentas].sort(porCodigo)) visitar(cuenta, 0)
  return resultado
}

const CLASES_NIVEL = [styles.accountLevel0, styles.accountLevel1, styles.accountLevel2, styles.accountLevel3]

function claseCuenta(cuenta: CuentaEnJerarquia): string {
  // A partir del cuarto nivel se reutiliza la última sangría.
  const nivel = CLASES_NIVEL[Math.min(cuenta.nivel, CLASES_NIVEL.length - 1)]
  return cuenta.tieneSubcuentas ? `${nivel} ${styles.accountGroup}` : `${nivel}`
}

function CatalogoCuentasSeccion() {
  const { data: cuentas, isLoading } = useCuentasContables()
  const cuentasOrdenadas = useMemo(() => ordenarJerarquia(cuentas ?? []), [cuentas])
  const crear = useCrearCuentaContable()
  const editar = useEditarCuentaContable()
  const desactivar = useDesactivarCuentaContable()
  const reactivar = useReactivarCuentaContable()

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<CuentaContable | null>(null)
  const [valores, setValores] = useState<CuentaContableFormulario>(CUENTA_VACIA)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<CuentaContable | null>(null)
  const [errorDesactivar, setErrorDesactivar] = useState('')
  const [aReactivar, setAReactivar] = useState<CuentaContable | null>(null)

  function abrirCrear() {
    setEnEdicion(null)
    setValores(CUENTA_VACIA)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(cuenta: CuentaContable) {
    setEnEdicion(cuenta)
    setValores({ codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, cuenta_padre: cuenta.cuenta_padre })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')
    try {
      if (enEdicion) {
        await editar.mutateAsync({ id: enEdicion.id, datos: valores })
      } else {
        await crear.mutateAsync(valores)
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(extraerMensajeError(err, 'No se pudo guardar la cuenta. Intenta de nuevo.'))
    }
  }

  function abrirDesactivar(cuenta: CuentaContable) {
    setErrorDesactivar('')
    setADesactivar(cuenta)
  }

  async function confirmarDesactivar() {
    if (!aDesactivar) return
    setErrorDesactivar('')
    try {
      await desactivar.mutateAsync(aDesactivar.id)
      setADesactivar(null)
    } catch (err) {
      setErrorDesactivar(extraerMensajeError(err, 'No se pudo desactivar la cuenta.'))
    }
  }

  async function confirmarReactivar() {
    if (!aReactivar) return
    await reactivar.mutateAsync(aReactivar.id)
    setAReactivar(null)
  }

  const columnas: ColumnaTabla<CuentaEnJerarquia>[] = [
    {
      clave: 'codigo',
      encabezado: 'Código',
      render: (fila) => <span className={fila.tieneSubcuentas ? styles.accountGroup : undefined}>{fila.codigo}</span>,
    },
    { clave: 'nombre', encabezado: 'Nombre', render: (fila) => <span className={claseCuenta(fila)}>{fila.nombre}</span> },
    { clave: 'tipo', encabezado: 'Tipo', render: (fila) => ETIQUETAS_TIPO_CUENTA[fila.tipo] },
    { clave: 'naturaleza', encabezado: 'Naturaleza' },
    { clave: 'cuenta_padre_codigo', encabezado: 'Cuenta padre', render: (fila) => fila.cuenta_padre_codigo ?? '—' },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
          {fila.activo ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  return (
    <section className="tabPanel">
      <div className="sectionHeader">
        <h2 className="sectionTitle">Catálogo de cuentas contables</h2>
        <BotonPrimario onClick={abrirCrear}>Nueva cuenta</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando cuentas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={cuentasOrdenadas}
          mensajeVacio="Todavía no hay cuentas registradas."
          renderAcciones={(fila) => (
            <div className="rowActions">
              <button type="button" className="actionLink" onClick={() => abrirEditar(fila)}>
                Editar
              </button>
              {fila.activo ? (
                <button type="button" className="dangerActionLink" onClick={() => abrirDesactivar(fila)}>
                  Desactivar
                </button>
              ) : (
                <button type="button" className="actionLink" onClick={() => setAReactivar(fila)}>
                  Reactivar
                </button>
              )}
            </div>
          )}
        />
      )}

      <Modal titulo={enEdicion ? 'Editar cuenta' : 'Nueva cuenta'} abierto={formularioAbierto} onCerrar={() => setFormularioAbierto(false)}>
        <form className="form" onSubmit={alGuardar} noValidate>
          <label className="field">
            Código
            <input
              type="text" value={valores.codigo}
              onChange={(e) => setValores((v) => ({ ...v, codigo: e.target.value }))} required
            />
          </label>

          <label className="field">
            Nombre
            <input
              type="text" value={valores.nombre}
              onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))} required
            />
          </label>

          <label className="field">
            Tipo
            <select
              value={valores.tipo}
              onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoCuenta }))}
            >
              {(Object.keys(ETIQUETAS_TIPO_CUENTA) as TipoCuenta[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETAS_TIPO_CUENTA[tipo]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Cuenta padre (opcional)
            <select
              value={valores.cuenta_padre ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, cuenta_padre: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">Sin cuenta padre</option>
              {(cuentas ?? [])
                .filter((c) => c.activo && c.id !== enEdicion?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
            </select>
          </label>

          {errorFormulario && (
            <p className="errorMessage" role="alert">
              {errorFormulario}
            </p>
          )}

          <div className="formActions">
            <BotonPrimario type="button" variante="secundario" onClick={() => setFormularioAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
              {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>

      <Modal titulo="Desactivar cuenta" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres desactivar la cuenta "{aDesactivar?.codigo} — {aDesactivar?.nombre}"? Su historial
          de movimientos se conserva.
        </p>
        {errorDesactivar && (
          <p className="errorMessage" role="alert">
            {errorDesactivar}
          </p>
        )}
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar cuenta" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres reactivar la cuenta "{aReactivar?.codigo} — {aReactivar?.nombre}"?
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setAReactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarReactivar} disabled={reactivar.isPending}>
            {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
          </BotonPrimario>
        </div>
      </Modal>
    </section>
  )
}

// --- Libro diario -----------------------------------------------------

function sumasAsiento(asiento: AsientoContable) {
  let cargos = 0
  let abonos = 0
  for (const movimiento of asiento.movimientos) {
    if (movimiento.tipo_movimiento === 'cargo') cargos += Number(movimiento.monto)
    else abonos += Number(movimiento.monto)
  }
  return { cargos, abonos }
}

function LibroDiarioSeccion() {
  const { data: cuentas } = useCuentasContables()
  const [origenFiltro, setOrigenFiltro] = useState<TipoOrigenAsiento | ''>('')
  const [cuentaFiltro, setCuentaFiltro] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [limite, setLimite] = useState<LimiteLista>('10')

  const filtros = {
    tipo_origen: origenFiltro || undefined,
    cuenta: cuentaFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  }
  const { data: asientos, isLoading } = useLibroDiario(filtros)
  const exportar = useExportarContabilidad()

  const hayFiltros = Boolean(origenFiltro || cuentaFiltro || fechaDesde || fechaHasta)

  function limpiarFiltros() {
    setOrigenFiltro('')
    setCuentaFiltro('')
    setFechaDesde('')
    setFechaHasta('')
  }

  function alternarExpandido(id: number) {
    setExpandidos((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  // El CSV exporta todo lo filtrado; el límite solo recorta lo que se ve.
  async function alExportar() {
    const blob = await exportar.mutateAsync({ tipo: 'libro_diario', filtros })
    descargarBlob(blob, 'libro-diario.csv')
  }

  const lista = asientos ?? []
  // La API ya los entrega del más reciente al más antiguo.
  const visibles = limite === 'todos' ? lista : lista.slice(0, Number(limite))

  return (
    <section className="tabPanel">
      <div className="sectionHeader">
        <h2 className="sectionTitle">Libro diario</h2>
        <BotonPrimario variante="secundario" onClick={alExportar} disabled={exportar.isPending}>
          {exportar.isPending ? 'Exportando…' : 'Exportar CSV'}
        </BotonPrimario>
      </div>

      <div className="filters">
        <label className="filterField">
          Origen
          <select value={origenFiltro} onChange={(e) => setOrigenFiltro(e.target.value as TipoOrigenAsiento | '')}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_ORIGEN_ASIENTO) as TipoOrigenAsiento[]).map((origen) => (
              <option key={origen} value={origen}>
                {ETIQUETAS_ORIGEN_ASIENTO[origen]}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
          Cuenta
          <select value={cuentaFiltro} onChange={(e) => setCuentaFiltro(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todas</option>
            {(cuentas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nombre}
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

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Cargando asientos…</p>
      ) : lista.length === 0 ? (
        <p className="emptyState">
          {hayFiltros
            ? 'Ningún asiento coincide con los filtros.'
            : 'Todavía no hay asientos contables registrados.'}
        </p>
      ) : (
        <>
          <div className="sectionHeader">
            <span className="pageHint">{`Mostrando ${visibles.length} de ${lista.length}`}</span>
            <div className="segmented" role="group" aria-label="Cantidad de pólizas a mostrar">
              {(['5', '10', 'todos'] as LimiteLista[]).map((valor) => (
                <button
                  key={valor}
                  type="button"
                  className={limite === valor ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
                  aria-pressed={limite === valor}
                  onClick={() => setLimite(valor)}
                >
                  {ETIQUETAS_LIMITE[valor]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.entryList}>
            {visibles.map((asiento: AsientoContable) => {
              const desplegado = expandidos.has(asiento.id)
              const { cargos, abonos } = sumasAsiento(asiento)

              return (
                <div key={asiento.id} className={styles.entry}>
                  <button
                    type="button"
                    className={styles.entryHeader}
                    onClick={() => alternarExpandido(asiento.id)}
                    aria-expanded={desplegado}
                  >
                    <span aria-hidden="true">{desplegado ? '▾' : '▸'}</span>
                    <span className={styles.entryNumber}>Póliza #{asiento.id}</span>
                    <span className="cellNoWrap">
                      {new Date(asiento.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <span className={styles.entryConcept}>{asiento.concepto}</span>
                    <span className="status statusNeutral">{ETIQUETAS_ORIGEN_ASIENTO[asiento.tipo_origen]}</span>
                    <span className={styles.entryAmount}>{formatearImporte(cargos)}</span>
                  </button>

                  {desplegado && (
                    <div className={styles.entryDetail}>
                      <div className="tableScroll">
                        <table className="linesTable">
                          <thead>
                            <tr>
                              <th>Cuenta</th>
                              <th className="numeric">Cargo</th>
                              <th className="numeric">Abono</th>
                            </tr>
                          </thead>
                          <tbody>
                            {asiento.movimientos.map((movimiento) => (
                              <tr key={movimiento.id}>
                                <td>{movimiento.cuenta_codigo} — {movimiento.cuenta_nombre}</td>
                                <td className="numeric">
                                  {movimiento.tipo_movimiento === 'cargo' ? formatearImporte(movimiento.monto) : ''}
                                </td>
                                <td className="numeric">
                                  {movimiento.tipo_movimiento === 'abono' ? formatearImporte(movimiento.monto) : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Fuera de la tabla: es el resumen de la póliza, no un movimiento más. */}
                      <div className={styles.entryTotals}>
                        <span>Sumas iguales</span>
                        <span>
                          Cargos <strong>{formatearImporte(cargos)}</strong>
                        </span>
                        <span>
                          Abonos <strong>{formatearImporte(abonos)}</strong>
                        </span>
                        <EtiquetaCuadre cargos={cargos} abonos={abonos} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

// --- Balance de comprobación ------------------------------------------

function BalanceComprobacionSeccion() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const filtros = { fecha_desde: fechaDesde || undefined, fecha_hasta: fechaHasta || undefined }
  const { data: filas, isLoading } = useBalanceComprobacion(filtros)
  const exportar = useExportarContabilidad()

  const hayFiltros = Boolean(fechaDesde || fechaHasta)

  async function alExportar() {
    const blob = await exportar.mutateAsync({ tipo: 'balance', filtros })
    descargarBlob(blob, 'balance-comprobacion.csv')
  }

  const sumas = useMemo(() => {
    const lista = filas ?? []
    return {
      cargos: lista.reduce((total, fila) => total + Number(fila.total_cargos), 0),
      abonos: lista.reduce((total, fila) => total + Number(fila.total_abonos), 0),
    }
  }, [filas])

  const columnas: ColumnaTabla<FilaBalance>[] = [
    { clave: 'codigo', encabezado: 'Código' },
    { clave: 'nombre', encabezado: 'Cuenta' },
    { clave: 'tipo', encabezado: 'Tipo', render: (fila) => ETIQUETAS_TIPO_CUENTA[fila.tipo] },
    {
      clave: 'total_cargos',
      alineacion: 'derecha',
      encabezado: 'Total cargos',
      render: (fila) => formatearImporte(fila.total_cargos),
    },
    {
      clave: 'total_abonos',
      alineacion: 'derecha',
      encabezado: 'Total abonos',
      render: (fila) => formatearImporte(fila.total_abonos),
    },
    {
      clave: 'saldo',
      alineacion: 'derecha',
      encabezado: 'Saldo',
      render: (fila) => {
        const saldo = Number(fila.saldo)
        if (saldo === 0) return '—'
        return saldo > 0 ? (
          <span className={`${styles.debitBalance} cellNoWrap`}>{formatearImporte(saldo)} (deudor)</span>
        ) : (
          <span className={`${styles.creditBalance} cellNoWrap`}>{formatearImporte(Math.abs(saldo))} (acreedor)</span>
        )
      },
    },
  ]

  return (
    <section className="tabPanel">
      <div className="sectionHeader">
        <div className={styles.titleWithStatus}>
          <h2 className="sectionTitle">Balance de comprobación</h2>
          {filas && filas.length > 0 && <EtiquetaCuadre cargos={sumas.cargos} abonos={sumas.abonos} />}
        </div>
        <BotonPrimario variante="secundario" onClick={alExportar} disabled={exportar.isPending}>
          {exportar.isPending ? 'Exportando…' : 'Exportar CSV'}
        </BotonPrimario>
      </div>

      <div className="filters">
        <label className="filterField">
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>

        <label className="filterField">
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>

        {hayFiltros && (
          <button
            type="button"
            className="actionLink filtersEnd"
            onClick={() => {
              setFechaDesde('')
              setFechaHasta('')
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Cargando balance…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={filas ?? []}
          claveFila="cuenta"
          mensajeVacio="No hay cuentas para mostrar."
          filaPie={['Sumas', '', '', formatearImporte(sumas.cargos), formatearImporte(sumas.abonos), '']}
        />
      )}
    </section>
  )
}
