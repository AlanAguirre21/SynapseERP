import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import { ETIQUETAS_ESTADO_COMPRA, type EstadoCompra } from '../../api/compras'
import { REGIMENES_FISCALES } from '../../api/configuracionFiscal'
import { USOS_CFDI } from '../../api/facturacion'
import type { Cliente, ClienteFormulario, DatosFiscalesCliente, Proveedor, ProveedorFormulario } from '../../api/terceros'
import { ETIQUETAS_ESTADO_VENTA, type EstadoVenta } from '../../api/ventas'
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
import { useSolicitudNuevo } from '../../hooks/useSolicitudNuevo'
import { useVentas } from '../../hooks/useVentas'
import { formatearMoneda } from '../../utils/moneda'
import { normalizarBusqueda } from '../../utils/texto'

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
    <div className="segmented" role="group" aria-label={etiqueta}>
      {(['5', '10', 'todos'] as LimiteLista[]).map((valor) => (
        <button
          key={valor}
          type="button"
          className={limite === valor ? 'segmentedOption segmentedOptionActive' : 'segmentedOption'}
          onClick={() => onCambiar(valor)}
        >
          {valor === 'todos' ? 'Todos' : valor}
        </button>
      ))}
    </div>
  )
}

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
]

export function Terceros() {
  const [pestaña, setPestaña] = useState<Pestaña>('clientes')
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

      {pestaña === 'clientes' && <PestañaClientes solicitudNuevo={solicitudes.clientes} />}
      {pestaña === 'proveedores' && <PestañaProveedores solicitudNuevo={solicitudes.proveedores} />}
    </div>
  )
}

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
}: {
  titulo: string
  etiquetaSelector: string
  etiquetaDocumentos: string
  etiquetaUltimo: string
  documentos: DocumentoCuenta[] | undefined
  cargando: boolean
  mensajeVacio: string
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
        <h3 className="subtitle">{titulo}</h3>
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

  return (
    <EstadoDeCuenta
      titulo={`Ventas de ${cliente.nombre_cliente}`}
      etiquetaSelector="Cantidad de ventas a mostrar"
      etiquetaDocumentos="Ventas"
      etiquetaUltimo="Última venta"
      cargando={isLoading}
      mensajeVacio="Este cliente todavía no tiene ventas registradas."
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

  return (
    <EstadoDeCuenta
      titulo={`Compras a ${proveedor.nombre_proveedor}`}
      etiquetaSelector="Cantidad de compras a mostrar"
      etiquetaDocumentos="Compras"
      etiquetaUltimo="Última compra"
      cargando={isLoading}
      mensajeVacio="Este proveedor todavía no tiene compras registradas."
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

const CLIENTE_VACIO: ClienteFormulario = {
  nombre_cliente: '',
  telefono: '',
  email: '',
  direccion: '',
  datos_fiscales: DATOS_FISCALES_VACIOS,
}

type FiltroFactura = '' | 'requiere' | 'no_requiere'

function PestañaClientes({ solicitudNuevo }: { solicitudNuevo: number }) {
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

  function abrirCrear() {
    setEnEdicion(null)
    setValores(CLIENTE_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  useSolicitudNuevo(solicitudNuevo, abrirCrear)

  function abrirEditar(cliente: Cliente) {
    setEnEdicion(cliente)
    setValores({
      nombre_cliente: cliente.nombre_cliente,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      datos_fiscales: cliente.datos_fiscales ?? DATOS_FISCALES_VACIOS,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function actualizarFiscal(cambios: Partial<DatosFiscalesCliente>) {
    setValores((v) => ({ ...v, datos_fiscales: { ...v.datos_fiscales, ...cambios } }))
  }

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
    },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
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
      </div>

      {isLoading ? (
        <p>Cargando clientes…</p>
      ) : (
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

      <Modal
        titulo={enEdicion ? 'Editar cliente' : 'Nuevo cliente'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
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
              />
              Este cliente requiere factura
            </label>

            {valores.datos_fiscales.requiere_factura && (
              <div className="formGrid">
                <label className="field">
                  RFC
                  <input
                    type="text"
                    value={valores.datos_fiscales.rfc}
                    onChange={(e) => actualizarFiscal({ rfc: e.target.value })}
                  />
                </label>

                <label className="field">
                  Código postal fiscal
                  <input
                    type="text"
                    value={valores.datos_fiscales.codigo_postal_fiscal}
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
            )}
          </div>

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

      <Modal titulo="Desactivar cliente" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_cliente}"? Dejará de aparecer como opción
          seleccionable en nuevas ventas, pero su historial se conserva.
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar cliente" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_cliente}"? Volverá a estar disponible como opción
          seleccionable en nuevas ventas.
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
    </div>
  )
}

// --- Proveedores --------------------------------------------------------

const PROVEEDOR_VACIO: ProveedorFormulario = {
  nombre_proveedor: '', rfc: '', contacto_nombre: '', telefono: '', email: '', direccion: '',
}

function PestañaProveedores({ solicitudNuevo }: { solicitudNuevo: number }) {
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

  function abrirCrear() {
    setEnEdicion(null)
    setValores(PROVEEDOR_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  useSolicitudNuevo(solicitudNuevo, abrirCrear)

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
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
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
      </div>

      {isLoading ? (
        <p>Cargando proveedores…</p>
      ) : (
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

      <Modal
        titulo={enEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
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

      <Modal titulo="Desactivar proveedor" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_proveedor}"? Dejará de aparecer como opción
          seleccionable en nuevas compras, pero su historial se conserva.
        </p>
        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar proveedor" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className="confirmText">
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_proveedor}"? Volverá a estar disponible como
          opción seleccionable en nuevas compras.
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
    </div>
  )
}
