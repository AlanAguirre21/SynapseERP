import { useState, type FormEvent } from 'react'

import { BotonPrimario } from '../../components/common/BotonPrimario'
import { Modal } from '../../components/common/Modal'
import { Tabla, type ColumnaTabla } from '../../components/common/Tabla'
import type { Sucursal, SucursalFormulario } from '../../api/sucursales'
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

  const esAdmin = usuario?.rol === 'admin'

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

  const columnas: ColumnaTabla<Sucursal>[] = [
    { clave: 'nombre_sucursal', encabezado: 'Nombre' },
    { clave: 'ubicacion_sucursal', encabezado: 'Ubicación' },
    { clave: 'telefono_sucursal', encabezado: 'Teléfono' },
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
    <div className={styles.pagina}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Sucursales</h1>
        {esAdmin && <BotonPrimario onClick={abrirCrear}>Nueva sucursal</BotonPrimario>}
      </div>

      {isLoading ? (
        <p>Cargando sucursales…</p>
      ) : (
        <Tabla
          columnas={columnas}
          datos={sucursales ?? []}
          mensajeVacio="Todavía no hay sucursales registradas."
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
                        onClick={() => setSucursalADesactivar(fila)}
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button type="button" className={styles.enlaceAccion} onClick={() => abrirReactivar(fila)}>
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
        titulo={sucursalEnEdicion ? 'Editar sucursal' : 'Nueva sucursal'}
        abierto={formularioAbierto}
        onCerrar={cerrarFormulario}
      >
        <form className={styles.formulario} onSubmit={alGuardar} noValidate>
          <label className={styles.campo}>
            Nombre
            <input
              type="text"
              value={valores.nombre_sucursal}
              onChange={(evento) => setValores((v) => ({ ...v, nombre_sucursal: evento.target.value }))}
              required
            />
          </label>

          <label className={styles.campo}>
            Ubicación
            <input
              type="text"
              value={valores.ubicacion_sucursal}
              onChange={(evento) => setValores((v) => ({ ...v, ubicacion_sucursal: evento.target.value }))}
            />
          </label>

          <label className={styles.campo}>
            Teléfono
            <input
              type="text"
              value={valores.telefono_sucursal}
              onChange={(evento) => setValores((v) => ({ ...v, telefono_sucursal: evento.target.value }))}
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

      <Modal
        titulo="Desactivar sucursal"
        abierto={Boolean(sucursalADesactivar)}
        onCerrar={() => setSucursalADesactivar(null)}
      >
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres desactivar la sucursal "{sucursalADesactivar?.nombre_sucursal}"? Dejará de estar
          disponible para nuevos movimientos, pero su historial se conserva.
        </p>
        <div className={styles.accionesFormulario}>
          <BotonPrimario variante="secundario" onClick={() => setSucursalADesactivar(null)}>
            Cancelar
          </BotonPrimario>
          <BotonPrimario variante="peligro" onClick={confirmarDesactivar} disabled={desactivar.isPending}>
            {desactivar.isPending ? 'Desactivando…' : 'Desactivar'}
          </BotonPrimario>
        </div>
      </Modal>

      <Modal titulo="Reactivar sucursal" abierto={Boolean(sucursalAReactivar)} onCerrar={cerrarReactivar}>
        <p className={styles.textoConfirmacion}>
          ¿Confirmas que quieres reactivar la sucursal "{sucursalAReactivar?.nombre_sucursal}"? Volverá a estar
          disponible para nuevos movimientos de inventario.
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
    </div>
  )
}
