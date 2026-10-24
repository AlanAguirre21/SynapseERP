import { useRef, useState } from 'react'

import type { StockItem, TipoItemInventario } from '../../api/inventario'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useCrearTraslado, useStock } from '../../hooks/useInventario'
import { useSucursales } from '../../hooks/useSucursales'
<<<<<<< HEAD
import styles from './ModalTraslado.module.css'
=======
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

const ETIQUETAS_TIPO: Record<TipoItemInventario, string> = {
  producto: 'Producto',
  materia_prima: 'Materia prima',
}

const PATRON_CANTIDAD = /^\d+(\.\d{1,2})?$/

interface LineaLocal {
  // Clave local estable para el `key` de React al quitar líneas intermedias.
  clave: number
  tipo: TipoItemInventario
  itemId: number | ''
  cantidad: string
}

interface ModalTrasladoProps {
  onCerrar: () => void
  sucursalInicial: number | null
  tipoInicial: TipoItemInventario
}

function extraerMensajeError(err: unknown): string {
  const datos =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: Record<string, unknown> } }).response?.data
      : undefined
  const primerTexto = (valor: unknown): string | undefined => {
    if (typeof valor === 'string') return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
    return undefined
  }

  if (typeof datos?.detail === 'string') return datos.detail

  // Errores por línea: `detalles` llega como arreglo con un objeto de errores por línea.
  const detalles = datos?.detalles
  if (Array.isArray(detalles) && detalles.some((d) => d && typeof d === 'object')) {
    for (const [indice, erroresLinea] of detalles.entries()) {
      if (!erroresLinea || typeof erroresLinea !== 'object') continue
      for (const valor of Object.values(erroresLinea as Record<string, unknown>)) {
        const texto = primerTexto(valor)
        if (texto) return `Línea ${indice + 1}: ${texto}`
      }
    }
  }

  for (const valor of Object.values(datos ?? {})) {
    const texto = primerTexto(valor)
    if (texto) return texto
  }
  return 'No se pudo registrar el traslado. Intenta de nuevo.'
}

export function ModalTraslado({ onCerrar, sucursalInicial, tipoInicial }: ModalTrasladoProps) {
  const { data: sucursales } = useSucursales()
  const sucursalesActivas = (sucursales ?? []).filter((s) => s.activo)
  const crear = useCrearTraslado()

  const siguienteClave = useRef(1)
  const [origen, setOrigen] = useState<number | ''>(sucursalInicial ?? '')
  const [destino, setDestino] = useState<number | ''>('')
  const [lineas, setLineas] = useState<LineaLocal[]>([{ clave: 0, tipo: tipoInicial, itemId: '', cantidad: '' }])
  const [paso, setPaso] = useState<'formulario' | 'resumen'>('formulario')
  const [error, setError] = useState('')

  // El stock de origen sirve a la vez como catálogo de ítems activos y como
  // "disponible" por línea; cada tipo solo se consulta si alguna línea lo usa.
  const hayProductos = lineas.some((l) => l.tipo === 'producto')
  const hayMateriaPrima = lineas.some((l) => l.tipo === 'materia_prima')
  const { data: stockProductos } = useStock('producto', hayProductos && origen ? origen : null)
  const { data: stockMateriaPrima } = useStock('materia_prima', hayMateriaPrima && origen ? origen : null)

  function stockDe(tipo: TipoItemInventario): StockItem[] {
    return (tipo === 'producto' ? stockProductos : stockMateriaPrima) ?? []
  }

  function itemDe(linea: LineaLocal): StockItem | undefined {
    return stockDe(linea.tipo).find((i) => i.id === linea.itemId)
  }

  function nombreSucursal(id: number | ''): string {
    return sucursalesActivas.find((s) => s.id === id)?.nombre_sucursal ?? ''
  }

  function actualizarLinea(clave: number, cambios: Partial<LineaLocal>) {
    setLineas((actual) => actual.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)))
  }

  function agregarLinea() {
    const clave = siguienteClave.current++
    setLineas((actual) => [...actual, { clave, tipo: tipoInicial, itemId: '', cantidad: '' }])
  }

  function quitarLinea(clave: number) {
    setLineas((actual) => actual.filter((l) => l.clave !== clave))
  }

  function cambiarOrigen(valor: number | '') {
    setOrigen(valor)
    if (valor !== '' && valor === destino) setDestino('')
  }

  function validarFormulario(): string {
    if (!origen || !destino) return 'Selecciona la sucursal origen y la sucursal destino.'
    if (origen === destino) return 'La sucursal destino debe ser distinta de la sucursal origen.'
    if (lineas.length === 0) return 'Agrega al menos un ítem al traslado.'
    for (const [indice, linea] of lineas.entries()) {
      if (!linea.itemId) return `Línea ${indice + 1}: selecciona un ítem.`
      if (!PATRON_CANTIDAD.test(linea.cantidad.trim()) || Number(linea.cantidad) <= 0) {
        return `Línea ${indice + 1}: la cantidad debe ser mayor a 0, con máximo 2 decimales.`
      }
    }
    return ''
  }

  function irAResumen() {
    const mensaje = validarFormulario()
    setError(mensaje)
    if (!mensaje) setPaso('resumen')
  }

  async function confirmarTraslado() {
    if (!origen || !destino) return
    setError('')
    try {
      await crear.mutateAsync({
        sucursal_origen: origen,
        sucursal_destino: destino,
        detalles: lineas.map((l) => ({
          tipo_item: l.tipo,
          item_id: l.itemId as number,
          cantidad: l.cantidad.trim(),
        })),
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }

  return (
    <Modal titulo="Traslado entre sucursales" abierto onCerrar={onCerrar} ancho="amplio">
      {paso === 'formulario' ? (
<<<<<<< HEAD
        <div className={styles.contenido}>
          <div className={styles.filaSucursales}>
            <label className={styles.campo}>
=======
        <div className="form">
          <div className="fieldRow">
            <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              Sucursal origen
              <select
                value={origen}
                onChange={(e) => cambiarOrigen(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Selecciona…</option>
                {sucursalesActivas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre_sucursal}
                  </option>
                ))}
              </select>
            </label>
<<<<<<< HEAD
            <label className={styles.campo}>
=======
            <label className="field">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              Sucursal destino
              <select value={destino} onChange={(e) => setDestino(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Selecciona…</option>
                {sucursalesActivas
                  .filter((s) => s.id !== origen)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre_sucursal}
                    </option>
                  ))}
              </select>
            </label>
          </div>

<<<<<<< HEAD
          <table className={styles.tablaLineas}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ítem</th>
                <th>Cantidad</th>
                <th>Disponible en origen</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea, indice) => {
                const numero = indice + 1
                const elegidosEnOtras = new Set(
                  lineas
                    .filter((l) => l.clave !== linea.clave && l.tipo === linea.tipo && l.itemId !== '')
                    .map((l) => l.itemId),
                )
                const opciones = stockDe(linea.tipo).filter((i) => !elegidosEnOtras.has(i.id))
                const item = itemDe(linea)
                const excede = item !== undefined && linea.cantidad !== '' && Number(linea.cantidad) > Number(item.stock_actual)

                return (
                  <tr key={linea.clave}>
                    <td>
                      <select
                        aria-label={`Tipo de la línea ${numero}`}
                        value={linea.tipo}
                        onChange={(e) =>
                          actualizarLinea(linea.clave, { tipo: e.target.value as TipoItemInventario, itemId: '' })
                        }
                      >
                        {(Object.keys(ETIQUETAS_TIPO) as TipoItemInventario[]).map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {ETIQUETAS_TIPO[tipo]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Ítem de la línea ${numero}`}
                        value={linea.itemId}
                        onChange={(e) =>
                          actualizarLinea(linea.clave, { itemId: e.target.value ? Number(e.target.value) : '' })
                        }
                      >
                        <option value="">Selecciona…</option>
                        {opciones.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        aria-label={`Cantidad de la línea ${numero}`}
                        className={styles.inputCantidad}
                        value={linea.cantidad}
                        onChange={(e) => actualizarLinea(linea.clave, { cantidad: e.target.value })}
                      />
                    </td>
                    <td>
                      <span data-testid={`disponible-linea-${numero}`}>{item ? item.stock_actual : '—'}</span>
                      {excede && <span className={styles.aviso}>Supera el disponible</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.enlacePeligro}
                        onClick={() => quitarLinea(linea.clave)}
                        aria-label={`Quitar línea ${numero}`}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
=======
          <div className="tableScroll">
            <table className="linesTable">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ítem</th>
                  <th className="numeric">Cantidad</th>
                  <th className="numeric">Disponible en origen</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea, indice) => {
                  const numero = indice + 1
                  const elegidosEnOtras = new Set(
                    lineas
                      .filter((l) => l.clave !== linea.clave && l.tipo === linea.tipo && l.itemId !== '')
                      .map((l) => l.itemId),
                  )
                  const opciones = stockDe(linea.tipo).filter((i) => !elegidosEnOtras.has(i.id))
                  const item = itemDe(linea)
                  const excede = item !== undefined && linea.cantidad !== '' && Number(linea.cantidad) > Number(item.stock_actual)

                  return (
                    <tr key={linea.clave}>
                      <td>
                        <select
                          aria-label={`Tipo de la línea ${numero}`}
                          value={linea.tipo}
                          onChange={(e) =>
                            actualizarLinea(linea.clave, { tipo: e.target.value as TipoItemInventario, itemId: '' })
                          }
                        >
                          {(Object.keys(ETIQUETAS_TIPO) as TipoItemInventario[]).map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {ETIQUETAS_TIPO[tipo]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Ítem de la línea ${numero}`}
                          value={linea.itemId}
                          onChange={(e) =>
                            actualizarLinea(linea.clave, { itemId: e.target.value ? Number(e.target.value) : '' })
                          }
                        >
                          <option value="">Selecciona…</option>
                          {opciones.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="numeric">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          aria-label={`Cantidad de la línea ${numero}`}
                          className="inputCompact numeric"
                          value={linea.cantidad}
                          onChange={(e) => actualizarLinea(linea.clave, { cantidad: e.target.value })}
                        />
                      </td>
                      <td className="numeric">
                        <div className="cellStack">
                          <span data-testid={`disponible-linea-${numero}`}>{item ? item.stock_actual : '—'}</span>
                          {excede && <span className="fieldWarning">Supera el disponible</span>}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="dangerActionLink"
                          onClick={() => quitarLinea(linea.clave)}
                          aria-label={`Quitar línea ${numero}`}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

          <div>
            <BotonPrimario variante="secundario" onClick={agregarLinea}>
              + Agregar ítem
            </BotonPrimario>
          </div>

          {error && (
<<<<<<< HEAD
            <p className={styles.error} role="alert">
=======
            <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              {error}
            </p>
          )}

<<<<<<< HEAD
          <div className={styles.acciones}>
=======
          <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            <BotonPrimario variante="secundario" onClick={onCerrar}>
              Cancelar
            </BotonPrimario>
            <BotonPrimario onClick={irAResumen}>Confirmar</BotonPrimario>
          </div>
        </div>
      ) : (
<<<<<<< HEAD
        <div className={styles.contenido}>
          <p className={styles.textoResumen}>
=======
        <div className="form">
          <p className="confirmText">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            ¿Confirmar el traslado de <strong>{nombreSucursal(origen)}</strong> a{' '}
            <strong>{nombreSucursal(destino)}</strong>?
          </p>

<<<<<<< HEAD
          <table className={styles.tablaLineas}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ítem</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea) => (
                <tr key={linea.clave}>
                  <td>{ETIQUETAS_TIPO[linea.tipo]}</td>
                  <td>{itemDe(linea)?.nombre ?? `#${linea.itemId}`}</td>
                  <td>{linea.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {error && (
            <p className={styles.error} role="alert">
=======
          {/* Ruta del traslado: lo primero que hay que verificar antes de confirmar. */}
          <div className="fieldGroup">
            <dl className="factGrid factGridThree">
              <div>
                <dt>Sucursal origen</dt>
                <dd>{nombreSucursal(origen)}</dd>
              </div>
              <div>
                <dt>Sucursal destino</dt>
                <dd>→ {nombreSucursal(destino)}</dd>
              </div>
              <div>
                <dt>Ítems a trasladar</dt>
                <dd>{lineas.length}</dd>
              </div>
            </dl>
          </div>

          <div className="tableScroll">
            <table className="linesTable">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ítem</th>
                  <th className="numeric">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea) => (
                  <tr key={linea.clave}>
                    <td>{ETIQUETAS_TIPO[linea.tipo]}</td>
                    <td>{itemDe(linea)?.nombre ?? `#${linea.itemId}`}</td>
                    <td className="numeric">{linea.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="errorMessage" role="alert">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
              {error}
            </p>
          )}

<<<<<<< HEAD
          <div className={styles.acciones}>
=======
          <div className="formActions">
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
            <BotonPrimario
              variante="secundario"
              onClick={() => {
                setError('')
                setPaso('formulario')
              }}
              disabled={crear.isPending}
            >
              Volver
            </BotonPrimario>
            <BotonPrimario onClick={confirmarTraslado} disabled={crear.isPending}>
              {crear.isPending ? 'Trasladando…' : 'Confirmar traslado'}
            </BotonPrimario>
          </div>
        </div>
      )}
    </Modal>
  )
}
