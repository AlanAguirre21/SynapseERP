import { useState } from 'react'

import { Icono } from './Icono'
import styles from './CampoContrasena.module.css'

interface CampoContrasenaProps {
  etiqueta: string
  valor: string
  onCambiar: (valor: string) => void
  autoComplete?: string
  required?: boolean
  botonGenerar?: {
    onClick: () => void
  }
}

export function CampoContrasena({
  etiqueta,
  valor,
  onCambiar,
  autoComplete = 'new-password',
  required,
  botonGenerar,
}: CampoContrasenaProps) {
  const [mostrar, setMostrar] = useState(false)

  return (
<<<<<<< HEAD
    <label className={styles.campo}>
      {etiqueta}
      <div className={styles.campoConIcono}>
=======
    <label className="field">
      {etiqueta}
      <div className={styles.inputWrapper}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        <input
          type={mostrar ? 'text' : 'password'}
          value={valor}
          onChange={(evento) => onCambiar(evento.target.value)}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
<<<<<<< HEAD
          className={styles.botonOjo}
=======
          className={styles.eyeButton}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          onClick={() => setMostrar((v) => !v)}
          aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Icono nombre={mostrar ? 'ojoCerrado' : 'ojo'} tamano={18} />
        </button>
      </div>
      {botonGenerar && (
<<<<<<< HEAD
        <button type="button" className={styles.botonGenerar} onClick={botonGenerar.onClick}>
=======
        <button type="button" className={styles.generateButton} onClick={botonGenerar.onClick}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          Generar
        </button>
      )}
    </label>
  )
}
