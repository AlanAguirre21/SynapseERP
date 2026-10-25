import { useRef, useState } from 'react'

import type { TipoItemInventario } from '../../api/inventario'
import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { useCrearConteoFisico } from '../../hooks/useAuditoria'
import { useMateriaPrima } from '../../hooks/useMateriaPrima'
import { useProductos } from '../../hooks/useProductos'
import { useSucursales } from '../../hooks/useSucursales'
import { ETIQUETAS_TIPO_ITEM, extraerMensajeError } from './formatoAuditoria'

const PATRON_CANTIDAD = /^\d+(\.\d{1,2})?$/

interface LineaLocal {
  // Clave local estable para el `key` de React al quitar líneas intermedias.
  clave: number
  tipo: TipoItemInventario
  itemId: number | ''
  cantidad: string
}

interface OpcionItem {
  id: number
  nombre: string
}

// Conteo ciego: los ítems salen del catálogo (no de `useStock`), así que la
// pantalla nunca recibe el stock del sistema mientras se cuenta.
export function ModalConteoFisico({ onCerrar }: { onCerrar: () => void }) {
  const { data: sucursales } = useSucursales()
  const { data: productos } = useProductos()
  const { data: materiaPrima } = useMateriaPrima()
  const crear = useCrearConteoFisico()

  const sucursalesActivas = (sucursales ?? []).filter((s) => s.activo)
  const siguienteClave = useRef(1)
  const [sucursal, setSucursal] = useState<number | ''>('')
  const [observacion, setObservacion] = useState('')
  const [lineas, setLineas] = useState<LineaLocal[]>([{ clave: 0, tipo: 'producto', itemId: '', cantidad: '' }])
  const [error, setError] = useState('')

  function opcionesDe(tipo: TipoItemInventario): OpcionItem[] {
    if (tipo === 'producto') {
      return (productos ?? []).filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre_producto }))
    }
    return (materiaPrima ?? []).filter((m) => m.activo).map((m) => ({ id: m.id, nombre: m.nombre_item }))
  }

  function actualizarLinea(clave: number, cambios: Partial<LineaLocal>) {
    setLineas((actual) => actual.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)))
  }

  function agregarLinea() {
    const clave = siguienteClave.current++
    setLineas((actual) => [...actual, { clave, tipo: 'producto', itemId: '', cantidad: '' }])
  }

  function quitarLinea(clave: number) {
    setLineas((actual) => actual.filter((l) => l.clave !== clave))
  }

  function validar(): string {
    if (!sucursal) return 'Selecciona la sucursal que contaste.'
    if (lineas.length === 0) return 'Agrega al menos un ítem al conteo.'
    for (const [indice, linea] of lineas.entries()) {
      if (!linea.itemId) return `Línea ${indice + 1}: selecciona un ítem.`
      if (!PATRON_CANTIDAD.test(linea.cantidad.trim())) {
        return `Línea ${indice + 1}: la cantidad contada debe ser 0 o mayor, con máximo 2 decimales.`
      }
    }
    return ''
  }

  async function guardar() {
    const mensaje = validar()
    setError(mensaje)
    if (mensaje || !sucursal) return
    try {
      await crear.mutateAsync({
        sucursal,
        observacion,
        detalles: lineas.map((l) => ({
          tipo_item: l.tipo,
          item_id: l.itemId as number,
          cantidad_contada: l.cantidad.trim(),
        })),
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo registrar el conteo. Intenta de nuevo.'))
    }
  }

  return (
    <Modal titulo="Registrar conteo físico" abierto onCerrar={onCerrar} ancho="amplio">
      <div className="form">
        <label className="field">
          Sucursal
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Selecciona…</option>
            {sucursalesActivas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_sucursal}
              </option>
            ))}
          </select>
        </label>

        <div className="tableScroll">
          <table className="linesTable">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ítem</th>
                <th className="numeric">Cantidad contada</th>
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
                const opciones = opcionesDe(linea.tipo).filter((i) => !elegidosEnOtras.has(i.id))

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
                        {(Object.keys(ETIQUETAS_TIPO_ITEM) as TipoItemInventario[]).map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {ETIQUETAS_TIPO_ITEM[tipo]}
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
                        min="0"
                        step="0.01"
                        aria-label={`Cantidad contada de la línea ${numero}`}
                        className="inputCompact numeric"
                        value={linea.cantidad}
                        onChange={(e) => actualizarLinea(linea.clave, { cantidad: e.target.value })}
                      />
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

        <div>
          <BotonPrimario variante="secundario" onClick={agregarLinea}>
            + Agregar ítem
          </BotonPrimario>
        </div>

        <label className="field">
          Observación (opcional)
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </label>

        {error && (
          <p className="errorMessage" role="alert">
            {error}
          </p>
        )}

        <div className="formActions">
          <BotonPrimario variante="secundario" onClick={onCerrar} disabled={crear.isPending}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario onClick={guardar} disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Guardar conteo'}
          </BotonPrimario>
        </div>
      </div>
    </Modal>
  )
}
