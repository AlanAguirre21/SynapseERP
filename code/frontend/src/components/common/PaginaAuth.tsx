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
    <div className={styles.authPage}>
      <div className={styles.brandPanel} aria-hidden="true">
        <img src={marcaAgua} alt="" className={styles.watermark} />
        <img src={logoFlebosil} alt="" className={styles.brandLogo} />
      </div>

      <div className={styles.formPanel}>
        <div className={styles.authContainer}>
          <img src={iconoFlebosil} alt="FleboSil" className={styles.smallLogo} />
          <div className={styles.authHeader}>
            <h1 className={styles.authTitle}>{titulo}</h1>
            <p className={styles.authSubtitle}>{subtitulo}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
