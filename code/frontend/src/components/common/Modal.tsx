import type { ReactNode } from 'react'

import styles from './Modal.module.css'

interface ModalProps {
  titulo: string
<<<<<<< HEAD
=======
  // Texto de la barra del modal cuando debe diferir del nombre accesible (`titulo`).
  tituloVisible?: string
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
  // 'amplio' para formularios con tablas de líneas (ej. traslados); 'normal' por defecto.
  ancho?: 'normal' | 'amplio'
}

<<<<<<< HEAD
export function Modal({ titulo, abierto, onCerrar, children, ancho = 'normal' }: ModalProps) {
=======
export function Modal({ titulo, tituloVisible, abierto, onCerrar, children, ancho = 'normal' }: ModalProps) {
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  if (!abierto) return null

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div
<<<<<<< HEAD
        className={ancho === 'amplio' ? `${styles.contenido} ${styles.contenidoAmplio}` : styles.contenido}
=======
        className={ancho === 'amplio' ? `${styles.dialog} ${styles.dialogWide}` : styles.dialog}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
<<<<<<< HEAD
        <div className={styles.encabezado}>
          <h2 className={styles.titulo}>{titulo}</h2>
          <button type="button" className={styles.botonCerrar} onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className={styles.cuerpo}>{children}</div>
=======
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>{tituloVisible ?? titulo}</h2>
          <button type="button" className={styles.closeButton} onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className={styles.dialogBody}>{children}</div>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      </div>
    </div>
  )
}
