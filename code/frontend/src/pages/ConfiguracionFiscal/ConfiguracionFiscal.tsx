import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import type {
  ConfiguracionPACFormulario,
  DatosFiscalesEmpresaFormulario,
  SerieFolio,
  SerieFolioFormulario,
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

  const configuracionIncompleta =
    !datosFiscalesCargando && !pacCargando && (datosFiscales?.completa === false || pac?.completa === false)

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
    </div>
  )
}

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
              {error}
            </p>
          )}
          {exito && (
            <p className={styles.exito} role="status">
              Datos fiscales actualizados.
            </p>
          )}

          <div className={styles.accionesFormulario}>
            <BotonPrimario type="submit" disabled={actualizar.isPending}>
              {actualizar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      )}
    </section>
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
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {exito && (
            <p className={styles.exito} role="status">
              Conexión al PAC actualizada.
            </p>
          )}

          <div className={styles.accionesFormulario}>
            <BotonPrimario type="submit" disabled={actualizar.isPending}>
              {actualizar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      )}
    </section>
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
    { clave: 'folio_actual', encabezado: 'Folio actual' },
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
        <h2 className={styles.subtitulo}>Series de facturación</h2>
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
            <div className={styles.acciones}>
              <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                Editar
              </button>
              {fila.activo ? (
                <button
                  type="button"
                  className={styles.enlaceAccionPeligro}
                  onClick={() => setSerieADesactivar(fila)}
                >
                  Desactivar
                </button>
              ) : (
                <button type="button" className={styles.enlaceAccion} onClick={() => abrirReactivar(fila)}>
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
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Serie
            <input
              type="text"
              value={valores.serie}
              onChange={(evento) => setValores((v) => ({ ...v, serie: evento.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Folio actual
            <input
              type="number"
              min="0"
              value={valores.folio_actual}
              onChange={(evento) => setValores((v) => ({ ...v, folio_actual: Number(evento.target.value) }))}
            />
          </label>

          {errorFormulario && (
            <p className={styles.error} role="alert">
              {errorFormulario}
            </p>
          )}

          <div className={styles.accionesFormulario}>
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
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar la serie "{serieADesactivar?.serie}"? Dejará de estar disponible para
          nuevas facturas, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setSerieADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar serie" abierto={Boolean(serieAReactivar)} onCerrar={cerrarReactivar}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar la serie "{serieAReactivar?.serie}"? Volverá a estar disponible para
          nuevas facturas.
        </p>

        {errorReactivar && (
          <p className={styles.error} role="alert">
            {errorReactivar}
          </p>
        )}

        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={cerrarReactivar}>
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
