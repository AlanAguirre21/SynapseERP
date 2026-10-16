import type { ReactNode } from 'react'

import styles from './Modal.module.css'

interface ModalProps {
  titulo: string
  // Texto de la barra del modal cuando debe diferir del nombre accesible (`titulo`).
  tituloVisible?: string
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
  // 'amplio' para formularios con tablas de líneas (ej. traslados); 'normal' por defecto.
  ancho?: 'normal' | 'amplio'
}

export function Modal({ titulo, tituloVisible, abierto, onCerrar, children, ancho = 'normal' }: ModalProps) {
  if (!abierto) return null

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div
        className={ancho === 'amplio' ? `${styles.dialog} ${styles.dialogWide}` : styles.dialog}
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>{tituloVisible ?? titulo}</h2>
          <button type="button" className={styles.closeButton} onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className={styles.dialogBody}>{children}</div>
      </div>
    </div>
  )
}
