<<<<<<< HEAD
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import type {
  ConfiguracionPACFormulario,
  DatosFiscalesEmpresaFormulario,
  SerieFolio,
  SerieFolioFormulario,
=======
import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import {
  REGIMENES_FISCALES,
  type ConfiguracionPACFormulario,
  type DatosFiscalesEmpresaFormulario,
  type SerieFolio,
  type SerieFolioFormulario,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
} from '../../api/configuracionFiscal'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import {
  useActualizarConfiguracionPAC,
  useActualizarDatosFiscalesEmpresa,
  useConfiguracionPAC,
  useCrearSerieFolio,
  useDatosFiscalesEmpresa,
  useDesactivarSerieFolio,
  useEditarSerieFolio,
  useReactivarSerieFolio,
  useSeriesFolio,
} from '../../hooks/useConfiguracionFiscal'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import styles from './ConfiguracionFiscal.module.css'

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

export function ConfiguracionFiscal() {
  const { data: usuario, isLoading: usuarioCargando } = useUsuarioActual()

  // Exclusiva de admin: la barra lateral ya oculta el enlace para operador,
  // esto bloquea también el acceso directo por URL — mismo patrón que
  // `013 · Caja`. El backend rechaza los endpoints igual de todas formas.
  if (usuarioCargando) {
    return <p>Cargando…</p>
  }

  if (usuario?.rol !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <ConfiguracionFiscalContenido />
}

function ConfiguracionFiscalContenido() {
  const { data: datosFiscales, isLoading: datosFiscalesCargando } = useDatosFiscalesEmpresa()
  const { data: pac, isLoading: pacCargando } = useConfiguracionPAC()
<<<<<<< HEAD
=======
  const { data: series } = useSeriesFolio()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

  const configuracionIncompleta =
    !datosFiscalesCargando && !pacCargando && (datosFiscales?.completa === false || pac?.completa === false)

<<<<<<< HEAD
  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>Configuración Fiscal</h1>

      {configuracionIncompleta && (
        <p className={styles.aviso} role="alert">
          Configuración incompleta — completa los datos fiscales y la conexión al PAC antes de que{' '}
          <strong>017 · Facturación</strong> pueda timbrar.
        </p>
      )}

      <DatosFiscalesForm />
      <ConfiguracionPACForm />
      <SeriesFolioSeccion />
=======
  // Solo informativo: las reglas para timbrar viven en el backend. La serie
  // activa no está en ningún `completa`, pero sin ella tampoco se timbra.
  const comprobaciones = [
    { etiqueta: 'Datos fiscales completos', lista: datosFiscales?.completa === true },
    { etiqueta: 'Conexión al PAC configurada y activa', lista: pac?.completa === true },
    { etiqueta: 'Al menos una serie activa', lista: (series ?? []).some((s) => s.activo) },
  ]
  const todoListo = comprobaciones.every((c) => c.lista)
  const cargando = datosFiscalesCargando || pacCargando || !series

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Configuración Fiscal</h1>
          <p className="pageHint">Datos de la empresa, conexión al PAC y series con los que se timbran las facturas (CFDI).</p>
        </div>
      </div>

      {configuracionIncompleta && (
        <p className="notice" role="alert">
          Configuración incompleta — completa los datos fiscales y la conexión al PAC antes de poder timbrar facturas.
        </p>
      )}

      {!cargando && (
        <section className={styles.readiness} aria-label="Estado para timbrar">
          <div className={styles.readinessHeader}>
            <h2 className="sectionTitle">Estado para timbrar</h2>
            <span className={todoListo ? 'status statusSuccess' : 'status statusWarning'}>
              {todoListo ? 'Listo para timbrar' : 'Configuración incompleta'}
            </span>
          </div>
          <ul className={styles.readinessList}>
            {comprobaciones.map((c) => (
              <li key={c.etiqueta} className={styles.readinessItem}>
                <span>{c.etiqueta}</span>
                <span className={c.lista ? 'status statusSuccess' : 'status statusWarning'}>
                  {c.lista ? 'Listo' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <DatosFiscalesForm />
        <ConfiguracionPACForm />
        <SeriesFolioSeccion />
      </div>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    </div>
  )
}

<<<<<<< HEAD
=======
// Fila de ajustes: título y explicación a la izquierda, contenido a la derecha.
function FilaAjustes({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section className="settingsRow">
      <div className="settingsIntro">
        <h2 className="sectionTitle">{titulo}</h2>
        <p className="settingsDescription">{descripcion}</p>
      </div>
      <div className="card">{children}</div>
    </section>
  )
}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
function DatosFiscalesForm() {
  const { data: datosFiscales, isLoading } = useDatosFiscalesEmpresa()
  const actualizar = useActualizarDatosFiscalesEmpresa()

  const [valores, setValores] = useState<DatosFiscalesEmpresaFormulario>({
    rfc: '',
    razon_social: '',
    regimen_fiscal: '',
    codigo_postal_fiscal: '',
  })
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  if (datosFiscales && !cargado) {
    setCargado(true)
    setValores({
      rfc: datosFiscales.rfc,
      razon_social: datosFiscales.razon_social,
      regimen_fiscal: datosFiscales.regimen_fiscal,
      codigo_postal_fiscal: datosFiscales.codigo_postal_fiscal,
    })
  }

  function actualizarCampo(campo: keyof DatosFiscalesEmpresaFormulario, valor: string) {
    setExito(false)
    setValores((v) => ({ ...v, [campo]: valor }))
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError('')
    try {
      await actualizar.mutateAsync(valores)
      setExito(true)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo guardar. Intenta de nuevo.'))
    }
  }

<<<<<<< HEAD
  return (
    <section className={styles.seccion}>
      <h2 className={styles.subtitulo}>Datos fiscales de la empresa</h2>

      {isLoading ? (
        <p>Cargando…</p>
      ) : (
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            RFC
            <input type="text" value={valores.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} />
          </label>

          <label className={styles.campo}>
            Razón social
            <input
              type="text"
              value={valores.razon_social}
              onChange={(e) => actualizarCampo('razon_social', e.target.value)}
            />
          </label>

          <label className={styles.campo}>
            Régimen fiscal
            <input
              type="text"
              value={valores.regimen_fiscal}
              onChange={(e) => actualizarCampo('regimen_fiscal', e.target.value)}
            />
          </label>

          <label className={styles.campo}>
            Código postal fiscal
            <input
              type="text"
              value={valores.codigo_postal_fiscal}
              onChange={(e) => actualizarCampo('codigo_postal_fiscal', e.target.value)}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
=======
  // Descripción del régimen capturado; un código fuera del catálogo no muestra nada.
  const descripcionRegimen = REGIMENES_FISCALES.find((r) => r.valor === valores.regimen_fiscal.trim())?.etiqueta

  return (
    <FilaAjustes
      titulo="Datos fiscales de la empresa"
      descripcion="Identifican a la empresa como emisora en cada factura. Deben coincidir con su constancia de situación fiscal del SAT."
    >
      {isLoading ? (
        <p>Cargando…</p>
      ) : (
        <form className="form" onSubmit={alGuardar} noValidate>
          <div className="formGrid">
            <label className="field">
              RFC
              <input type="text" value={valores.rfc} onChange={(e) => actualizarCampo('rfc', e.target.value)} />
            </label>

            <label className="field">
              Código postal fiscal
              <input
                type="text"
                value={valores.codigo_postal_fiscal}
                onChange={(e) => actualizarCampo('codigo_postal_fiscal', e.target.value)}
              />
            </label>

            <label className="field formGridFull">
              Razón social
              <input
                type="text"
                value={valores.razon_social}
                onChange={(e) => actualizarCampo('razon_social', e.target.value)}
              />
            </label>

            {/* La descripción va fuera de la etiqueta (enlazada con aria-describedby)
                para que el nombre accesible del campo siga siendo "Régimen fiscal". */}
            <div className="field formGridFull">
              <label htmlFor="regimen-fiscal">Régimen fiscal</label>
              <input
                id="regimen-fiscal"
                type="text"
                value={valores.regimen_fiscal}
                onChange={(e) => actualizarCampo('regimen_fiscal', e.target.value)}
                aria-describedby={descripcionRegimen ? 'regimen-fiscal-descripcion' : undefined}
              />
              {descripcionRegimen && (
                <span id="regimen-fiscal-descripcion" className="fieldHint">
                  {descripcionRegimen}
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              {error}
            </p>
          )}
          {exito && (
<<<<<<< HEAD
            <p className={styles.exito} role="status">
=======
            <p className="successMessage" role="status">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              Datos fiscales actualizados.
            </p>
          )}

<<<<<<< HEAD
          <div className={styles.accionesFormulario}>
=======
          <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            <BotonPrimario type="submit" disabled={actualizar.isPending}>
              {actualizar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      )}
<<<<<<< HEAD
    </section>
=======
    </FilaAjustes>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  )
}

function ConfiguracionPACForm() {
  const { data: pac, isLoading } = useConfiguracionPAC()
  const actualizar = useActualizarConfiguracionPAC()

  const [proveedor, setProveedor] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [activo, setActivo] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  if (pac && !cargado) {
    setCargado(true)
    setProveedor(pac.proveedor)
    setApiEndpoint(pac.api_endpoint)
    setActivo(pac.activo)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError('')

    const datos: ConfiguracionPACFormulario = { proveedor, api_endpoint: apiEndpoint, activo }
    if (apiKey) datos.api_key = apiKey

    try {
      await actualizar.mutateAsync(datos)
      setApiKey('')
      setExito(true)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo guardar. Intenta de nuevo.'))
    }
  }

  return (
<<<<<<< HEAD
    <section className={styles.seccion}>
      <h2 className={styles.subtitulo}>Conexión al PAC</h2>

      {isLoading ? (
        <p>Cargando…</p>
      ) : (
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Proveedor
            <input
              type="text"
              value={proveedor}
              onChange={(e) => {
                setProveedor(e.target.value)
                setExito(false)
              }}
            />
          </label>

          <label className={styles.campo}>
            Endpoint de la API
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => {
                setApiEndpoint(e.target.value)
                setExito(false)
              }}
            />
          </label>

          <label className={styles.campo}>
            API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                setExito(false)
              }}
              placeholder={pac?.api_key_configurada ? 'Configurada — deja en blanco para no cambiarla' : 'Sin configurar'}
              autoComplete="new-password"
            />
          </label>

          <label className={styles.campoCheckbox}>
=======
    <FilaAjustes
      titulo="Conexión al PAC"
      descripcion="El Proveedor Autorizado de Certificación timbra cada factura ante el SAT. La API key nunca se muestra; déjala en blanco para conservar la guardada."
    >
      {isLoading ? (
        <p>Cargando…</p>
      ) : (
        <form className="form" onSubmit={alGuardar} noValidate>
          {/* Estado de lo guardado, no de lo que se está editando. */}
          {pac && (
            <div className={styles.statusBar} role="group" aria-label="Estado de la conexión guardada">
              <span className={pac.activo ? 'status statusSuccess' : 'status statusNeutral'}>
                {pac.activo ? 'Conexión activa' : 'Conexión inactiva'}
              </span>
              <span className={pac.api_key_configurada ? 'status statusSuccess' : 'status statusWarning'}>
                {pac.api_key_configurada ? 'API key configurada' : 'API key sin configurar'}
              </span>
            </div>
          )}

          <div className="formGrid">
            <label className="field">
              Proveedor
              <input
                type="text"
                value={proveedor}
                onChange={(e) => {
                  setProveedor(e.target.value)
                  setExito(false)
                }}
              />
            </label>

            <label className="field">
              Endpoint de la API
              <input
                type="text"
                value={apiEndpoint}
                onChange={(e) => {
                  setApiEndpoint(e.target.value)
                  setExito(false)
                }}
              />
            </label>

            <label className="field formGridFull">
              API key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setExito(false)
                }}
                placeholder={pac?.api_key_configurada ? 'Configurada — deja en blanco para no cambiarla' : 'Sin configurar'}
                autoComplete="new-password"
              />
            </label>
          </div>

          <label className="fieldCheckbox">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => {
                setActivo(e.target.checked)
                setExito(false)
              }}
            />
            Conexión activa
          </label>

          {error && (
<<<<<<< HEAD
            <p className={styles.error} role="alert">
=======
            <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              {error}
            </p>
          )}
          {exito && (
<<<<<<< HEAD
            <p className={styles.exito} role="status">
=======
            <p className="successMessage" role="status">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              Conexión al PAC actualizada.
            </p>
          )}

<<<<<<< HEAD
          <div className={styles.accionesFormulario}>
=======
          <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            <BotonPrimario type="submit" disabled={actualizar.isPending}>
              {actualizar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      )}
<<<<<<< HEAD
    </section>
=======
    </FilaAjustes>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  )
}

const SERIE_VACIA: SerieFolioFormulario = { serie: '', folio_actual: 0 }

function SeriesFolioSeccion() {
  const { data: series, isLoading } = useSeriesFolio()
  const crear = useCrearSerieFolio()
  const editar = useEditarSerieFolio()
  const desactivar = useDesactivarSerieFolio()
  const reactivar = useReactivarSerieFolio()

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [serieEnEdicion, setSerieEnEdicion] = useState<SerieFolio | null>(null)
  const [valores, setValores] = useState<SerieFolioFormulario>(SERIE_VACIA)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [serieADesactivar, setSerieADesactivar] = useState<SerieFolio | null>(null)
  const [serieAReactivar, setSerieAReactivar] = useState<SerieFolio | null>(null)
  const [errorReactivar, setErrorReactivar] = useState('')

  function abrirCrear() {
    setSerieEnEdicion(null)
    setValores(SERIE_VACIA)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(serie: SerieFolio) {
    setSerieEnEdicion(serie)
    setValores({ serie: serie.serie, folio_actual: serie.folio_actual })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function cerrarFormulario() {
    setFormularioAbierto(false)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.serie.trim()) {
      setErrorFormulario('Ingresa el nombre de la serie.')
      return
    }

    try {
      if (serieEnEdicion) {
        await editar.mutateAsync({ id: serieEnEdicion.id, datos: valores })
      } else {
        await crear.mutateAsync(valores)
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(extraerMensajeError(err, 'No se pudo guardar la serie. Intenta de nuevo.'))
    }
  }

  async function confirmarDesactivar() {
    if (!serieADesactivar) return
    await desactivar.mutateAsync(serieADesactivar.id)
    setSerieADesactivar(null)
  }

  function abrirReactivar(serie: SerieFolio) {
    setErrorReactivar('')
    setSerieAReactivar(serie)
  }

  function cerrarReactivar() {
    setErrorReactivar('')
    setSerieAReactivar(null)
  }

  async function confirmarReactivar() {
    if (!serieAReactivar) return
    setErrorReactivar('')

    try {
      await reactivar.mutateAsync(serieAReactivar.id)
      setSerieAReactivar(null)
    } catch (err) {
      setErrorReactivar(extraerMensajeError(err, 'No se pudo reactivar la serie. Intenta de nuevo.'))
    }
  }

  const columnas: ColumnaTabla<SerieFolio>[] = [
    { clave: 'serie', encabezado: 'Serie' },
<<<<<<< HEAD
    { clave: 'folio_actual', encabezado: 'Folio actual' },
=======
    { clave: 'folio_actual', alineacion: 'derecha', encabezado: 'Folio actual' },
    {
      // Lo que asigna el backend al timbrar: incrementa `folio_actual` y usa el resultado.
      clave: 'id',
      alineacion: 'derecha',
      encabezado: 'Próximo folio',
      render: (fila) => `${fila.serie}-${fila.folio_actual + 1}`,
    },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
<<<<<<< HEAD
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
=======
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          {fila.activo ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  return (
<<<<<<< HEAD
    <section className={styles.seccion}>
      <div className={styles.encabezadoSeccion}>
        <h2 className={styles.subtitulo}>Series de facturación</h2>
=======
    <FilaAjustes
      titulo="Series de facturación"
      descripcion="Cada factura timbrada toma el siguiente folio de una serie activa. Una serie desactivada conserva su historial."
    >
      <div className={styles.cardActions}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        <BotonPrimario onClick={abrirCrear}>Nueva serie</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando series…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={series ?? []}
          mensajeVacio="Todavía no hay series registradas."
          renderAcciones={(fila) => (
<<<<<<< HEAD
            <div className={styles.acciones}>
              <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
=======
            <div className="rowActions">
              <button type="button" className="actionLink" onClick={() => abrirEditar(fila)}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                Editar
              </button>
              {fila.activo ? (
                <button
                  type="button"
<<<<<<< HEAD
                  className={styles.enlaceAccionPeligro}
=======
                  className="dangerActionLink"
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                  onClick={() => setSerieADesactivar(fila)}
                >
                  Desactivar
                </button>
              ) : (
<<<<<<< HEAD
                <button type="button" className={styles.enlaceAccion} onClick={() => abrirReactivar(fila)}>
=======
                <button type="button" className="actionLink" onClick={() => abrirReactivar(fila)}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                  Reactivar
                </button>
              )}
            </div>
          )}
        />
      )}

      <Modal
        titulo={serieEnEdicion ? 'Editar serie' : 'Nueva serie'}
        abierto={formularioAbierto}
        onCerrar={cerrarFormulario}
      >
<<<<<<< HEAD
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
=======
        <form className="form formNarrow" onSubmit={alGuardar} noValidate>
          <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            Serie
            <input
              type="text"
              value={valores.serie}
              onChange={(evento) => setValores((v) => ({ ...v, serie: evento.target.value }))}
              required
            />
          </label>

<<<<<<< HEAD
          <label className={styles.campo}>
=======
          <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            Folio actual
            <input
              type="number"
              min="0"
              value={valores.folio_actual}
              onChange={(evento) => setValores((v) => ({ ...v, folio_actual: Number(evento.target.value) }))}
            />
          </label>

          {errorFormulario && (
<<<<<<< HEAD
            <p className={styles.error} role="alert">
=======
            <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              {errorFormulario}
            </p>
          )}

<<<<<<< HEAD
          <div className={styles.accionesFormulario}>
=======
          <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            <BotonPrimario type="button" variante="secundario" onClick={cerrarFormulario}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
              {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>

      <Modal titulo="Desactivar serie" abierto={Boolean(serieADesactivar)} onCerrar={() => setSerieADesactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar la serie "{serieADesactivar?.serie}"? Dejará de estar disponible para
          nuevas facturas, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres desactivar la serie "{serieADesactivar?.serie}"? Dejará de estar disponible para
          nuevas facturas, pero su historial se conserva.
        </p>
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <BotonPrimario variante="secundario" onClick={() => setSerieADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar serie" abierto={Boolean(serieAReactivar)} onCerrar={cerrarReactivar}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
=======
        <p className="confirmText">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          ¿Confirmas que quieres reactivar la serie "{serieAReactivar?.serie}"? Volverá a estar disponible para
          nuevas facturas.
        </p>

        {errorReactivar && (
<<<<<<< HEAD
          <p className={styles.error} role="alert">
=======
          <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            {errorReactivar}
          </p>
        )}

<<<<<<< HEAD
        <div className={styles.accionesFormulario}>
=======
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <BotonPrimario variante="secundario" onClick={cerrarReactivar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarReactivar} disabled={reactivar.isPending}>
            {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
          </BotonPrimario>
        </div>
      </Modal>
<<<<<<< HEAD
    </section>
=======
    </FilaAjustes>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  )
}
