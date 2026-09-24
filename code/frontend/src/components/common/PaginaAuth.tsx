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
    <div className={styles.pagina}>
      <div className={styles.panelMarca} aria-hidden="true">
        <img src={marcaAgua} alt="" className={styles.marcaAgua} />
        <img src={logoSynapse} alt="" className={styles.logoGrande} />
      </div>

      <div className={styles.panelFormulario}>
        <div className={styles.contenedor}>
          <img src={iconoSynapse} alt="SynapseERP" className={styles.logoPequeno} />
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
