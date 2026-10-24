import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'

import { esFotoValida, MENSAJE_FOTO_INVALIDA, TIPOS_FOTO_USUARIO, type CambioFoto } from '../../api/usuarios'
import { Avatar, type TamanoAvatar, type TonoAvatar } from './Avatar'
import styles from './SelectorFotoPerfil.module.css'

interface SelectorFotoPerfilProps {
  nombre: string | undefined
  // URL de la fotografía guardada, o `null` si la cuenta no tiene.
  fotoGuardada: string | null
  // `undefined`: sin cambio; `File`: fotografía nueva; `null`: quitarla.
  cambio: CambioFoto | undefined
  onCambiar: (cambio: CambioFoto | undefined) => void
  tamano?: TamanoAvatar
  tono?: TonoAvatar
  // Contenido junto al avatar, sobre las acciones (ej. nombre en la cabecera
  // de perfil, o una ayuda en un formulario).
  children?: ReactNode
}

// Avatar con vista previa y acciones para agregar, cambiar o quitar la
// fotografía de perfil (017 · Información de Usuario y 010 · Usuarios). No
// sube nada: el cambio se guarda con el formulario que lo contiene.
export function SelectorFotoPerfil({
  nombre,
  fotoGuardada,
  cambio,
  onCambiar,
  tamano = 'grande',
  tono = 'suave',
  children,
}: SelectorFotoPerfilProps) {
  const entrada = useRef<HTMLInputElement>(null)
  const idError = useId()
  const [error, setError] = useState('')
  // La URL de vista previa se crea al elegir el archivo (no en un efecto:
  // StrictMode ejecuta la limpieza de los efectos al montar y revocaría una
  // URL todavía en uso). Se revoca al reemplazarla; la última se libera al
  // salir de la página.
  const [previa, setPrevia] = useState<{ archivo: File; url: string } | null>(null)

  function cambiarPrevia(archivo: File | null) {
    if (previa) URL.revokeObjectURL(previa.url)
    setPrevia(archivo ? { archivo, url: URL.createObjectURL(archivo) } : null)
  }

  // Solo si el cambio vigente es el archivo elegido aquí (el formulario puede
  // haberlo descartado).
  const vistaPrevia = cambio instanceof File && previa?.archivo === cambio ? previa.url : null

  const fotoMostrada = cambio === undefined ? fotoGuardada : vistaPrevia
  const tieneFoto = Boolean(fotoMostrada)

  function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    // Permite volver a elegir el mismo archivo después de quitarlo.
    evento.target.value = ''
    if (!archivo) return

    if (!esFotoValida(archivo)) {
      setError(MENSAJE_FOTO_INVALIDA)
      return
    }
    setError('')
    cambiarPrevia(archivo)
    onCambiar(archivo)
  }

  function quitar() {
    setError('')
    cambiarPrevia(null)
    // Sin fotografía guardada, quitar la recién elegida es volver a "sin cambio".
    onCambiar(fotoGuardada ? null : undefined)
  }

  return (
    <div className={styles.photoPicker}>
      <Avatar nombre={nombre} foto={fotoMostrada} tamano={tamano} tono={tono} />
      <div className={styles.photoContent}>
        {children}
        <div className={styles.photoActions}>
          <button type="button" className="actionLink" onClick={() => entrada.current?.click()}>
            {tieneFoto ? 'Cambiar fotografía' : 'Agregar fotografía'}
          </button>
          {tieneFoto && (
            <button type="button" className="dangerActionLink" onClick={quitar}>
              Quitar fotografía
            </button>
          )}
        </div>
        <input
          ref={entrada}
          type="file"
          className={styles.fileInput}
          accept={TIPOS_FOTO_USUARIO.join(',')}
          onChange={alElegir}
          aria-label="Fotografía de perfil"
          aria-describedby={error ? idError : undefined}
        />
        {error && (
          <span id={idError} className="fieldError" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
