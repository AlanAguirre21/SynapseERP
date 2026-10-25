import type { ReactNode } from 'react'

import iconoSynapse from '../../assets/synapse_img/synapseErp_isotipo_transparent.png'
import logoSynapse from '../../assets/synapse_img/synapseErp_logo_transparent.png'
import marcaAgua from '../../assets/synapse_img/synapseErp_isotipo_transparent.png'
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
        <img src={logoSynapse} alt="" className={styles.brandLogo} />
      </div>

      <div className={styles.formPanel}>
        <div className={styles.authContainer}>
          <img src={iconoSynapse} alt="SynapseERP" className={styles.smallLogo} />
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
