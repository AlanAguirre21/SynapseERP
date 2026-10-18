import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Icono } from '../../components/common/Icono'
import { Modal } from '../../components/common/Modal'
import type { AlertaStock } from '../../api/inventario'
import type { Sucursal, SucursalFormulario } from '../../api/sucursales'
import { useAlertasStock } from '../../hooks/useAlertasStock'
import {
  useCrearSucursal,
  useDesactivarSucursal,
  useEditarSucursal,
  useReactivarSucursal,
  useSucursales,
} from '../../hooks/useSucursales'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import styles from './Sucursales.module.css'

const SUCURSAL_VACIA: SucursalFormulario = {
  nombre_sucursal: '',
  ubicacion_sucursal: '',
  telefono_sucursal: '',
}

interface ErrorGuardarSucursal {
  detail?: string
  nombre_sucursal?: string[]
}

type FiltroEstado = 'todas' | 'activas' | 'inactivas'

interface SaludStock {
  bajoMinimo: number
  agotados: number
}

// El endpoint de alertas identifica la sucursal solo por su nombre e incluye
// inventario de sucursales inactivas. Como `006` impide dos sucursales activas
// con el mismo nombre, el conteo se asigna después únicamente a la activa.
// Misma prioridad que Inventario: existencia en cero (o menor) es "agotado".
function agruparAlertas(alertas: AlertaStock[]): Map<string, SaludStock> {
  const porSucursal = new Map<string, SaludStock>()
  for (const alerta of alertas) {
    const salud = porSucursal.get(alerta.sucursal) ?? { bajoMinimo: 0, agotados: 0 }
    if (Number(alerta.stock_actual) <= 0) salud.agotados += 1
    else salud.bajoMinimo += 1
    porSucursal.set(alerta.sucursal, salud)
  }
  return porSucursal
}

function urlMapa(ubicacion: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ubicacion)}`
}

// El `href` de `tel:` solo admite dígitos y `+`; el texto visible se deja tal cual.
function urlTelefono(telefono: string) {
  return `tel:${telefono.replace(/[^\d+]/g, '')}`
}

export function Sucursales() {
  const { data: usuario } = useUsuarioActual()
  const { data: sucursales, isLoading } = useSucursales()
  const crear = useCrearSucursal()
  const editar = useEditarSucursal()
  const desactivar = useDesactivarSucursal()
  const reactivar = useReactivarSucursal()

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [sucursalEnEdicion, setSucursalEnEdicion] = useState<Sucursal | null>(null)
  const [valores, setValores] = useState<SucursalFormulario>(SUCURSAL_VACIA)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [sucursalADesactivar, setSucursalADesactivar] = useState<Sucursal | null>(null)
  const [sucursalAReactivar, setSucursalAReactivar] = useState<Sucursal | null>(null)
  const [errorReactivar, setErrorReactivar] = useState('')

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')

  const esAdmin = usuario?.rol === 'admin'

  // `null` si las alertas no están disponibles (cargando o con error): las
  // tarjetas omiten la línea de stock y el indicador muestra "—".
  const { data: alertas } = useAlertasStock()
  const alertasPorSucursal = useMemo(() => (alertas ? agruparAlertas(alertas) : null), [alertas])

  function saludDe(sucursal: Sucursal): SaludStock | null {
    if (!alertasPorSucursal || !sucursal.activo) return null
    return alertasPorSucursal.get(sucursal.nombre_sucursal) ?? { bajoMinimo: 0, agotados: 0 }
  }

  const lista = useMemo(() => sucursales ?? [], [sucursales])

  const indicadores = useMemo(() => {
    const activas = lista.filter((s) => s.activo)
    const conAlertas = alertasPorSucursal
      ? activas.filter((s) => {
          const salud = alertasPorSucursal.get(s.nombre_sucursal)
          return salud && salud.bajoMinimo + salud.agotados > 0
        }).length
      : null
    return { activas: activas.length, inactivas: lista.length - activas.length, conAlertas }
  }, [lista, alertasPorSucursal])

  const filtradas = lista.filter((s) => {
    if (filtroEstado === 'activas') return s.activo
    if (filtroEstado === 'inactivas') return !s.activo
    return true
  })
  const hayFiltros = filtroEstado !== 'todas'

  function abrirCrear() {
    setSucursalEnEdicion(null)
    setValores(SUCURSAL_VACIA)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(sucursal: Sucursal) {
    setSucursalEnEdicion(sucursal)
    setValores({
      nombre_sucursal: sucursal.nombre_sucursal,
      ubicacion_sucursal: sucursal.ubicacion_sucursal,
      telefono_sucursal: sucursal.telefono_sucursal,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function cerrarFormulario() {
    setFormularioAbierto(false)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.nombre_sucursal.trim()) {
      setErrorFormulario('Ingresa el nombre de la sucursal.')
      return
    }

    try {
      if (sucursalEnEdicion) {
        await editar.mutateAsync({ id: sucursalEnEdicion.id, datos: valores })
      } else {
        await crear.mutateAsync(valores)
      }
      setFormularioAbierto(false)
    } catch (err) {
      const datos =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: ErrorGuardarSucursal } }).response?.data
          : undefined
      setErrorFormulario(
        datos?.detail ?? datos?.nombre_sucursal?.[0] ?? 'No se pudo guardar la sucursal. Intenta de nuevo.',
      )
    }
  }

  async function confirmarDesactivar() {
    if (!sucursalADesactivar) return
    await desactivar.mutateAsync(sucursalADesactivar.id)
    setSucursalADesactivar(null)
  }

  function abrirReactivar(sucursal: Sucursal) {
    setErrorReactivar('')
    setSucursalAReactivar(sucursal)
  }

  function cerrarReactivar() {
    setErrorReactivar('')
    setSucursalAReactivar(null)
  }

  async function confirmarReactivar() {
    if (!sucursalAReactivar) return
    setErrorReactivar('')

    try {
      await reactivar.mutateAsync(sucursalAReactivar.id)
      setSucursalAReactivar(null)
    } catch (err) {
      const datos =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: ErrorGuardarSucursal } }).response?.data
          : undefined
      setErrorReactivar(
        datos?.detail ?? datos?.nombre_sucursal?.[0] ?? 'No se pudo reactivar la sucursal. Intenta de nuevo.',
      )
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Sucursales</h1>
          <p className="pageHint">Ubicaciones físicas donde se guarda el inventario de la empresa.</p>
        </div>
        {esAdmin && <BotonPrimario onClick={abrirCrear}>Nueva sucursal</BotonPrimario>}
      </div>

      <div className="statRow">
        <div className="statTile">
          <span className="statLabel">Sucursales activas</span>
          <span className="statValue">{indicadores.activas}</span>
        </div>
        <div className="statTile">
          <span className="statLabel">Sucursales inactivas</span>
          <span className="statValue">{indicadores.inactivas}</span>
        </div>
        <div className={indicadores.conAlertas ? 'statTile statTileWarning' : 'statTile'}>
          <span className="statLabel">Con alertas de stock</span>
          <span className="statValue">{indicadores.conAlertas ?? '—'}</span>
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}>
            <option value="todas">Todas</option>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>
        </label>

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={() => setFiltroEstado('todas')}>
            Limpiar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <p>Cargando sucursales…</p>
      ) : (
        <>
          <span className="pageHint">{`Mostrando ${filtradas.length} de ${lista.length}`}</span>

          {filtradas.length === 0 ? (
            <div className="placeholderBox">
              <p className="emptyState">
                {lista.length === 0
                  ? 'Todavía no hay sucursales registradas.'
                  : 'Ninguna sucursal coincide con el filtro.'}
              </p>
            </div>
          ) : (
            <div className={styles.branchGrid}>
              {filtradas.map((sucursal) => (
                <TarjetaSucursal
                  key={sucursal.id}
                  sucursal={sucursal}
                  salud={saludDe(sucursal)}
                  esAdmin={esAdmin}
                  onEditar={() => abrirEditar(sucursal)}
                  onDesactivar={() => setSucursalADesactivar(sucursal)}
                  onReactivar={() => abrirReactivar(sucursal)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        titulo={sucursalEnEdicion ? 'Editar sucursal' : 'Nueva sucursal'}
        abierto={formularioAbierto}
        onCerrar={cerrarFormulario}
      >
        <form className="form" onSubmit={alGuardar} noValidate>
          <div className="formGrid">
            <label className="field formGridFull">
              Nombre
              <input
                type="text"
                value={valores.nombre_sucursal}
                onChange={(evento) => setValores((v) => ({ ...v, nombre_sucursal: evento.target.value }))}
                required
              />
            </label>

            <label className="field">
              Ubicación
              <input
                type="text"
                value={valores.ubicacion_sucursal}
                onChange={(evento) => setValores((v) => ({ ...v, ubicacion_sucursal: evento.target.value }))}
              />
            </label>

            <label className="field">
              Teléfono
              <input
                type="text"
                value={valores.telefono_sucursal}
                onChange={(evento) => setValores((v) => ({ ...v, telefono_sucursal: evento.target.value }))}
              />
            </label>
          </div>

          {errorFormulario && (
            <p className="errorMessage" role="alert">
              {errorFormulario}
            </p>
          )}

          <div className="formActions">
            <BotonPrimario type="button" variante="secundario" onClick={cerrarFormulario}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
              {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>

      <Modal
        titulo="Desactivar sucursal"
        abierto={Boolean(sucursalADesactivar)}
        onCerrar={() => setSucursalADesactivar(null)}
      >
        <p className="confirmText">
          ¿Confirmas que quieres desactivar la sucursal "{sucursalADesactivar?.nombre_sucursal}"? Dejará de estar
          disponible para nuevos movimientos, pero su historial se conserva.
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setSucursalADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar sucursal" abierto={Boolean(sucursalAReactivar)} onCerrar={cerrarReactivar}>
        <p className="confirmText">
          ¿Confirmas que quieres reactivar la sucursal "{sucursalAReactivar?.nombre_sucursal}"? Volverá a estar
          disponible para nuevos movimientos de inventario.
        </p>

        {errorReactivar && (
          <p className="errorMessage" role="alert">
            {errorReactivar}
          </p>
        )}

        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={cerrarReactivar}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={confirmarReactivar} disabled={reactivar.isPending}>
            {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
          </BotonPrimario>
        </div>
      </Modal>
    </div>
  )
}

// --- Tarjeta de sucursal ---------------------------------------------------------

interface TarjetaSucursalProps {
  sucursal: Sucursal
  salud: SaludStock | null
  esAdmin: boolean
  onEditar: () => void
  onDesactivar: () => void
  onReactivar: () => void
}

function TarjetaSucursal({ sucursal, salud, esAdmin, onEditar, onDesactivar, onReactivar }: TarjetaSucursalProps) {
  const idTitulo = `sucursal-${sucursal.id}`
  const ubicacion = sucursal.ubicacion_sucursal.trim()
  const telefono = sucursal.telefono_sucursal.trim()

  return (
    <article
      className={sucursal.activo ? `card ${styles.branchCard}` : `card ${styles.branchCard} ${styles.branchCardInactive}`}
      aria-labelledby={idTitulo}
    >
      <div className={styles.branchHeader}>
        <span className={styles.branchIcon}>
          <Icono nombre="sucursales" tamano={20} />
        </span>
        <h2 id={idTitulo} className={styles.branchName}>
          {sucursal.nombre_sucursal}
        </h2>
        <span className={sucursal.activo ? 'status statusSuccess' : 'status statusNeutral'}>
          {sucursal.activo ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      <dl className="factGrid">
        <div>
          <dt>Ubicación</dt>
          <dd className={styles.branchFact}>
            <span>{ubicacion || '—'}</span>
            {ubicacion && (
              <a className="link" href={urlMapa(ubicacion)} target="_blank" rel="noopener noreferrer">
                Ver en mapa
              </a>
            )}
          </dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{telefono ? <a className="link" href={urlTelefono(telefono)}>{telefono}</a> : '—'}</dd>
        </div>
      </dl>

      {salud && (
        <div className={styles.branchStock}>
          {salud.bajoMinimo + salud.agotados === 0 ? (
            <span className="status statusNeutral">Sin alertas</span>
          ) : (
            <>
              {salud.bajoMinimo > 0 && <span className="status statusWarning">{`${salud.bajoMinimo} bajo mínimo`}</span>}
              {salud.agotados > 0 && (
                <span className="status statusError">
                  {salud.agotados === 1 ? '1 agotado' : `${salud.agotados} agotados`}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {(sucursal.activo || esAdmin) && (
        <div className={styles.branchFooter}>
          {sucursal.activo && (
            <Link to={`/inventario?sucursal=${sucursal.id}`} className="link">
              Ver inventario
            </Link>
          )}
          {esAdmin && (
            <div className="rowActions">
              <button type="button" className="actionLink" onClick={onEditar}>
                Editar
              </button>
              {sucursal.activo ? (
                <button type="button" className="dangerActionLink" onClick={onDesactivar}>
                  Desactivar
                </button>
              ) : (
                <button type="button" className="actionLink" onClick={onReactivar}>
                  Reactivar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
