import type { ReactNode } from 'react'

import styles from './Modal.module.css'

interface ModalProps {
  titulo: string
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
  // 'amplio' para formularios con tablas de líneas (ej. traslados); 'normal' por defecto.
  ancho?: 'normal' | 'amplio'
}

export function Modal({ titulo, abierto, onCerrar, children, ancho = 'normal' }: ModalProps) {
  if (!abierto) return null

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div
        className={ancho === 'amplio' ? `${styles.contenido} ${styles.contenidoAmplio}` : styles.contenido}
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className={styles.encabezado}>
          <h2 className={styles.titulo}>{titulo}</h2>
          <button type="button" className={styles.botonCerrar} onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className={styles.cuerpo}>{children}</div>
      </div>
    </div>
  )
}
