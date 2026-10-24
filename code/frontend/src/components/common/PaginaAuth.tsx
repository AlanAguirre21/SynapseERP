import type { ReactNode } from 'react'

<<<<<<< HEAD
import iconoSynapse from '../../assets/synapse_img/synapseErp_isotipo_transparent.png'
import logoSynapse from '../../assets/synapse_img/synapseErp_logo_transparent.png'
import marcaAgua from '../../assets/synapse_img/synapseErp_isotipo_transparent.png'
=======
import iconoFlebosil from '../../assets/flebosil_img/flebosil_icon_purple.jpg'
import logoFlebosil from '../../assets/flebosil_transparentbg/logo_flebosil.png'
import marcaAgua from '../../assets/flebosil_transparentbg/purple_icon.png'
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
import styles from './PaginaAuth.module.css'

interface PaginaAuthProps {
  titulo: string
  subtitulo: string
  children: ReactNode
}

export function PaginaAuth({ titulo, subtitulo, children }: PaginaAuthProps) {
  return (
<<<<<<< HEAD
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
=======
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
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
