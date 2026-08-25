import { useState, type FormEvent } from 'react'

import type { UsuarioCuentaFormularioCreacion, UsuarioCuentaFormularioEdicion } from '../../api/usuarios'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import type { Cliente, ClienteFormulario, Empleado, EmpleadoFormulario, Proveedor, ProveedorFormulario } from '../../api/personas'
import {
  useClientes,
  useCrearCliente,
  useDesactivarCliente,
  useEditarCliente,
  useReactivarCliente,
} from '../../hooks/useClientes'
import {
  useCrearEmpleado,
  useDesactivarEmpleado,
  useEditarEmpleado,
  useEmpleados,
  useReactivarEmpleado,
} from '../../hooks/useEmpleados'
import {
  useCrearProveedor,
  useDesactivarProveedor,
  useEditarProveedor,
  useProveedores,
  useReactivarProveedor,
} from '../../hooks/useProveedores'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import {
  useCrearUsuario,
  useDesactivarUsuario,
  useEditarUsuario,
  useReactivarUsuario,
  useUsuarios,
} from '../../hooks/useUsuarios'
import type { UsuarioCuenta } from '../../api/usuarios'
import styles from './Personas.module.css'

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

type Pestaña = 'clientes' | 'proveedores' | 'empleados' | 'usuarios'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'clientes', etiqueta: 'Clientes' },
  { clave: 'proveedores', etiqueta: 'Proveedores' },
  { clave: 'empleados', etiqueta: 'Empleados' },
  { clave: 'usuarios', etiqueta: 'Usuarios' },
]

export function Personas() {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [pestaña, setPestaña] = useState<Pestaña>('clientes')

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Personas</h1>
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
      {pestaña === 'empleados' && <PestañaEmpleados esAdmin={esAdmin} />}
      {pestaña === 'usuarios' && <PestañaUsuarios esAdmin={esAdmin} />}
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
    { clave: 'nombre_cliente', encabezado: 'Nombre' },
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
    { clave: 'nombre_proveedor', encabezado: 'Nombre' },
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

// --- Empleados ------------------------------------------------------------

const EMPLEADO_VACIO: EmpleadoFormulario = {
  nombre_completo: '', puesto: '', telefono: '', email: '', fecha_contratacion: '', salario: '0',
}

function PestañaEmpleados({ esAdmin }: { esAdmin: boolean }) {
  const { data: empleados, isLoading } = useEmpleados()
  const crear = useCrearEmpleado()
  const editar = useEditarEmpleado()
  const desactivar = useDesactivarEmpleado()
  const reactivar = useReactivarEmpleado()

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Empleado | null>(null)
  const [valores, setValores] = useState<EmpleadoFormulario>(EMPLEADO_VACIO)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<Empleado | null>(null)
  const [aReactivar, setAReactivar] = useState<Empleado | null>(null)

  function abrirCrear() {
    setEnEdicion(null)
    setValores(EMPLEADO_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(empleado: Empleado) {
    setEnEdicion(empleado)
    setValores({
      nombre_completo: empleado.nombre_completo,
      puesto: empleado.puesto,
      telefono: empleado.telefono,
      email: empleado.email,
      fecha_contratacion: empleado.fecha_contratacion ?? '',
      salario: empleado.salario,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.nombre_completo.trim()) {
      setErrorFormulario('Ingresa el nombre completo del empleado.')
      return
    }

    // El input `date` deja `fecha_contratacion` en '' cuando está vacío,
    // pero el `DateField` de DRF solo acepta `null` — no una cadena vacía —
    // para un campo opcional.
    const datosAEnviar: EmpleadoFormulario = {
      ...valores,
      fecha_contratacion: valores.fecha_contratacion || null,
    }

    try {
      if (enEdicion) {
        await editar.mutateAsync({ id: enEdicion.id, datos: datosAEnviar })
      } else {
        await crear.mutateAsync(datosAEnviar)
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(
        extraerMensajeError(err, ['nombre_completo', 'salario'], 'No se pudo guardar el empleado. Intenta de nuevo.'),
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

  const columnas: ColumnaTabla<Empleado>[] = [
    { clave: 'nombre_completo', encabezado: 'Nombre' },
    { clave: 'puesto', encabezado: 'Puesto' },
    { clave: 'telefono', encabezado: 'Teléfono' },
    { clave: 'fecha_contratacion', encabezado: 'Contratación' },
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
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nuevo empleado</BotonPrimario>
        </div>
      )}

      {isLoading ? (
        <p>Cargando empleados…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={empleados ?? []}
          mensajeVacio="Todavía no hay empleados registrados."
          renderAcciones={
            esAdmin
              ? (fila) => (
                  <div className={styles.acciones}>
                    <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                      Editar
                    </button>
                    {fila.activo ? (
                      <button
                        type="button"
                        className={styles.enlaceAccionPeligro}
                        onClick={() => setADesactivar(fila)}
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button type="button" className={styles.enlaceAccion} onClick={() => setAReactivar(fila)}>
                        Reactivar
                      </button>
                    )}
                  </div>
                )
              : undefined
          }
        />
      )}

      <Modal
        titulo={enEdicion ? 'Editar empleado' : 'Nuevo empleado'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre completo
            <input
              type="text"
              value={valores.nombre_completo}
              onChange={(e) => setValores((v) => ({ ...v, nombre_completo: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Puesto
            <input
              type="text"
              value={valores.puesto}
              onChange={(e) => setValores((v) => ({ ...v, puesto: e.target.value }))}
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
            Fecha de contratación
            <input
              type="date"
              value={valores.fecha_contratacion ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, fecha_contratacion: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Salario
            <input
              type="number"
              step="0.01"
              min="0"
              value={valores.salario}
              onChange={(e) => setValores((v) => ({ ...v, salario: e.target.value }))}
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

      <Modal titulo="Desactivar empleado" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{aDesactivar?.nombre_completo}"? Su historial se conserva, pero
          dejará de aparecer como opción seleccionable para vincular a un usuario nuevo.
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

      <Modal titulo="Reactivar empleado" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar a "{aReactivar?.nombre_completo}"?
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

// --- Usuarios --------------------------------------------------------------

const USUARIO_VACIO: UsuarioCuentaFormularioCreacion = {
  first_name: '', last_name: '', email: '', rol_usuario: 'operador', empleado: null, password: '',
}

function PestañaUsuarios({ esAdmin }: { esAdmin: boolean }) {
  const { data: usuarios, isLoading } = useUsuarios()
  const { data: empleados } = useEmpleados()
  const crear = useCrearUsuario()
  const editar = useEditarUsuario()
  const desactivar = useDesactivarUsuario()
  const reactivar = useReactivarUsuario()

  const empleadosActivos = (empleados ?? []).filter((e) => e.activo)

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<UsuarioCuenta | null>(null)
  const [valores, setValores] = useState<UsuarioCuentaFormularioCreacion>(USUARIO_VACIO)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<UsuarioCuenta | null>(null)
  const [aReactivar, setAReactivar] = useState<UsuarioCuenta | null>(null)

  function abrirCrear() {
    setEnEdicion(null)
    setValores(USUARIO_VACIO)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(usuario: UsuarioCuenta) {
    setEnEdicion(usuario)
    setValores({
      first_name: usuario.first_name,
      last_name: usuario.last_name,
      email: usuario.email,
      rol_usuario: usuario.rol_usuario,
      empleado: usuario.empleado,
      password: '',
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.email.trim()) {
      setErrorFormulario('Ingresa el correo del usuario.')
      return
    }
    if (!enEdicion && !valores.password.trim()) {
      setErrorFormulario('Define una contraseña inicial para el usuario.')
      return
    }

    try {
      if (enEdicion) {
        const datosEdicion: UsuarioCuentaFormularioEdicion = {
          first_name: valores.first_name,
          last_name: valores.last_name,
          email: valores.email,
          rol_usuario: valores.rol_usuario,
          empleado: valores.empleado,
        }
        await editar.mutateAsync({ id: enEdicion.id, datos: datosEdicion })
      } else {
        await crear.mutateAsync(valores)
      }
      setFormularioAbierto(false)
    } catch (err) {
      setErrorFormulario(
        extraerMensajeError(err, ['email', 'password', 'rol_usuario'], 'No se pudo guardar el usuario. Intenta de nuevo.'),
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

  const columnas: ColumnaTabla<UsuarioCuenta>[] = [
    {
      clave: 'first_name',
      encabezado: 'Nombre',
      render: (fila) => `${fila.first_name} ${fila.last_name}`.trim() || fila.username,
    },
    { clave: 'email', encabezado: 'Correo' },
    {
      clave: 'rol_usuario',
      encabezado: 'Rol',
      render: (fila) => (fila.rol_usuario === 'admin' ? 'Administrador' : 'Operador'),
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
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nuevo usuario</BotonPrimario>
        </div>
      )}

      {isLoading ? (
        <p>Cargando usuarios…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={usuarios ?? []}
          mensajeVacio="Todavía no hay usuarios registrados."
          renderAcciones={
            esAdmin
              ? (fila) => (
                  <div className={styles.acciones}>
                    <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
                      Editar
                    </button>
                    {fila.activo ? (
                      <button
                        type="button"
                        className={styles.enlaceAccionPeligro}
                        onClick={() => setADesactivar(fila)}
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button type="button" className={styles.enlaceAccion} onClick={() => setAReactivar(fila)}>
                        Reactivar
                      </button>
                    )}
                  </div>
                )
              : undefined
          }
        />
      )}

      <Modal
        titulo={enEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre
            <input
              type="text"
              value={valores.first_name}
              onChange={(e) => setValores((v) => ({ ...v, first_name: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Apellido
            <input
              type="text"
              value={valores.last_name}
              onChange={(e) => setValores((v) => ({ ...v, last_name: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Correo
            <input
              type="email"
              value={valores.email}
              onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Rol
            <select
              value={valores.rol_usuario}
              onChange={(e) => setValores((v) => ({ ...v, rol_usuario: e.target.value as 'admin' | 'operador' }))}
            >
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <label className={styles.campo}>
            Empleado vinculado (opcional)
            <select
              value={valores.empleado ?? ''}
              onChange={(e) =>
                setValores((v) => ({ ...v, empleado: e.target.value ? Number(e.target.value) : null }))
              }
            >
              <option value="">Sin vincular</option>
              {empleadosActivos.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre_completo}
                </option>
              ))}
            </select>
          </label>

          {!enEdicion && (
            <label className={styles.campo}>
              Contraseña inicial
              <input
                type="password"
                value={valores.password}
                onChange={(e) => setValores((v) => ({ ...v, password: e.target.value }))}
                required
              />
            </label>
          )}

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

      <Modal titulo="Desactivar usuario" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar a "{aDesactivar?.email}"? Perderá acceso al sistema de inmediato, aunque
          su sesión actual todavía no haya expirado.
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

      <Modal titulo="Reactivar usuario" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar a "{aReactivar?.email}"? Podrá iniciar sesión de nuevo.
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
