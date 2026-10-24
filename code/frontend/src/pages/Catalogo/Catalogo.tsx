<<<<<<< HEAD
import { useState, type FormEvent } from 'react'
=======
import { useMemo, useState, type FormEvent } from 'react'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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
<<<<<<< HEAD
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import styles from './Catalogo.module.css'
=======
import { useSolicitudNuevo } from '../../hooks/useSolicitudNuevo'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { formatearMoneda } from '../../utils/moneda'
import { normalizarBusqueda } from '../../utils/texto'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
type Pestaña = 'productos' | 'materia_prima' | 'categorias'

const PESTAÑAS: { clave: Pestaña; etiqueta: string }[] = [
  { clave: 'productos', etiqueta: 'Productos' },
  { clave: 'materia_prima', etiqueta: 'Materia Prima' },
  { clave: 'categorias', etiqueta: 'Categorías' },
=======
// Margen sobre el precio de venta, en porcentaje. `null` cuando no hay costo
// o precio capturado: un margen del 100 % por un costo en cero engañaría.
function calcularMargen(precio: string | number, costo: string | number): number | null {
  const p = Number(precio)
  const c = Number(costo)
  if (!(p > 0) || !(c > 0)) return null
  return ((p - c) / p) * 100
}

function MargenTexto({ margen }: { margen: number | null }) {
  if (margen === null) return <>—</>
  const texto = `${margen.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  // Precio por debajo del costo: se marca, es algo que revisar.
  return margen < 0 ? <span className="textError">{texto}</span> : <>{texto}</>
}

// --- Filtros comunes ---------------------------------------------------------

type FiltroEstado = 'todos' | 'activos' | 'inactivos'

// Filtra en pantalla una lista ya cargada: búsqueda de texto (sin acentos ni
// mayúsculas), estado y un filtro extra por pestaña (categoría o tipo).
function useFiltrosCatalogo<T extends { activo: boolean }>(
  lista: T[],
  textosDe: (item: T) => string[],
  extraDe: (item: T) => string,
) {
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [extra, setExtra] = useState('')

  const termino = normalizarBusqueda(busqueda)
  const filtrados = lista.filter(
    (item) =>
      (estado === 'todos' || (estado === 'activos' ? item.activo : !item.activo)) &&
      (!extra || extraDe(item) === extra) &&
      (!termino || textosDe(item).some((texto) => normalizarBusqueda(texto).includes(termino))),
  )

  return {
    busqueda,
    setBusqueda,
    estado,
    setEstado,
    extra,
    setExtra,
    filtrados,
    hayFiltros: Boolean(busqueda.trim() || estado !== 'todos' || extra),
    limpiar: () => {
      setBusqueda('')
      setEstado('todos')
      setExtra('')
    },
  }
}

function BarraFiltros({
  filtros,
  placeholder,
  extra,
  total,
}: {
  filtros: ReturnType<typeof useFiltrosCatalogo<{ activo: boolean }>>
  placeholder: string
  extra: { etiqueta: string; opciones: { valor: string; etiqueta: string }[] }
  total: number
}) {
  return (
    <>
      <div className="filters">
        <label className="filterField">
          Buscar
          <input
            type="search"
            value={filtros.busqueda}
            onChange={(e) => filtros.setBusqueda(e.target.value)}
            placeholder={placeholder}
          />
        </label>

        <label className="filterField">
          {extra.etiqueta}
          <select value={filtros.extra} onChange={(e) => filtros.setExtra(e.target.value)}>
            <option value="">Todas</option>
            {extra.opciones.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="filterField">
          Estado
          <select value={filtros.estado} onChange={(e) => filtros.setEstado(e.target.value as FiltroEstado)}>
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>

        {filtros.hayFiltros && (
          <button type="button" className="actionLink filtersEnd" onClick={filtros.limpiar}>
            Limpiar filtros
          </button>
        )}
      </div>

      <span className="pageHint">{`Mostrando ${filtros.filtrados.length} de ${total}`}</span>
    </>
  )
}

function opcionesCategoria(categorias: Categoria[], tipos: TipoCategoria[]) {
  return categorias
    .filter((c) => tipos.includes(c.tipo))
    .map((c) => ({ valor: String(c.id), etiqueta: c.nombre_categoria }))
}

// --- Página -------------------------------------------------------------------

type Pestaña = 'productos' | 'materia_prima' | 'categorias'

const PESTAÑAS: { clave: Pestaña; etiqueta: string; accion: string }[] = [
  { clave: 'productos', etiqueta: 'Productos', accion: 'Nuevo producto' },
  { clave: 'materia_prima', etiqueta: 'Materia Prima', accion: 'Nueva materia prima' },
  { clave: 'categorias', etiqueta: 'Categorías', accion: 'Nueva categoría' },
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
]

export function Catalogo() {
  const { data: usuario } = useUsuarioActual()
  const esAdmin = usuario?.rol === 'admin'
  const [pestaña, setPestaña] = useState<Pestaña>('productos')

<<<<<<< HEAD
  return (
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Catálogo</h1>
      </div>

      <div className={styles.pestañas} role="tablist">
=======
  // La acción principal vive en el encabezado, pero cada modal de alta en su
  // pestaña: el botón incrementa el contador de la pestaña activa y esta abre
  // su formulario al ver un valor nuevo.
  const [solicitudes, setSolicitudes] = useState<Record<Pestaña, number>>({
    productos: 0,
    materia_prima: 0,
    categorias: 0,
  })
  const accion = PESTAÑAS.find((p) => p.clave === pestaña)?.accion

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Catálogo</h1>
          <p className="pageHint">Productos que se venden, materia prima que se compra y las categorías que los agrupan.</p>
        </div>
        {esAdmin && accion && (
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
      {pestaña === 'productos' && <PestañaProductos esAdmin={esAdmin} />}
      {pestaña === 'materia_prima' && <PestañaMateriaPrima esAdmin={esAdmin} />}
      {pestaña === 'categorias' && <PestañaCategorias esAdmin={esAdmin} />}
=======
      {pestaña === 'productos' && <PestañaProductos esAdmin={esAdmin} solicitudNuevo={solicitudes.productos} />}
      {pestaña === 'materia_prima' && (
        <PestañaMateriaPrima esAdmin={esAdmin} solicitudNuevo={solicitudes.materia_prima} />
      )}
      {pestaña === 'categorias' && <PestañaCategorias esAdmin={esAdmin} solicitudNuevo={solicitudes.categorias} />}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

<<<<<<< HEAD
function PestañaProductos({ esAdmin }: { esAdmin: boolean }) {
=======
function PestañaProductos({ esAdmin, solicitudNuevo }: { esAdmin: boolean; solicitudNuevo: number }) {
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const { data: productos, isLoading } = useProductos()
  const { data: categorias } = useCategorias()
  const crear = useCrearProducto()
  const editar = useEditarProducto()
  const desactivar = useDesactivarProducto()
  const reactivar = useReactivarProducto()

  const categoriasDisponibles = (categorias ?? []).filter(
    (c) => c.activo && (c.tipo === 'producto' || c.tipo === 'ambos'),
  )
<<<<<<< HEAD
=======
  const nombreCategoria = (id: number) => (categorias ?? []).find((c) => c.id === id)?.nombre_categoria ?? '—'

  const filtros = useFiltrosCatalogo(
    productos ?? [],
    (p) => [p.nombre_producto, p.sku],
    (p) => String(p.categoria),
  )
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
=======
  useSolicitudNuevo(solicitudNuevo, abrirCrear)

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
    { clave: 'sku', encabezado: 'SKU' },
    { clave: 'unidad_medida', encabezado: 'Unidad' },
    { clave: 'precio_venta', encabezado: 'Precio de venta' },
=======
    { clave: 'sku', encabezado: 'SKU', render: (fila) => <span className="cellNoWrap">{fila.sku}</span> },
    { clave: 'categoria', encabezado: 'Categoría', render: (fila) => nombreCategoria(fila.categoria) },
    { clave: 'unidad_medida', encabezado: 'Unidad' },
    {
      clave: 'precio_venta',
      alineacion: 'derecha',
      encabezado: 'Precio de venta',
      render: (fila) => formatearMoneda(fila.precio_venta),
    },
    {
      clave: 'costo_produccion',
      alineacion: 'derecha',
      encabezado: 'Costo de producción',
      render: (fila) => formatearMoneda(fila.costo_produccion),
    },
    {
      clave: 'descripcion_producto',
      alineacion: 'derecha',
      encabezado: 'Margen',
      render: (fila) => <MargenTexto margen={calcularMargen(fila.precio_venta, fila.costo_produccion)} />,
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
          {fila.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
<<<<<<< HEAD
    <div>
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nuevo producto</BotonPrimario>
        </div>
      )}
=======
    <div className="tabPanel">
      <BarraFiltros
        filtros={filtros}
        placeholder="Nombre o SKU"
        extra={{ etiqueta: 'Categoría', opciones: opcionesCategoria(categorias ?? [], ['producto', 'ambos']) }}
        total={(productos ?? []).length}
      />
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

      {isLoading ? (
        <p>Cargando productos…</p>
      ) : (
        <Tabla
          columnas={columnas}
<<<<<<< HEAD
          datos={productos ?? []}
          mensajeVacio="Todavía no hay productos registrados."
          renderAcciones={
            esAdmin
              ? (fila) => (
                  <div className={styles.acciones}>
                    <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
=======
          datos={filtros.filtrados}
          mensajeVacio={
            filtros.hayFiltros ? 'Ningún producto coincide con los filtros.' : 'Todavía no hay productos registrados.'
          }
          renderAcciones={
            esAdmin
              ? (fila) => (
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
                        onClick={() => setADesactivar(fila)}
                      >
                        Desactivar
                      </button>
                    ) : (
<<<<<<< HEAD
                      <button type="button" className={styles.enlaceAccion} onClick={() => setAReactivar(fila)}>
=======
                      <button type="button" className="actionLink" onClick={() => setAReactivar(fila)}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
                        Reactivar
                      </button>
                    )}
                  </div>
                )
              : undefined
          }
        />
      )}

<<<<<<< HEAD
=======
      {/* El costo de producción se captura a mano y no se actualiza desde
          Producción: el margen se aclara como estimado (nota fuera del
          encabezado para no ensanchar la tabla). */}
      <p className="pageHint">El margen se calcula con el costo de producción capturado en el catálogo.</p>

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      <Modal
        titulo={enEdicion ? 'Editar producto' : 'Nuevo producto'}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
<<<<<<< HEAD
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
=======
        ancho="amplio"
      >
        <form className="form" onSubmit={alGuardar} noValidate>
          <h3 className="subtitle">Identificación</h3>
          <div className="formGrid">
            <label className="field formGridFull">
              Nombre
              <input
                type="text"
                value={valores.nombre_producto}
                onChange={(e) => setValores((v) => ({ ...v, nombre_producto: e.target.value }))}
                required
              />
            </label>

            <label className="field">
              SKU
              <input
                type="text"
                value={valores.sku}
                onChange={(e) => setValores((v) => ({ ...v, sku: e.target.value }))}
                required
              />
            </label>

            <label className="field">
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

            <label className="field">
              Unidad de medida
              <input
                type="text"
                value={valores.unidad_medida}
                onChange={(e) => setValores((v) => ({ ...v, unidad_medida: e.target.value }))}
                required
              />
            </label>

            <label className="field formGridFull">
              Descripción
              <textarea
                value={valores.descripcion_producto}
                onChange={(e) => setValores((v) => ({ ...v, descripcion_producto: e.target.value }))}
              />
            </label>
          </div>

          <h3 className="subtitle">Precio y costo</h3>
          <div className="formGrid">
            <label className="field">
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

            <label className="field">
              Costo de producción
              <input
                type="number"
                step="0.01"
                min="0"
                value={valores.costo_produccion}
                onChange={(e) => setValores((v) => ({ ...v, costo_produccion: e.target.value }))}
              />
            </label>

            <p className="fieldHint formGridFull" data-testid="margen-vista-previa">
              Margen estimado: <MargenTexto margen={calcularMargen(valores.precio_venta, valores.costo_produccion)} />
            </p>
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

      <Modal titulo="Desactivar producto" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_producto}"? Dejará de estar disponible para
          nuevas ventas o compras, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_producto}"? Dejará de estar disponible para
          nuevas ventas o compras, pero su historial se conserva.
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

      <Modal titulo="Reactivar producto" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_producto}"? Volverá a estar disponible como opción
          seleccionable en nuevas ventas o compras.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_producto}"? Volverá a estar disponible como opción
          seleccionable en nuevas ventas o compras.
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

// --- Materia prima --------------------------------------------------------

const MATERIA_PRIMA_VACIA: MateriaPrimaFormulario = {
  nombre_item: '',
  categoria: 0,
  unidad_medida: '',
  costo_promedio: '0',
}

<<<<<<< HEAD
function PestañaMateriaPrima({ esAdmin }: { esAdmin: boolean }) {
=======
function PestañaMateriaPrima({ esAdmin, solicitudNuevo }: { esAdmin: boolean; solicitudNuevo: number }) {
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const { data: items, isLoading } = useMateriaPrima()
  const { data: categorias } = useCategorias()
  const crear = useCrearMateriaPrima()
  const editar = useEditarMateriaPrima()
  const desactivar = useDesactivarMateriaPrima()
  const reactivar = useReactivarMateriaPrima()

  const categoriasDisponibles = (categorias ?? []).filter(
    (c) => c.activo && (c.tipo === 'materia_prima' || c.tipo === 'ambos'),
  )
<<<<<<< HEAD
=======
  const nombreCategoria = (id: number) => (categorias ?? []).find((c) => c.id === id)?.nombre_categoria ?? '—'

  const filtros = useFiltrosCatalogo(
    items ?? [],
    (m) => [m.nombre_item],
    (m) => String(m.categoria),
  )
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

<<<<<<< HEAD
=======
  useSolicitudNuevo(solicitudNuevo, abrirCrear)

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
    { clave: 'unidad_medida', encabezado: 'Unidad' },
    { clave: 'costo_promedio', encabezado: 'Costo promedio' },
=======
    { clave: 'categoria', encabezado: 'Categoría', render: (fila) => nombreCategoria(fila.categoria) },
    { clave: 'unidad_medida', encabezado: 'Unidad' },
    {
      clave: 'costo_promedio',
      alineacion: 'derecha',
      encabezado: 'Costo promedio',
      render: (fila) => formatearMoneda(fila.costo_promedio),
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
    <div>
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nueva materia prima</BotonPrimario>
        </div>
      )}
=======
    <div className="tabPanel">
      <BarraFiltros
        filtros={filtros}
        placeholder="Nombre"
        extra={{ etiqueta: 'Categoría', opciones: opcionesCategoria(categorias ?? [], ['materia_prima', 'ambos']) }}
        total={(items ?? []).length}
      />
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

      {isLoading ? (
        <p>Cargando materia prima…</p>
      ) : (
        <Tabla
          columnas={columnas}
<<<<<<< HEAD
          datos={items ?? []}
          mensajeVacio="Todavía no hay materia prima registrada."
          renderAcciones={
            esAdmin
              ? (fila) => (
                  <div className={styles.acciones}>
                    <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
=======
          datos={filtros.filtrados}
          mensajeVacio={
            filtros.hayFiltros
              ? 'Ninguna materia prima coincide con los filtros.'
              : 'Todavía no hay materia prima registrada.'
          }
          renderAcciones={
            esAdmin
              ? (fila) => (
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
                        onClick={() => setADesactivar(fila)}
                      >
                        Desactivar
                      </button>
                    ) : (
<<<<<<< HEAD
                      <button type="button" className={styles.enlaceAccion} onClick={() => setAReactivar(fila)}>
=======
                      <button type="button" className="actionLink" onClick={() => setAReactivar(fila)}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
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
=======
        ancho="amplio"
      >
        <form className="form" onSubmit={alGuardar} noValidate>
          <h3 className="subtitle">Identificación</h3>
          <div className="formGrid">
            <label className="field formGridFull">
              Nombre
              <input
                type="text"
                value={valores.nombre_item}
                onChange={(e) => setValores((v) => ({ ...v, nombre_item: e.target.value }))}
                required
              />
            </label>

            <label className="field">
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

            <label className="field">
              Unidad de medida
              <input
                type="text"
                value={valores.unidad_medida}
                onChange={(e) => setValores((v) => ({ ...v, unidad_medida: e.target.value }))}
                required
              />
            </label>
          </div>

          <h3 className="subtitle">Costo</h3>
          <div className="formGrid">
            <label className="field">
              Costo promedio
              <input
                type="number"
                step="0.01"
                min="0"
                value={valores.costo_promedio}
                onChange={(e) => setValores((v) => ({ ...v, costo_promedio: e.target.value }))}
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

      <Modal titulo="Desactivar materia prima" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_item}"? Dejará de estar disponible para nuevas
          compras o producción, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_item}"? Dejará de estar disponible para nuevas
          compras o producción, pero su historial se conserva.
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

      <Modal titulo="Reactivar materia prima" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_item}"? Volverá a estar disponible como opción
          seleccionable en nuevas compras o producción.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_item}"? Volverá a estar disponible como opción
          seleccionable en nuevas compras o producción.
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

// --- Categorías --------------------------------------------------------

const CATEGORIA_VACIA: CategoriaFormulario = {
  nombre_categoria: '',
  descripcion_categoria: '',
  tipo: 'ambos',
}

<<<<<<< HEAD
function PestañaCategorias({ esAdmin }: { esAdmin: boolean }) {
  const { data: categorias, isLoading } = useCategorias()
=======
const OPCIONES_TIPO = (Object.keys(ETIQUETAS_TIPO) as TipoCategoria[]).map((tipo) => ({
  valor: tipo,
  etiqueta: ETIQUETAS_TIPO[tipo],
}))

function textoUso(productos: number, materiasPrimas: number): string {
  const p = productos === 1 ? '1 producto' : `${productos} productos`
  const m = materiasPrimas === 1 ? '1 materia prima' : `${materiasPrimas} materias primas`
  return `${p} · ${m}`
}

function PestañaCategorias({ esAdmin, solicitudNuevo }: { esAdmin: boolean; solicitudNuevo: number }) {
  const { data: categorias, isLoading } = useCategorias()
  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  const crear = useCrearCategoria()
  const editar = useEditarCategoria()
  const desactivar = useDesactivarCategoria()
  const reactivar = useReactivarCategoria()

<<<<<<< HEAD
=======
  // Cuántos productos y materias primas usan cada categoría; `null` mientras
  // alguna de las dos listas no esté disponible, para no mostrar ceros falsos.
  const uso = useMemo(() => {
    if (!productos || !materiaPrima) return null
    const conteo = new Map<number, { productos: number; materiasPrimas: number }>()
    const de = (id: number) => conteo.get(id) ?? { productos: 0, materiasPrimas: 0 }
    for (const p of productos) conteo.set(p.categoria, { ...de(p.categoria), productos: de(p.categoria).productos + 1 })
    for (const m of materiaPrima) {
      conteo.set(m.categoria, { ...de(m.categoria), materiasPrimas: de(m.categoria).materiasPrimas + 1 })
    }
    return conteo
  }, [productos, materiaPrima])

  const filtros = useFiltrosCatalogo(
    categorias ?? [],
    (c) => [c.nombre_categoria],
    (c) => c.tipo,
  )

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

<<<<<<< HEAD
=======
  useSolicitudNuevo(solicitudNuevo, abrirCrear)

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? styles.estadoActivo : styles.estadoInactivo}>
=======
      clave: 'descripcion_categoria',
      encabezado: 'Uso',
      render: (fila) => {
        if (!uso) return '…'
        const conteo = uso.get(fila.id)
        return <span className="cellNoWrap">{textoUso(conteo?.productos ?? 0, conteo?.materiasPrimas ?? 0)}</span>
      },
    },
    {
      clave: 'activo',
      encabezado: 'Estado',
      render: (fila) => (
        <span className={fila.activo ? 'status statusSuccess' : 'status statusNeutral'}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          {fila.activo ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  return (
<<<<<<< HEAD
    <div>
      {esAdmin && (
        <div className={styles.encabezado}>
          <span />
          <BotonPrimario onClick={abrirCrear}>Nueva categoría</BotonPrimario>
        </div>
      )}
=======
    <div className="tabPanel">
      <BarraFiltros
        filtros={filtros}
        placeholder="Nombre"
        extra={{ etiqueta: 'Tipo', opciones: OPCIONES_TIPO }}
        total={(categorias ?? []).length}
      />
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

      {isLoading ? (
        <p>Cargando categorías…</p>
      ) : (
        <Tabla
          columnas={columnas}
<<<<<<< HEAD
          datos={categorias ?? []}
          mensajeVacio="Todavía no hay categorías registradas."
          renderAcciones={
            esAdmin
              ? (fila) => (
                  <div className={styles.acciones}>
                    <button type="button" className={styles.enlaceAccion} onClick={() => abrirEditar(fila)}>
=======
          datos={filtros.filtrados}
          mensajeVacio={
            filtros.hayFiltros
              ? 'Ninguna categoría coincide con los filtros.'
              : 'Todavía no hay categorías registradas.'
          }
          renderAcciones={
            esAdmin
              ? (fila) => (
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
                        onClick={() => setADesactivar(fila)}
                      >
                        Desactivar
                      </button>
                    ) : (
<<<<<<< HEAD
                      <button type="button" className={styles.enlaceAccion} onClick={() => setAReactivar(fila)}>
=======
                      <button type="button" className="actionLink" onClick={() => setAReactivar(fila)}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
=======
        <form className="form" onSubmit={alGuardar} noValidate>
          <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            Nombre
            <input
              type="text"
              value={valores.nombre_categoria}
              onChange={(e) => setValores((v) => ({ ...v, nombre_categoria: e.target.value }))}
              required
            />
          </label>

<<<<<<< HEAD
          <label className={styles.campo}>
=======
          <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            Descripción
            <textarea
              value={valores.descripcion_categoria}
              onChange={(e) => setValores((v) => ({ ...v, descripcion_categoria: e.target.value }))}
            />
          </label>

<<<<<<< HEAD
          <label className={styles.campo}>
=======
          <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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

      <Modal titulo="Desactivar categoría" abierto={Boolean(aDesactivar)} onCerrar={() => setADesactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_categoria}"? Dejará de estar disponible para
          nuevos productos o materia prima.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres desactivar "{aDesactivar?.nombre_categoria}"? Dejará de estar disponible para
          nuevos productos o materia prima.
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

      <Modal titulo="Reactivar categoría" abierto={Boolean(aReactivar)} onCerrar={() => setAReactivar(null)}>
<<<<<<< HEAD
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_categoria}"? Volverá a estar disponible como opción
          seleccionable para productos y materia prima.
        </p>
        <div className={styles.accionesFormulario}>
=======
        <p className="confirmText">
          ¿Confirmas que quieres reactivar "{aReactivar?.nombre_categoria}"? Volverá a estar disponible como opción
          seleccionable para productos y materia prima.
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
