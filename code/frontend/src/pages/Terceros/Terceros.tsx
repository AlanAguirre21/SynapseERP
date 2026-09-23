import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import type { Cliente, ClienteFormulario, Proveedor, ProveedorFormulario } from '../../api/terceros'
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
import { useVentas } from '../../hooks/useVentas'
import styles from './Terceros.module.css'

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
    <div className={styles.selectorLimite} role="group" aria-label={etiqueta}>
      {(['5', '10', 'todos'] as LimiteLista[]).map((valor) => (
        <button
          key={valor}
          type="button"
          className={limite === valor ? `${styles.botonLimite} ${styles.botonLimiteActivo}` : styles.botonLimite}
          onClick={() => onCambiar(valor)}
        >
          {valor === 'todos' ? 'Todos' : valor}
        </button>
      ))}
    </div>
  )
}

type Pestaña = 'clientes' | 'proveedores'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'clientes', etiqueta: 'Clientes' },
  { clave: 'proveedores', etiqueta: 'Proveedores' },
]

export function Terceros() {
  const [pestaña, setPestaña] = useState<Pestaña>('clientes')

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Terceros</h1>
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

      {pestaña === 'clientes' && <PestañaClientes />}
      {pestaña === 'proveedores' && <PestañaProveedores />}
    </div>
  )
}

// --- Clientes ---------------------------------------------------------

const CLIENTE_VACIO: ClienteFormulario = {
  nombre_cliente: '',
  telefono: '',
  email: '',
  direccion: '',
  datos_fiscales: {
    rfc: '', razon_social: '', codigo_postal_fiscal: '', regimen_fiscal: '', uso_cfdi_default: '',
    requiere_factura: false,
  },
}

function PestañaClientes() {
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

  function abrirCrear() {
    setEnEdicion(null)
    setValores(CLIENTE_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(cliente: Cliente) {
    setEnEdicion(cliente)
    setValores({
      nombre_cliente: cliente.nombre_cliente,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      datos_fiscales: cliente.datos_fiscales ?? CLIENTE_VACIO.datos_fiscales,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
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
    },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.encabezado}>
        <span />
        <BotonPrimario onClick={abrirCrear}>Nuevo cliente</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando clientes…</p>
      ) : (
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

      <Modal
        titulo={enEdicion ? 'Editar cliente' : 'Nuevo cliente'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
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
              />
              Este cliente requiere factura
            </label>

            {valores.datos_fiscales.requiere_factura && (
              <>
                <label className={styles.campo}>
                  RFC
                  <input
                    type="text"
                    value={valores.datos_fiscales.rfc}
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
                  Código postal fiscal
                  <input
                    type="text"
                    value={valores.datos_fiscales.codigo_postal_fiscal}
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
            )}
          </div>

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

      <Modal titulo="Desactivar cliente" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_cliente}"? Dejará de aparecer como opción
          seleccionable en nuevas ventas, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar cliente" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_cliente}"? Volverá a estar disponible como opción
          seleccionable en nuevas ventas.
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
    </div>
  )
}

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

// --- Proveedores --------------------------------------------------------

const PROVEEDOR_VACIO: ProveedorFormulario = {
  nombre_proveedor: '', rfc: '', contacto_nombre: '', telefono: '', email: '', direccion: '',
}

function PestañaProveedores() {
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

  function abrirCrear() {
    setEnEdicion(null)
    setValores(PROVEEDOR_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

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
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.encabezado}>
        <span />
        <BotonPrimario onClick={abrirCrear}>Nuevo proveedor</BotonPrimario>
      </div>

      {isLoading ? (
        <p>Cargando proveedores…</p>
      ) : (
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

      <Modal
        titulo={enEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
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

      <Modal titulo="Desactivar proveedor" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_proveedor}"? Dejará de aparecer como opción
          seleccionable en nuevas compras, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar proveedor" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_proveedor}"? Volverá a estar disponible como
          opción seleccionable en nuevas compras.
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
    </div>
  )
}

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
