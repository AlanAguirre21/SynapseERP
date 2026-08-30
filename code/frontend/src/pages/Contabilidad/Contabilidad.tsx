import { useState, type FormEvent } from 'react'
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
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Contabilidad</h1>
      </div>

      <div className={styles.pestañas} role="tablist">
        {PESTAÑAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestaña === p.clave}
            className={pestaña === p.clave ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
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

function CatalogoCuentasSeccion() {
  const { data: cuentas, isLoading } = useCuentasContables()
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

  const columnas: ColumnaTabla<CuentaContable>[] = [
    { clave: 'codigo', encabezado: 'Código' },
    { clave: 'nombre', encabezado: 'Nombre' },
    { clave: 'tipo', encabezado: 'Tipo', render: (fila) => ETIQUETAS_TIPO_CUENTA[fila.tipo] },
    { clave: 'cuenta_padre_codigo', encabezado: 'Cuenta padre', render: (fila) => fila.cuenta_padre_codigo ?? '—' },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
          {fila.activo ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.subtitulo}>Catálogo de cuentas contables</h2>
        <BotonPrimario onClick={abrirCrear}>Nueva cuenta</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando cuentas…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={cuentas ?? []}
          mensajeVacio="Todavía no hay cuentas registradas."
          renderAcciones={(fila) => (
            <div className={styles.acciones}>
              <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                Editar
              </button>
              {fila.activo ? (
                <button type="button" className={styles.enlaceAccionPeligro} onClick={() => abrirDesactivar(fila)}>
                  Desactivar
                </button>
              ) : (
                <button type="button" className={styles.enlaceAccion} onClick={() => setAReactivar(fila)}>
                  Reactivar
                </button>
              )}
            </div>
          )}
        />
      )}

      <Modal titulo={enEdicion ? 'Editar cuenta' : 'Nueva cuenta'} abierto={formularioAbierto} onCerrar={() => setFormularioAbierto(false)}>
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Código
            <input
              type="text" value={valores.codigo}
              onChange={(e) => setValores((v) => ({ ...v, codigo: e.target.value }))} required
            />
          </label>

          <label className={styles.campo}>
            Nombre
            <input
              type="text" value={valores.nombre}
              onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))} required
            />
          </label>

          <label className={styles.campo}>
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

          <label className={styles.campo}>
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
            <p className={styles.error} role="alert">
              {errorFormulario}
            </p>
          )}

          <div className={styles.accionesFormulario}>
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
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar la cuenta "{aDesactivar?.codigo} — {aDesactivar?.nombre}"? Su historial
          de movimientos se conserva.
        </p>
        {errorDesactivar && (
          <p className={styles.error} role="alert">
            {errorDesactivar}
          </p>
        )}
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar cuenta" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar la cuenta "{aReactivar?.codigo} — {aReactivar?.nombre}"?
        </p>
        <div className={styles.accionesFormulario}>
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

function LibroDiarioSeccion() {
  const { data: cuentas } = useCuentasContables()
  const [origenFiltro, setOrigenFiltro] = useState<TipoOrigenAsiento | ''>('')
  const [cuentaFiltro, setCuentaFiltro] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

  const filtros = {
    tipo_origen: origenFiltro || undefined,
    cuenta: cuentaFiltro || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  }
  const { data: asientos, isLoading } = useLibroDiario(filtros)
  const exportar = useExportarContabilidad()

  function alternarExpandido(id: number) {
    setExpandidos((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  async function alExportar() {
    const blob = await exportar.mutateAsync({ tipo: 'libro_diario', filtros })
    descargarBlob(blob, 'libro-diario.csv')
  }

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.subtitulo}>Libro diario</h2>
        <BotonPrimario variante="secundario" onClick={alExportar} disabled={exportar.isPending}>
          {exportar.isPending ? 'Exportando…' : 'Exportar CSV'}
        </BotonPrimario>
      </div>

      <div className={styles.filtros}>
        <label className={styles.campoFiltro}>
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

        <label className={styles.campoFiltro}>
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
        <p>Cargando asientos…</p>
      ) : (asientos ?? []).length === 0 ? (
        <p className={styles.mensajeVacio}>Todavía no hay asientos contables registrados.</p>
      ) : (
        <div className={styles.listaAsientos}>
          {(asientos ?? []).map((asiento: AsientoContable) => (
            <div key={asiento.id} className={styles.asiento}>
              <button
                type="button"
                className={styles.asientoEncabezado}
                onClick={() => alternarExpandido(asiento.id)}
                aria-expanded={expandidos.has(asiento.id)}
              >
                <span>{expandidos.has(asiento.id) ? '▾' : '▸'}</span>
                <span>{new Date(asiento.fecha).toLocaleString('es-MX')}</span>
                <span>{asiento.concepto}</span>
                <span className={styles.origenAsiento}>{ETIQUETAS_ORIGEN_ASIENTO[asiento.tipo_origen]}</span>
              </button>

              {expandidos.has(asiento.id) && (
                <table className={styles.tablaMovimientos}>
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th>Cargo</th>
                      <th>Abono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asiento.movimientos.map((movimiento) => (
                      <tr key={movimiento.id}>
                        <td>{movimiento.cuenta_codigo} — {movimiento.cuenta_nombre}</td>
                        <td>{movimiento.tipo_movimiento === 'cargo' ? movimiento.monto : ''}</td>
                        <td>{movimiento.tipo_movimiento === 'abono' ? movimiento.monto : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
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

  async function alExportar() {
    const blob = await exportar.mutateAsync({ tipo: 'balance', filtros })
    descargarBlob(blob, 'balance-comprobacion.csv')
  }

  const columnas: ColumnaTabla<FilaBalance>[] = [
    { clave: 'codigo', encabezado: 'Código' },
    { clave: 'nombre', encabezado: 'Cuenta' },
    { clave: 'tipo', encabezado: 'Tipo', render: (fila) => ETIQUETAS_TIPO_CUENTA[fila.tipo] },
    { clave: 'total_cargos', encabezado: 'Total cargos' },
    { clave: 'total_abonos', encabezado: 'Total abonos' },
    {
      clave: 'saldo',
      encabezado: 'Saldo',
      render: (fila) => {
        const saldo = Number(fila.saldo)
        if (saldo === 0) return '—'
        return saldo > 0 ? (
          <span className={styles.saldoDeudor}>{fila.saldo} (deudor)</span>
        ) : (
          <span className={styles.saldoAcreedor}>{Math.abs(saldo).toFixed(2)} (acreedor)</span>
        )
      },
    },
  ]

  return (
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.subtitulo}>Balance de comprobación</h2>
        <BotonPrimario variante="secundario" onClick={alExportar} disabled={exportar.isPending}>
          {exportar.isPending ? 'Exportando…' : 'Exportar CSV'}
        </BotonPrimario>
      </div>

      <div className={styles.filtros}>
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
        <p>Cargando balance…</p>
      ) : (
        <Tabla columnas={columnas} datos={filas ?? []} claveFila="cuenta" mensajeVacio="No hay cuentas para mostrar." />
      )}
    </section>
  )
}
