import type { ButtonHTMLAttributes } from 'react'

import styles from './BotonPrimario.module.css'

type Variante = 'primario' | 'secundario' | 'peligro'

const CLASES_POR_VARIANTE: Record<Variante, string> = {
  primario: 'primario',
  secundario: 'secundario',
  peligro: 'peligro',
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
