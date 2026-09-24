import type { ReactNode } from 'react'

import iconoFlebosil from '../../assets/flebosil_img/flebosil_icon_purple.jpg'
import logoFlebosil from '../../assets/flebosil_transparentbg/logo_flebosil.png'
import marcaAgua from '../../assets/flebosil_transparentbg/purple_icon.png'
import styles from './PaginaAuth.module.css'

interface PaginaAuthProps {
  titulo: string
  subtitulo: string
  children: ReactNode
}

export function PaginaAuth({ titulo, subtitulo, children }: PaginaAuthProps) {
  return (
    <div className={styles.pagina}>
      <div className={styles.panelMarca} aria-hidden="true">
        <img src={marcaAgua} alt="" className={styles.marcaAgua} />
        <img src={logoFlebosil} alt="" className={styles.logoGrande} />
      </div>

      <div className={styles.panelFormulario}>
        <div className={styles.contenedor}>
          <img src={iconoFlebosil} alt="FleboSil" className={styles.logoPequeno} />
          <div className={styles.encabezado}>
            <h1 className={styles.titulo}>{titulo}</h1>
            <p className={styles.subtitulo}>{subtitulo}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
