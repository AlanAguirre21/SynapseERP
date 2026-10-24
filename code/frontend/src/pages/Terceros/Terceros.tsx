<<<<<<< HEAD
import { useState, type FormEvent } from 'react'
=======
import { useState, type FormEvent, type ReactNode } from 'react'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import { Link } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
<<<<<<< HEAD
import type { Cliente, ClienteFormulario, Proveedor, ProveedorFormulario } from '../../api/terceros'
=======
import { ETIQUETAS_ESTADO_COMPRA, type EstadoCompra } from '../../api/compras'
import { REGIMENES_FISCALES } from '../../api/configuracionFiscal'
import { USOS_CFDI } from '../../api/facturacion'
import type { Cliente, ClienteFormulario, DatosFiscalesCliente, Proveedor, ProveedorFormulario } from '../../api/terceros'
import { ETIQUETAS_ESTADO_VENTA, type EstadoVenta } from '../../api/ventas'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import {
  useClientes,
  useCrearCliente,
  useDesactivarCliente,
  useEditarCliente,
  useReactivarCliente,
} from '../../hooks/useClientes'
import { useCompras } from '../../hooks/useCompras'
import {
  useCrearProveedor,
  useDesactivarProveedor,
  useEditarProveedor,
  useProveedores,
  useReactivarProveedor,
} from '../../hooks/useProveedores'
<<<<<<< HEAD
import { useVentas } from '../../hooks/useVentas'
import styles from './Terceros.module.css'
=======
import { useSolicitudNuevo } from '../../hooks/useSolicitudNuevo'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { useVentas } from '../../hooks/useVentas'
import { formatearMoneda } from '../../utils/moneda'
import { normalizarBusqueda } from '../../utils/texto'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

function extraerMensajeError(err: unknown, campos: string[], mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined

  if (typeof datos?.detail === 'string') return datos.detail

  for (const campo of campos) {
    const valor = datos?.[campo]
    if (typeof valor === 'string') return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
  }

  return mensajePorDefecto
}

type LimiteLista = '5' | '10' | 'todos'

function alternarEnConjunto(conjunto: Set<number>, id: number): Set<number> {
  const nuevo = new Set(conjunto)
  if (nuevo.has(id)) nuevo.delete(id)
  else nuevo.add(id)
  return nuevo
}

function SelectorLimite({ limite, onCambiar, etiqueta }: {
  limite: LimiteLista
  onCambiar: (valor: LimiteLista) => void
  etiqueta: string
}) {
  return (
<<<<<<< HEAD
    <div className={styles.selectorLimite} role="group" aria-label={etiqueta}>
=======
    <div className="segmented" role="group" aria-label={etiqueta}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      {(['5', '10', 'todos'] as LimiteLista[]).map((valor) => (
        <button
          key={valor}
          type="button"
<<<<<<< HEAD
          className={limite === valor ? `${styles.botonLimite} ${styles.botonLimiteActivo}` : styles.botonLimite}
=======
          className={limite === valor ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          onClick={() => onCambiar(valor)}
        >
          {valor === 'todos' ? 'Todos' : valor}
        </button>
      ))}
    </div>
  )
}

<<<<<<< HEAD
type Pestaña = 'clientes' | 'proveedores'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'clientes', etiqueta: 'Clientes' },
  { clave: 'proveedores', etiqueta: 'Proveedores' },
=======
type FiltroEstado = 'todos' | 'activos' | 'inactivos'

function coincideEstado(activo: boolean, filtro: FiltroEstado): boolean {
  return filtro === 'todos' || (filtro === 'activos' ? activo : !activo)
}

// Coincidencia de la búsqueda (sin acentos ni mayúsculas) en cualquiera de los campos.
function coincideBusqueda(termino: string, campos: (string | undefined)[]): boolean {
  return !termino || campos.some((campo) => normalizarBusqueda(campo ?? '').includes(termino))
}

function FiltroEstadoSelect({ valor, onCambiar }: { valor: FiltroEstado; onCambiar: (valor: FiltroEstado) => void }) {
  return (
    <label className="filterField">
      Estado
      <select value={valor} onChange={(e) => onCambiar(e.target.value as FiltroEstado)}>
        <option value="todos">Todos</option>
        <option value="activos">Activos</option>
        <option value="inactivos">Inactivos</option>
      </select>
    </label>
  )
}

// --- Página -------------------------------------------------------------------

type Pestaña = 'clientes' | 'proveedores'

const PESTAÑAS: { clave: Pestaña; etiqueta: string; accion: string }[] = [
  { clave: 'clientes', etiqueta: 'Clientes', accion: 'Nuevo cliente' },
  { clave: 'proveedores', etiqueta: 'Proveedores', accion: 'Nuevo proveedor' },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
]

export function Terceros() {
  const [pestaña, setPestaña] = useState<Pestaña>('clientes')
<<<<<<< HEAD

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Terceros</h1>
      </div>

      <div className={styles.pestañas} role="tablist">
=======
  // La acción principal vive en el encabezado y cada modal de alta en su
  // pestaña; el contador conecta ambos (ver `useSolicitudNuevo`).
  const [solicitudes, setSolicitudes] = useState<Record<Pestaña, number>>({ clientes: 0, proveedores: 0 })
  const accion = PESTAÑAS.find((p) => p.clave === pestaña)?.accion

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Terceros</h1>
          <p className="pageHint">Clientes a quienes se vende y proveedores a quienes se compra, con su estado de cuenta.</p>
        </div>
        {accion && (
          <BotonPrimario onClick={() => setSolicitudes((s) => ({ ...s, [pestaña]: s[pestaña] + 1 }))}>
            {accion}
          </BotonPrimario>
        )}
      </div>

      <div className="tabs" role="tablist">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        {PESTAÑAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestaña === p.clave}
<<<<<<< HEAD
            className={pestaña === p.clave ? `${styles.pestaña} ${styles.pestañaActiva}` : styles.pestaña}
=======
            className={pestaña === p.clave ? 'tab tabActive' : 'tab'}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            onClick={() => setPestaña(p.clave)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

<<<<<<< HEAD
      {pestaña === 'clientes' && <PestañaClientes />}
      {pestaña === 'proveedores' && <PestañaProveedores />}
=======
      {pestaña === 'clientes' && <PestañaClientes solicitudNuevo={solicitudes.clientes} />}
      {pestaña === 'proveedores' && <PestañaProveedores solicitudNuevo={solicitudes.proveedores} />}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    </div>
  )
}

<<<<<<< HEAD
// --- Clientes ---------------------------------------------------------

=======
// --- Estado de cuenta (común a clientes y proveedores) -------------------------

interface DocumentoCuenta {
  id: number
  fecha: string
  total: string
  estado: string
  etiquetaEstado: string
  ruta: string
}

function claseEstadoDocumento(estado: string): string {
  if (estado === 'cancelada') return 'status statusError'
  if (estado === 'pendiente') return 'status statusWarning'
  return 'status statusSuccess'
}

function EstadoDeCuenta({
  titulo,
  etiquetaSelector,
  etiquetaDocumentos,
  etiquetaUltimo,
  documentos,
  cargando,
  mensajeVacio,
  ayuda,
}: {
  titulo: string
  etiquetaSelector: string
  etiquetaDocumentos: string
  etiquetaUltimo: string
  documentos: DocumentoCuenta[] | undefined
  cargando: boolean
  mensajeVacio: string
  // Aclaración bajo el título (ej. "Solo tus ventas…" para el operador).
  ayuda?: string
}) {
  const [limite, setLimite] = useState<LimiteLista>('5')

  const ordenados = [...(documentos ?? [])].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  const recortados = limite === 'todos' ? ordenados : ordenados.slice(0, Number(limite))
  // El importe no cuenta documentos cancelados, igual que los listados de Ventas y Compras.
  const importe = ordenados.filter((d) => d.estado !== 'cancelada').reduce((suma, d) => suma + Number(d.total), 0)
  const ultimo = ordenados[0]

  const columnas: ColumnaTabla<DocumentoCuenta>[] = [
    { clave: 'id', encabezado: 'Folio', render: (fila) => `#${fila.id}` },
    {
      clave: 'fecha',
      encabezado: 'Fecha',
      render: (fila) => (
        <span className="cellNoWrap">
          {new Date(fila.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    { clave: 'total', alineacion: 'derecha', encabezado: 'Total', render: (fila) => formatearMoneda(fila.total) },
    {
      clave: 'estado',
      encabezado: 'Estado',
      render: (fila) => <span className={claseEstadoDocumento(fila.estado)}>{fila.etiquetaEstado}</span>,
    },
    {
      clave: 'ruta',
      encabezado: 'Detalle',
      render: (fila) => (
        <Link to={fila.ruta} className="actionLink">
          Ver detalle
        </Link>
      ),
    },
  ]

  return (
    <div className="expandedSection">
      <div className="sectionHeader">
        <div className="pageHeading">
          <h3 className="subtitle">{titulo}</h3>
          {ayuda && <span className="fieldHint">{ayuda}</span>}
        </div>
        <SelectorLimite limite={limite} onCambiar={setLimite} etiqueta={etiquetaSelector} />
      </div>

      {cargando ? (
        <p>Cargando…</p>
      ) : ordenados.length === 0 ? (
        <p className="emptyState">{mensajeVacio}</p>
      ) : (
        <>
          <dl className="factGrid factGridThree">
            <div>
              <dt>{etiquetaDocumentos}</dt>
              <dd>{ordenados.length}</dd>
            </div>
            <div>
              <dt>Importe (sin cancelados)</dt>
              <dd>{formatearMoneda(importe)}</dd>
            </div>
            <div>
              <dt>{etiquetaUltimo}</dt>
              <dd>{ultimo ? new Date(ultimo.fecha).toLocaleDateString('es-MX') : '—'}</dd>
            </div>
          </dl>
          <Tabla columnas={columnas} datos={recortados} />
        </>
      )}
    </div>
  )
}

function VentasDeClienteSeccion({ cliente }: { cliente: Cliente }) {
  const { data: ventas, isLoading } = useVentas({ cliente: cliente.id })
  // Para el operador, el backend devuelve solo sus propias ventas.
  const { data: usuarioActual } = useUsuarioActual()

  return (
    <EstadoDeCuenta
      titulo={`Ventas de ${cliente.nombre_cliente}`}
      etiquetaSelector="Cantidad de ventas a mostrar"
      etiquetaDocumentos="Ventas"
      etiquetaUltimo="Última venta"
      cargando={isLoading}
      mensajeVacio="Este cliente todavía no tiene ventas registradas."
      ayuda={usuarioActual?.rol === 'admin' ? undefined : 'Solo tus ventas a este cliente.'}
      documentos={ventas?.map((v) => ({
        id: v.id,
        fecha: v.fecha,
        total: v.total,
        estado: v.estado,
        etiquetaEstado: ETIQUETAS_ESTADO_VENTA[v.estado as EstadoVenta] ?? v.estado,
        ruta: `/ventas/${v.id}`,
      }))}
    />
  )
}

function ComprasDeProveedorSeccion({ proveedor }: { proveedor: Proveedor }) {
  const { data: compras, isLoading } = useCompras({ proveedor: proveedor.id })
  // Para el operador, el backend devuelve solo sus propias compras.
  const { data: usuarioActual } = useUsuarioActual()

  return (
    <EstadoDeCuenta
      titulo={`Compras a ${proveedor.nombre_proveedor}`}
      etiquetaSelector="Cantidad de compras a mostrar"
      etiquetaDocumentos="Compras"
      etiquetaUltimo="Última compra"
      cargando={isLoading}
      mensajeVacio="Este proveedor todavía no tiene compras registradas."
      ayuda={usuarioActual?.rol === 'admin' ? undefined : 'Solo tus compras a este proveedor.'}
      documentos={compras?.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        total: c.total,
        estado: c.estado,
        etiquetaEstado: ETIQUETAS_ESTADO_COMPRA[c.estado as EstadoCompra] ?? c.estado,
        ruta: `/compras/${c.id}`,
      }))}
    />
  )
}

// Campo con su descripción del catálogo del SAT como ayuda enlazada: fuera de
// la etiqueta, para que el nombre accesible del campo no cambie.
function CampoConCatalogo({
  id,
  etiqueta,
  valor,
  catalogo,
  onCambiar,
}: {
  id: string
  etiqueta: string
  valor: string
  catalogo: { valor: string; etiqueta: string }[]
  onCambiar: (valor: string) => void
}) {
  const descripcion = catalogo.find((opcion) => opcion.valor === valor.trim())?.etiqueta
  return (
    <div className="field">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        type="text"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-describedby={descripcion ? `${id}-descripcion` : undefined}
      />
      {descripcion && (
        <span id={`${id}-descripcion`} className="fieldHint">
          {descripcion}
        </span>
      )}
    </div>
  )
}

function AccionesFila({
  activo,
  onEditar,
  onDesactivar,
  onReactivar,
}: {
  activo: boolean
  onEditar: () => void
  onDesactivar: () => void
  onReactivar: () => void
}) {
  return (
    <div className="rowActions">
      <button type="button" className="actionLink" onClick={onEditar}>
        Editar
      </button>
      {activo ? (
        <button type="button" className="dangerActionLink" onClick={onDesactivar}>
          Desactivar
        </button>
      ) : (
        <button type="button" className="actionLink" onClick={onReactivar}>
          Reactivar
        </button>
      )}
    </div>
  )
}

function BotonExpandir({ abierto, onAlternar, children }: { abierto: boolean; onAlternar: () => void; children: ReactNode }) {
  return (
    <button type="button" className="expandLink" onClick={onAlternar} aria-expanded={abierto}>
      <span className="expandIndicator">{abierto ? '▾' : '▸'}</span>
      {children}
    </button>
  )
}

// --- Clientes ---------------------------------------------------------

const DATOS_FISCALES_VACIOS: DatosFiscalesCliente = {
  rfc: '', razon_social: '', codigo_postal_fiscal: '', regimen_fiscal: '', uso_cfdi_default: '',
  requiere_factura: false,
}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
const CLIENTE_VACIO: ClienteFormulario = {
  nombre_cliente: '',
  telefono: '',
  email: '',
  direccion: '',
<<<<<<< HEAD
  datos_fiscales: {
    rfc: '', razon_social: '', codigo_postal_fiscal: '', regimen_fiscal: '', uso_cfdi_default: '',
    requiere_factura: false,
  },
}

function PestañaClientes() {
=======
  datos_fiscales: DATOS_FISCALES_VACIOS,
}

type FiltroFactura = '' | 'requiere' | 'no_requiere'

function PestañaClientes({ solicitudNuevo }: { solicitudNuevo: number }) {
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const { data: clientes, isLoading } = useClientes()
  const crear = useCrearCliente()
  const editar = useEditarCliente()
  const desactivar = useDesactivarCliente()
  const reactivar = useReactivarCliente()

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Cliente | null>(null)
  const [valores, setValores] = useState<ClienteFormulario>(CLIENTE_VACIO)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<Cliente | null>(null)
  const [aReactivar, setAReactivar] = useState<Cliente | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

<<<<<<< HEAD
=======
  const [busqueda, setBusqueda] = useState('')
  const [factura, setFactura] = useState<FiltroFactura>('')
  const [estado, setEstado] = useState<FiltroEstado>('todos')

  const termino = normalizarBusqueda(busqueda)
  const lista = clientes ?? []
  const filtrados = lista.filter(
    (c) =>
      coincideEstado(c.activo, estado) &&
      (!factura || Boolean(c.datos_fiscales?.requiere_factura) === (factura === 'requiere')) &&
      coincideBusqueda(termino, [c.nombre_cliente, c.datos_fiscales?.rfc, c.telefono, c.email]),
  )
  const hayFiltros = Boolean(busqueda.trim() || factura || estado !== 'todos')

  function limpiarFiltros() {
    setBusqueda('')
    setFactura('')
    setEstado('todos')
  }

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  function abrirCrear() {
    setEnEdicion(null)
    setValores(CLIENTE_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

<<<<<<< HEAD
=======
  useSolicitudNuevo(solicitudNuevo, abrirCrear)

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  function abrirEditar(cliente: Cliente) {
    setEnEdicion(cliente)
    setValores({
      nombre_cliente: cliente.nombre_cliente,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
<<<<<<< HEAD
      datos_fiscales: cliente.datos_fiscales ?? CLIENTE_VACIO.datos_fiscales,
=======
      datos_fiscales: cliente.datos_fiscales ?? DATOS_FISCALES_VACIOS,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

<<<<<<< HEAD
=======
  function actualizarFiscal(cambios: Partial<DatosFiscalesCliente>) {
    setValores((v) => ({ ...v, datos_fiscales: { ...v.datos_fiscales, ...cambios } }))
  }

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.nombre_cliente.trim()) {
      setErrorFormulario('Ingresa el nombre del cliente.')
      return
    }

    try {
      if (enEdicion) {
        await editar.mutateAsync({ id: enEdicion.id, datos: valores })
      } else {
        await crear.mutateAsync(valores)
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(
        extraerMensajeError(err, ['nombre_cliente', 'datos_fiscales'], 'No se pudo guardar el cliente. Intenta de nuevo.'),
      )
    }
  }

  async function confirmarDesactivar() {
    if (!aDesactivar) return
    await desactivar.mutateAsync(aDesactivar.id)
    setADesactivar(null)
  }

  async function confirmarReactivar() {
    if (!aReactivar) return
    await reactivar.mutateAsync(aReactivar.id)
    setAReactivar(null)
  }

  const columnas: ColumnaTabla<Cliente>[] = [
    {
      clave: 'nombre_cliente',
      encabezado: 'Nombre',
      render: (fila) => (
<<<<<<< HEAD
        <button
          type="button"
          className={styles.enlaceExpandir}
          onClick={() => setExpandidos((actual) => alternarEnConjunto(actual, fila.id))}
          aria-expanded={expandidos.has(fila.id)}
        >
          <span className={styles.indicadorExpandir}>{expandidos.has(fila.id) ? '▾' : '▸'}</span>
          {fila.nombre_cliente}
        </button>
      ),
    },
    { clave: 'telefono', encabezado: 'Teléfono' },
    { clave: 'email', encabezado: 'Correo' },
    {
      clave: 'datos_fiscales',
      encabezado: 'Factura',
      render: (fila) => (fila.datos_fiscales?.requiere_factura ? 'Sí' : 'No'),
=======
        <BotonExpandir
          abierto={expandidos.has(fila.id)}
          onAlternar={() => setExpandidos((actual) => alternarEnConjunto(actual, fila.id))}
        >
          {fila.nombre_cliente}
        </BotonExpandir>
      ),
    },
    { clave: 'telefono', encabezado: 'Teléfono', render: (fila) => fila.telefono || '—' },
    { clave: 'email', encabezado: 'Correo', render: (fila) => fila.email || '—' },
    {
      clave: 'datos_fiscales',
      encabezado: 'Factura',
      render: (fila) =>
        fila.datos_fiscales?.requiere_factura ? (
          <span className="cellNoWrap">{fila.datos_fiscales.rfc || 'Sí'}</span>
        ) : (
          '—'
        ),
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
<<<<<<< HEAD
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
=======
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
<<<<<<< HEAD
    <div>
      <div className={styles.encabezado}>
        <span />
        <BotonPrimario onClick={abrirCrear}>Nuevo cliente</BotonPrimario>
=======
    <div className="tabPanel">
      <div className="filters">
        <label className="filterField">
          Buscar
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o RFC"
          />
        </label>

        <label className="filterField">
          Factura
          <select value={factura} onChange={(e) => setFactura(e.target.value as FiltroFactura)}>
            <option value="">Todos</option>
            <option value="requiere">Requiere factura</option>
            <option value="no_requiere">No requiere</option>
          </select>
        </label>

        <FiltroEstadoSelect valor={estado} onCambiar={setEstado} />

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      </div>

      {isLoading ? (
        <p>Cargando clientes…</p>
      ) : (
<<<<<<< HEAD
        <Tabla
          columnas={columnas}
          datos={clientes ?? []}
          mensajeVacio="Todavía no hay clientes registrados."
          renderAcciones={(fila) => (
            <div className={styles.acciones}>
              <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                Editar
              </button>
              {fila.activo ? (
                <button type="button" className={styles.enlaceAccionPeligro} onClick={() => setADesactivar(fila)}>
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

      {[...expandidos].map((id) => {
        const cliente = (clientes ?? []).find((c) => c.id === id)
        return cliente ? <VentasDeClienteSeccion key={id} cliente={cliente} /> : null
      })}

=======
        <>
          <span className="pageHint">{`Mostrando ${filtrados.length} de ${lista.length}`}</span>
          <Tabla
            columnas={columnas}
            datos={filtrados}
            mensajeVacio={
              hayFiltros ? 'Ningún cliente coincide con los filtros.' : 'Todavía no hay clientes registrados.'
            }
            renderAcciones={(fila) => (
              <AccionesFila
                activo={fila.activo}
                onEditar={() => abrirEditar(fila)}
                onDesactivar={() => setADesactivar(fila)}
                onReactivar={() => setAReactivar(fila)}
              />
            )}
            renderExpandido={(fila) => (expandidos.has(fila.id) ? <VentasDeClienteSeccion cliente={fila} /> : null)}
          />
        </>
      )}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      <Modal
        titulo={enEdicion ? 'Editar cliente' : 'Nuevo cliente'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
<<<<<<< HEAD
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre
            <input
              type="text"
              value={valores.nombre_cliente}
              onChange={(e) => setValores((v) => ({ ...v, nombre_cliente: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Teléfono
            <input
              type="text"
              value={valores.telefono}
              onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Correo
            <input
              type="email"
              value={valores.email}
              onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Dirección
            <input
              type="text"
              value={valores.direccion}
              onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
            />
          </label>

          <div className={styles.seccionFiscal}>
            <h3 className={styles.seccionFiscalTitulo}>Datos fiscales</h3>

            <label className={styles.campoCasilla}>
              <input
                type="checkbox"
                checked={valores.datos_fiscales.requiere_factura}
                onChange={(e) =>
                  setValores((v) => ({
                    ...v,
                    datos_fiscales: { ...v.datos_fiscales, requiere_factura: e.target.checked },
                  }))
                }
=======
        ancho="amplio"
      >
        <form className="form" onSubmit={alGuardar} noValidate>
          <h3 className="subtitle">Contacto</h3>
          <div className="formGrid">
            <label className="field formGridFull">
              Nombre
              <input
                type="text"
                value={valores.nombre_cliente}
                onChange={(e) => setValores((v) => ({ ...v, nombre_cliente: e.target.value }))}
                required
              />
            </label>

            <label className="field">
              Teléfono
              <input
                type="text"
                value={valores.telefono}
                onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
              />
            </label>

            <label className="field">
              Correo
              <input
                type="email"
                value={valores.email}
                onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
              />
            </label>

            <label className="field formGridFull">
              Dirección
              <input
                type="text"
                value={valores.direccion}
                onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
              />
            </label>
          </div>

          <div className="fieldGroup">
            <h3 className="subtitle">Datos fiscales</h3>

            <label className="fieldCheckbox">
              <input
                type="checkbox"
                checked={valores.datos_fiscales.requiere_factura}
                onChange={(e) => actualizarFiscal({ requiere_factura: e.target.checked })}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              />
              Este cliente requiere factura
            </label>

            {valores.datos_fiscales.requiere_factura && (
<<<<<<< HEAD
              <>
                <label className={styles.campo}>
=======
              <div className="formGrid">
                <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                  RFC
                  <input
                    type="text"
                    value={valores.datos_fiscales.rfc}
<<<<<<< HEAD
                    onChange={(e) =>
                      setValores((v) => ({ ...v, datos_fiscales: { ...v.datos_fiscales, rfc: e.target.value } }))
                    }
                  />
                </label>

                <label className={styles.campo}>
                  Razón social
                  <input
                    type="text"
                    value={valores.datos_fiscales.razon_social}
                    onChange={(e) =>
                      setValores((v) => ({
                        ...v,
                        datos_fiscales: { ...v.datos_fiscales, razon_social: e.target.value },
                      }))
                    }
                  />
                </label>

                <label className={styles.campo}>
=======
                    onChange={(e) => actualizarFiscal({ rfc: e.target.value })}
                  />
                </label>

                <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                  Código postal fiscal
                  <input
                    type="text"
                    value={valores.datos_fiscales.codigo_postal_fiscal}
<<<<<<< HEAD
                    onChange={(e) =>
                      setValores((v) => ({
                        ...v,
                        datos_fiscales: { ...v.datos_fiscales, codigo_postal_fiscal: e.target.value },
                      }))
                    }
                  />
                </label>

                <label className={styles.campo}>
                  Régimen fiscal
                  <input
                    type="text"
                    value={valores.datos_fiscales.regimen_fiscal}
                    onChange={(e) =>
                      setValores((v) => ({
                        ...v,
                        datos_fiscales: { ...v.datos_fiscales, regimen_fiscal: e.target.value },
                      }))
                    }
                  />
                </label>

                <label className={styles.campo}>
                  Uso de CFDI por defecto
                  <input
                    type="text"
                    value={valores.datos_fiscales.uso_cfdi_default}
                    onChange={(e) =>
                      setValores((v) => ({
                        ...v,
                        datos_fiscales: { ...v.datos_fiscales, uso_cfdi_default: e.target.value },
                      }))
                    }
                  />
                </label>
              </>
=======
                    onChange={(e) => actualizarFiscal({ codigo_postal_fiscal: e.target.value })}
                  />
                </label>

                <label className="field formGridFull">
                  Razón social
                  <input
                    type="text"
                    value={valores.datos_fiscales.razon_social}
                    onChange={(e) => actualizarFiscal({ razon_social: e.target.value })}
                  />
                </label>

                <CampoConCatalogo
                  id="cliente-regimen-fiscal"
                  etiqueta="Régimen fiscal"
                  valor={valores.datos_fiscales.regimen_fiscal}
                  catalogo={REGIMENES_FISCALES}
                  onCambiar={(regimen_fiscal) => actualizarFiscal({ regimen_fiscal })}
                />

                <CampoConCatalogo
                  id="cliente-uso-cfdi"
                  etiqueta="Uso de CFDI por defecto"
                  valor={valores.datos_fiscales.uso_cfdi_default}
                  catalogo={USOS_CFDI}
                  onCambiar={(uso_cfdi_default) => actualizarFiscal({ uso_cfdi_default })}
                />
              </div>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            )}
          </div>

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
            <BotonPrimario type="button" variante="secundario" onClick={() => setFormularioAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
              {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>

      <Modal titulo="Desactivar cliente" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_cliente}"? Dejará de aparecer como opción
          seleccionable en nuevas ventas, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_cliente}"? Dejará de aparecer como opción
          seleccionable en nuevas ventas, pero su historial se conserva.
        </p>
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar cliente" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_cliente}"? Volverá a estar disponible como opción
          seleccionable en nuevas ventas.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_cliente}"? Volverá a estar disponible como opción
          seleccionable en nuevas ventas.
        </p>
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <BotonPrimario variante="secundario" onClick={() => setAReactivar(null)}>
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

<<<<<<< HEAD
function VentasDeClienteSeccion({ cliente }: { cliente: Cliente }) {
  const { data: ventas, isLoading } = useVentas({ cliente: cliente.id })
  const [limite, setLimite] = useState<LimiteLista>('5')

  const ordenadas = [...(ventas ?? [])].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )
  const cantidad = limite === 'todos' ? ordenadas.length : Number(limite)
  const recortadas = ordenadas.slice(0, cantidad)

  return (
    <div className={styles.seccionExpandida}>
      <div className={styles.encabezadoExpandido}>
        <h3 className={styles.subtituloExpandido}>Ventas de {cliente.nombre_cliente}</h3>
        <SelectorLimite limite={limite} onCambiar={setLimite} etiqueta="Cantidad de ventas a mostrar" />
      </div>

      {isLoading ? (
        <p>Cargando ventas…</p>
      ) : recortadas.length === 0 ? (
        <p className={styles.vacio}>Este cliente todavía no tiene ventas registradas.</p>
      ) : (
        <ul className={styles.listaExpandida}>
          {recortadas.map((venta) => (
            <li key={venta.id}>
              <span>{new Date(venta.fecha).toLocaleString('es-MX')}</span>
              <Link to={`/ventas/${venta.id}`} className={styles.enlaceAccion}>Ver detalle</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

=======
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
// --- Proveedores --------------------------------------------------------

const PROVEEDOR_VACIO: ProveedorFormulario = {
  nombre_proveedor: '', rfc: '', contacto_nombre: '', telefono: '', email: '', direccion: '',
}

<<<<<<< HEAD
function PestañaProveedores() {
=======
function PestañaProveedores({ solicitudNuevo }: { solicitudNuevo: number }) {
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const { data: proveedores, isLoading } = useProveedores()
  const crear = useCrearProveedor()
  const editar = useEditarProveedor()
  const desactivar = useDesactivarProveedor()
  const reactivar = useReactivarProveedor()

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Proveedor | null>(null)
  const [valores, setValores] = useState<ProveedorFormulario>(PROVEEDOR_VACIO)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<Proveedor | null>(null)
  const [aReactivar, setAReactivar] = useState<Proveedor | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

<<<<<<< HEAD
=======
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('todos')

  const termino = normalizarBusqueda(busqueda)
  const lista = proveedores ?? []
  const filtrados = lista.filter(
    (p) =>
      coincideEstado(p.activo, estado) &&
      coincideBusqueda(termino, [p.nombre_proveedor, p.rfc, p.contacto_nombre, p.telefono, p.email]),
  )
  const hayFiltros = Boolean(busqueda.trim() || estado !== 'todos')

  function limpiarFiltros() {
    setBusqueda('')
    setEstado('todos')
  }

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  function abrirCrear() {
    setEnEdicion(null)
    setValores(PROVEEDOR_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

<<<<<<< HEAD
=======
  useSolicitudNuevo(solicitudNuevo, abrirCrear)

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  function abrirEditar(proveedor: Proveedor) {
    setEnEdicion(proveedor)
    setValores({
      nombre_proveedor: proveedor.nombre_proveedor,
      rfc: proveedor.rfc,
      contacto_nombre: proveedor.contacto_nombre,
      telefono: proveedor.telefono,
      email: proveedor.email,
      direccion: proveedor.direccion,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.nombre_proveedor.trim()) {
      setErrorFormulario('Ingresa el nombre del proveedor.')
      return
    }

    try {
      if (enEdicion) {
        await editar.mutateAsync({ id: enEdicion.id, datos: valores })
      } else {
        await crear.mutateAsync(valores)
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(
        extraerMensajeError(err, ['nombre_proveedor'], 'No se pudo guardar el proveedor. Intenta de nuevo.'),
      )
    }
  }

  async function confirmarDesactivar() {
    if (!aDesactivar) return
    await desactivar.mutateAsync(aDesactivar.id)
    setADesactivar(null)
  }

  async function confirmarReactivar() {
    if (!aReactivar) return
    await reactivar.mutateAsync(aReactivar.id)
    setAReactivar(null)
  }

  const columnas: ColumnaTabla<Proveedor>[] = [
    {
      clave: 'nombre_proveedor',
      encabezado: 'Nombre',
      render: (fila) => (
<<<<<<< HEAD
        <button
          type="button"
          className={styles.enlaceExpandir}
          onClick={() => setExpandidos((actual) => alternarEnConjunto(actual, fila.id))}
          aria-expanded={expandidos.has(fila.id)}
        >
          <span className={styles.indicadorExpandir}>{expandidos.has(fila.id) ? '▾' : '▸'}</span>
          {fila.nombre_proveedor}
        </button>
      ),
    },
    { clave: 'contacto_nombre', encabezado: 'Contacto' },
    { clave: 'telefono', encabezado: 'Teléfono' },
    { clave: 'email', encabezado: 'Correo' },
=======
        <BotonExpandir
          abierto={expandidos.has(fila.id)}
          onAlternar={() => setExpandidos((actual) => alternarEnConjunto(actual, fila.id))}
        >
          {fila.nombre_proveedor}
        </BotonExpandir>
      ),
    },
    { clave: 'rfc', encabezado: 'RFC', render: (fila) => <span className="cellNoWrap">{fila.rfc || '—'}</span> },
    { clave: 'contacto_nombre', encabezado: 'Contacto', render: (fila) => fila.contacto_nombre || '—' },
    { clave: 'telefono', encabezado: 'Teléfono', render: (fila) => fila.telefono || '—' },
    { clave: 'email', encabezado: 'Correo', render: (fila) => fila.email || '—' },
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
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
<<<<<<< HEAD
    <div>
      <div className={styles.encabezado}>
        <span />
        <BotonPrimario onClick={abrirCrear}>Nuevo proveedor</BotonPrimario>
=======
    <div className="tabPanel">
      <div className="filters">
        <label className="filterField">
          Buscar
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o RFC"
          />
        </label>

        <FiltroEstadoSelect valor={estado} onCambiar={setEstado} />

        {hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      </div>

      {isLoading ? (
        <p>Cargando proveedores…</p>
      ) : (
<<<<<<< HEAD
        <Tabla
          columnas={columnas}
          datos={proveedores ?? []}
          mensajeVacio="Todavía no hay proveedores registrados."
          renderAcciones={(fila) => (
            <div className={styles.acciones}>
              <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                Editar
              </button>
              {fila.activo ? (
                <button type="button" className={styles.enlaceAccionPeligro} onClick={() => setADesactivar(fila)}>
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

      {[...expandidos].map((id) => {
        const proveedor = (proveedores ?? []).find((p) => p.id === id)
        return proveedor ? <ComprasDeProveedorSeccion key={id} proveedor={proveedor} /> : null
      })}

=======
        <>
          <span className="pageHint">{`Mostrando ${filtrados.length} de ${lista.length}`}</span>
          <Tabla
            columnas={columnas}
            datos={filtrados}
            mensajeVacio={
              hayFiltros ? 'Ningún proveedor coincide con los filtros.' : 'Todavía no hay proveedores registrados.'
            }
            renderAcciones={(fila) => (
              <AccionesFila
                activo={fila.activo}
                onEditar={() => abrirEditar(fila)}
                onDesactivar={() => setADesactivar(fila)}
                onReactivar={() => setAReactivar(fila)}
              />
            )}
            renderExpandido={(fila) =>
              expandidos.has(fila.id) ? <ComprasDeProveedorSeccion proveedor={fila} /> : null
            }
          />
        </>
      )}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      <Modal
        titulo={enEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
<<<<<<< HEAD
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre
            <input
              type="text"
              value={valores.nombre_proveedor}
              onChange={(e) => setValores((v) => ({ ...v, nombre_proveedor: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            RFC
            <input
              type="text"
              value={valores.rfc}
              onChange={(e) => setValores((v) => ({ ...v, rfc: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Nombre de contacto
            <input
              type="text"
              value={valores.contacto_nombre}
              onChange={(e) => setValores((v) => ({ ...v, contacto_nombre: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Teléfono
            <input
              type="text"
              value={valores.telefono}
              onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Correo
            <input
              type="email"
              value={valores.email}
              onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Dirección
            <input
              type="text"
              value={valores.direccion}
              onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
            />
          </label>

          {errorFormulario && (
            <p className={styles.error} role="alert">
=======
        ancho="amplio"
      >
        <form className="form" onSubmit={alGuardar} noValidate>
          <div className="formGrid">
            <label className="field">
              Nombre
              <input
                type="text"
                value={valores.nombre_proveedor}
                onChange={(e) => setValores((v) => ({ ...v, nombre_proveedor: e.target.value }))}
                required
              />
            </label>

            <label className="field">
              RFC
              <input
                type="text"
                value={valores.rfc}
                onChange={(e) => setValores((v) => ({ ...v, rfc: e.target.value }))}
              />
            </label>

            <label className="field">
              Nombre de contacto
              <input
                type="text"
                value={valores.contacto_nombre}
                onChange={(e) => setValores((v) => ({ ...v, contacto_nombre: e.target.value }))}
              />
            </label>

            <label className="field">
              Teléfono
              <input
                type="text"
                value={valores.telefono}
                onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
              />
            </label>

            <label className="field">
              Correo
              <input
                type="email"
                value={valores.email}
                onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
              />
            </label>

            <label className="field formGridFull">
              Dirección
              <input
                type="text"
                value={valores.direccion}
                onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
              />
            </label>
          </div>

          {errorFormulario && (
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
            <BotonPrimario type="button" variante="secundario" onClick={() => setFormularioAbierto(false)}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario type="submit" disabled={crear.isPending || editar.isPending}>
              {crear.isPending || editar.isPending ? 'Guardando…' : 'Guardar'}
            </BotonPrimario>
          </div>
        </form>
      </Modal>

      <Modal titulo="Desactivar proveedor" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_proveedor}"? Dejará de aparecer como opción
          seleccionable en nuevas compras, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_proveedor}"? Dejará de aparecer como opción
          seleccionable en nuevas compras, pero su historial se conserva.
        </p>
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar proveedor" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_proveedor}"? Volverá a estar disponible como
          opción seleccionable en nuevas compras.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_proveedor}"? Volverá a estar disponible como
          opción seleccionable en nuevas compras.
        </p>
        <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <BotonPrimario variante="secundario" onClick={() => setAReactivar(null)}>
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
<<<<<<< HEAD

function ComprasDeProveedorSeccion({ proveedor }: { proveedor: Proveedor }) {
  const { data: compras, isLoading } = useCompras({ proveedor: proveedor.id })
  const [limite, setLimite] = useState<LimiteLista>('5')

  const ordenadas = [...(compras ?? [])].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )
  const cantidad = limite === 'todos' ? ordenadas.length : Number(limite)
  const recortadas = ordenadas.slice(0, cantidad)

  return (
    <div className={styles.seccionExpandida}>
      <div className={styles.encabezadoExpandido}>
        <h3 className={styles.subtituloExpandido}>Compras a {proveedor.nombre_proveedor}</h3>
        <SelectorLimite limite={limite} onCambiar={setLimite} etiqueta="Cantidad de compras a mostrar" />
      </div>

      {isLoading ? (
        <p>Cargando compras…</p>
      ) : recortadas.length === 0 ? (
        <p className={styles.vacio}>Este proveedor todavía no tiene compras registradas.</p>
      ) : (
        <ul className={styles.listaExpandida}>
          {recortadas.map((compra) => (
            <li key={compra.id}>
              <span>{new Date(compra.fecha).toLocaleString('es-MX')}</span>
              <Link to={`/compras/${compra.id}`} className={styles.enlaceAccion}>Ver detalle</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
=======
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
