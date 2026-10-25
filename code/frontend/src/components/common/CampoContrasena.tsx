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
    <label className="field">
      {etiqueta}
      <div className={styles.inputWrapper}>
        <input
          type={mostrar ? 'text' : 'password'}
          value={valor}
          onChange={(evento) => onCambiar(evento.target.value)}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
          className={styles.eyeButton}
          onClick={() => setMostrar((v) => !v)}
          aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Icono nombre={mostrar ? 'ojoCerrado' : 'ojo'} tamano={18} />
        </button>
      </div>
      {botonGenerar && (
        <button type="button" className={styles.generateButton} onClick={botonGenerar.onClick}>
          Generar
        </button>
      )}
    </label>
  )
}
