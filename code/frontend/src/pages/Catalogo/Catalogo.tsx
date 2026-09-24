import { useState, type FormEvent } from 'react'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import type {
  Categoria,
  CategoriaFormulario,
  MateriaPrima,
  MateriaPrimaFormulario,
  Producto,
  ProductoFormulario,
  TipoCategoria,
} from '../../api/catalogo'
import {
  useCategorias,
  useCrearCategoria,
  useDesactivarCategoria,
  useEditarCategoria,
  useReactivarCategoria,
} from '../../hooks/useCategorias'
import {
  useCrearMateriaPrima,
  useDesactivarMateriaPrima,
  useEditarMateriaPrima,
  useMateriaPrima,
  useReactivarMateriaPrima,
} from '../../hooks/useMateriaPrima'
import {
  useCrearProducto,
  useDesactivarProducto,
  useEditarProducto,
  useProductos,
  useReactivarProducto,
} from '../../hooks/useProductos'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import styles from './Catalogo.module.css'

const ETIQUETAS_TIPO: Record<TipoCategoria, string> = {
  producto: 'Producto',
  materia_prima: 'Materia prima',
  ambos: 'Ambos',
}

interface ErrorGuardar {
  detail?: string
  [campo: string]: string | string[] | undefined
}

function extraerMensajeError(err: unknown, campos: string[], mensajePorDefecto: string): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: ErrorGuardar } }).response?.data
      : undefined

  if (datos?.detail) return datos.detail

  for (const campo of campos) {
    const valor = datos?.[campo]
    const primerMensaje = Array.isArray(valor) ? valor[0] : undefined
    if (primerMensaje) return primerMensaje
  }

  return mensajePorDefecto
}

type Pestaña = 'productos' | 'materia_prima' | 'categorias'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'productos', etiqueta: 'Productos' },
  { clave: 'materia_prima', etiqueta: 'Materia Prima' },
  { clave: 'categorias', etiqueta: 'Categorías' },
]

export function Catalogo() {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [pestaña, setPestaña] = useState<Pestaña>('productos')

  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Catálogo</h1>
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

      {pestaña === 'productos' && <PestañaProductos esAdmin={esAdmin} />}
      {pestaña === 'materia_prima' && <PestañaMateriaPrima esAdmin={esAdmin} />}
      {pestaña === 'categorias' && <PestañaCategorias esAdmin={esAdmin} />}
    </div>
  )
}

// --- Productos --------------------------------------------------------

const PRODUCTO_VACIO: ProductoFormulario = {
  nombre_producto: '',
  sku: '',
  descripcion_producto: '',
  categoria: 0,
  unidad_medida: '',
  precio_venta: '',
  costo_produccion: '0',
}

function PestañaProductos({ esAdmin }: { esAdmin: boolean }) {
  const { data: productos, isLoading } = useProductos()
  const { data: categorias } = useCategorias()
  const crear = useCrearProducto()
  const editar = useEditarProducto()
  const desactivar = useDesactivarProducto()
  const reactivar = useReactivarProducto()

  const categoriasDisponibles = (categorias ?? []).filter(
    (c) => c.activo && (c.tipo === 'producto' || c.tipo === 'ambos'),
  )

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Producto | null>(null)
  const [valores, setValores] = useState<ProductoFormulario>(PRODUCTO_VACIO)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<Producto | null>(null)
  const [aReactivar, setAReactivar] = useState<Producto | null>(null)

  function abrirCrear() {
    setEnEdicion(null)
    setValores({ ...PRODUCTO_VACIO, categoria: categoriasDisponibles[0]?.id ?? 0 })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(producto: Producto) {
    setEnEdicion(producto)
    setValores({
      nombre_producto: producto.nombre_producto,
      sku: producto.sku,
      descripcion_producto: producto.descripcion_producto,
      categoria: producto.categoria,
      unidad_medida: producto.unidad_medida,
      precio_venta: producto.precio_venta,
      costo_produccion: producto.costo_produccion,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.nombre_producto.trim() || !valores.sku.trim() || !valores.categoria) {
      setErrorFormulario('Completa nombre, SKU y categoría.')
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
        extraerMensajeError(err, ['sku', 'categoria', 'precio_venta'], 'No se pudo guardar el producto. Intenta de nuevo.'),
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

  const columnas: ColumnaTabla<Producto>[] = [
    { clave: 'nombre_producto', encabezado: 'Nombre' },
    { clave: 'sku', encabezado: 'SKU' },
    { clave: 'unidad_medida', encabezado: 'Unidad' },
    { clave: 'precio_venta', encabezado: 'Precio de venta' },
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
          <BotonPrimario onClick={abrirCrear}>Nuevo producto</BotonPrimario>
        </div>
      )}

      {isLoading ? (
        <p>Cargando productos…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={productos ?? []}
          mensajeVacio="Todavía no hay productos registrados."
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
        titulo={enEdicion ? 'Editar producto' : 'Nuevo producto'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre
            <input
              type="text"
              value={valores.nombre_producto}
              onChange={(e) => setValores((v) => ({ ...v, nombre_producto: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            SKU
            <input
              type="text"
              value={valores.sku}
              onChange={(e) => setValores((v) => ({ ...v, sku: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Descripción
            <textarea
              value={valores.descripcion_producto}
              onChange={(e) => setValores((v) => ({ ...v, descripcion_producto: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Categoría
            <select
              value={valores.categoria}
              onChange={(e) => setValores((v) => ({ ...v, categoria: Number(e.target.value) }))}
              required
            >
              <option value={0} disabled>
                Selecciona una categoría
              </option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
            Unidad de medida
            <input
              type="text"
              value={valores.unidad_medida}
              onChange={(e) => setValores((v) => ({ ...v, unidad_medida: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Precio de venta
            <input
              type="number"
              step="0.01"
              min="0"
              value={valores.precio_venta}
              onChange={(e) => setValores((v) => ({ ...v, precio_venta: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Costo de producción
            <input
              type="number"
              step="0.01"
              min="0"
              value={valores.costo_produccion}
              onChange={(e) => setValores((v) => ({ ...v, costo_produccion: e.target.value }))}
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

      <Modal titulo="Desactivar producto" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_producto}"? Dejará de estar disponible para
          nuevas ventas o compras, pero su historial se conserva.
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

      <Modal titulo="Reactivar producto" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_producto}"? Volverá a estar disponible como opción
          seleccionable en nuevas ventas o compras.
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

// --- Materia prima --------------------------------------------------------

const MATERIA_PRIMA_VACIA: MateriaPrimaFormulario = {
  nombre_item: '',
  categoria: 0,
  unidad_medida: '',
  costo_promedio: '0',
}

function PestañaMateriaPrima({ esAdmin }: { esAdmin: boolean }) {
  const { data: items, isLoading } = useMateriaPrima()
  const { data: categorias } = useCategorias()
  const crear = useCrearMateriaPrima()
  const editar = useEditarMateriaPrima()
  const desactivar = useDesactivarMateriaPrima()
  const reactivar = useReactivarMateriaPrima()

  const categoriasDisponibles = (categorias ?? []).filter(
    (c) => c.activo && (c.tipo === 'materia_prima' || c.tipo === 'ambos'),
  )

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<MateriaPrima | null>(null)
  const [valores, setValores] = useState<MateriaPrimaFormulario>(MATERIA_PRIMA_VACIA)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<MateriaPrima | null>(null)
  const [aReactivar, setAReactivar] = useState<MateriaPrima | null>(null)

  function abrirCrear() {
    setEnEdicion(null)
    setValores({ ...MATERIA_PRIMA_VACIA, categoria: categoriasDisponibles[0]?.id ?? 0 })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(item: MateriaPrima) {
    setEnEdicion(item)
    setValores({
      nombre_item: item.nombre_item,
      categoria: item.categoria,
      unidad_medida: item.unidad_medida,
      costo_promedio: item.costo_promedio,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.nombre_item.trim() || !valores.categoria) {
      setErrorFormulario('Completa nombre y categoría.')
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
        extraerMensajeError(err, ['categoria', 'costo_promedio'], 'No se pudo guardar la materia prima. Intenta de nuevo.'),
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

  const columnas: ColumnaTabla<MateriaPrima>[] = [
    { clave: 'nombre_item', encabezado: 'Nombre' },
    { clave: 'unidad_medida', encabezado: 'Unidad' },
    { clave: 'costo_promedio', encabezado: 'Costo promedio' },
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
    <div>
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nueva materia prima</BotonPrimario>
        </div>
      )}

      {isLoading ? (
        <p>Cargando materia prima…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={items ?? []}
          mensajeVacio="Todavía no hay materia prima registrada."
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
        titulo={enEdicion ? 'Editar materia prima' : 'Nueva materia prima'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre
            <input
              type="text"
              value={valores.nombre_item}
              onChange={(e) => setValores((v) => ({ ...v, nombre_item: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Categoría
            <select
              value={valores.categoria}
              onChange={(e) => setValores((v) => ({ ...v, categoria: Number(e.target.value) }))}
              required
            >
              <option value={0} disabled>
                Selecciona una categoría
              </option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
            Unidad de medida
            <input
              type="text"
              value={valores.unidad_medida}
              onChange={(e) => setValores((v) => ({ ...v, unidad_medida: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Costo promedio
            <input
              type="number"
              step="0.01"
              min="0"
              value={valores.costo_promedio}
              onChange={(e) => setValores((v) => ({ ...v, costo_promedio: e.target.value }))}
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

      <Modal titulo="Desactivar materia prima" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_item}"? Dejará de estar disponible para nuevas
          compras o producción, pero su historial se conserva.
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

      <Modal titulo="Reactivar materia prima" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_item}"? Volverá a estar disponible como opción
          seleccionable en nuevas compras o producción.
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

// --- Categorías --------------------------------------------------------

const CATEGORIA_VACIA: CategoriaFormulario = {
  nombre_categoria: '',
  descripcion_categoria: '',
  tipo: 'ambos',
}

function PestañaCategorias({ esAdmin }: { esAdmin: boolean }) {
  const { data: categorias, isLoading } = useCategorias()
  const crear = useCrearCategoria()
  const editar = useEditarCategoria()
  const desactivar = useDesactivarCategoria()
  const reactivar = useReactivarCategoria()

  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<Categoria | null>(null)
  const [valores, setValores] = useState<CategoriaFormulario>(CATEGORIA_VACIA)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [aDesactivar, setADesactivar] = useState<Categoria | null>(null)
  const [aReactivar, setAReactivar] = useState<Categoria | null>(null)

  function abrirCrear() {
    setEnEdicion(null)
    setValores(CATEGORIA_VACIA)
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  function abrirEditar(categoria: Categoria) {
    setEnEdicion(categoria)
    setValores({
      nombre_categoria: categoria.nombre_categoria,
      descripcion_categoria: categoria.descripcion_categoria,
      tipo: categoria.tipo,
    })
    setErrorFormulario('')
    setFormularioAbierto(true)
  }

  const alGuardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setErrorFormulario('')

    if (!valores.nombre_categoria.trim()) {
      setErrorFormulario('Ingresa el nombre de la categoría.')
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
        extraerMensajeError(err, ['nombre_categoria', 'tipo'], 'No se pudo guardar la categoría. Intenta de nuevo.'),
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

  const columnas: ColumnaTabla<Categoria>[] = [
    { clave: 'nombre_categoria', encabezado: 'Nombre' },
    { clave: 'tipo', encabezado: 'Tipo', render: (fila) => ETIQUETAS_TIPO[fila.tipo] },
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
    <div>
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nueva categoría</BotonPrimario>
        </div>
      )}

      {isLoading ? (
        <p>Cargando categorías…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={categorias ?? []}
          mensajeVacio="Todavía no hay categorías registradas."
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
        titulo={enEdicion ? 'Editar categoría' : 'Nueva categoría'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre
            <input
              type="text"
              value={valores.nombre_categoria}
              onChange={(e) => setValores((v) => ({ ...v, nombre_categoria: e.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Descripción
            <textarea
              value={valores.descripcion_categoria}
              onChange={(e) => setValores((v) => ({ ...v, descripcion_categoria: e.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Tipo
            <select
              value={valores.tipo}
              onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoCategoria }))}
              required
            >
              {(Object.keys(ETIQUETAS_TIPO) as TipoCategoria[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETAS_TIPO[tipo]}
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

      <Modal titulo="Desactivar categoría" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_categoria}"? Dejará de estar disponible para
          nuevos productos o materia prima.
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

      <Modal titulo="Reactivar categoría" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_categoria}"? Volverá a estar disponible como opción
          seleccionable para productos y materia prima.
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
