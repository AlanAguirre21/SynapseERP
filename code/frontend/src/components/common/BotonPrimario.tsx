import type { ButtonHTMLAttributes } from 'react'

import styles from './BotonPrimario.module.css'

type Variante = 'primario' | 'secundario' | 'peligro'

const CLASES_POR_VARIANTE: Record<Variante, string> = {
<<<<<<< HEAD
  primario: 'primario',
  secundario: 'secundario',
  peligro: 'peligro',
=======
  primario: 'primary',
  secundario: 'secondary',
  peligro: 'danger',
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
}

interface BotonPrimarioProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
}

export function BotonPrimario({
  children,
  variante = 'primario',
  type = 'button',
  ...props
}: BotonPrimarioProps) {
  return (
    <button type={type} className={styles[CLASES_POR_VARIANTE[variante]]} {...props}>
      {children}
    </button>
  )
}
