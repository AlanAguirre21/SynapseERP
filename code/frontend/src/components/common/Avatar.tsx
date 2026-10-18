import { obtenerIniciales } from '../../utils/texto'
import styles from './Avatar.module.css'
import { Icono } from './Icono'

export type TamanoAvatar = 'pequeno' | 'grande'

// `suave`: tinte de marca (Header, listas). `marca`: fondo `primario` sólido,
// para el avatar destacado de la cabecera de perfil.
export type TonoAvatar = 'suave' | 'marca'

interface AvatarProps {
  nombre: string | undefined
  foto?: string | null
  tamano?: TamanoAvatar
  tono?: TonoAvatar
}

const CLASES_TAMANO: Record<TamanoAvatar, string> = {
  pequeno: 'small',
  grande: 'large',
}

const TAMANO_ICONO: Record<TamanoAvatar, number> = {
  pequeno: 18,
  grande: 30,
}

const CLASES_TONO: Record<TonoAvatar, string> = {
  suave: 'soft',
  marca: 'brand',
}

// Avatar de una persona: su fotografía si la tiene, sus iniciales, o una
// silueta si todavía no hay nombre (ej. un formulario de alta vacío). Es
// decorativo (el nombre siempre aparece junto a él), así que no se anuncia
// a los lectores de pantalla.
export function Avatar({ nombre, foto, tamano = 'pequeno', tono = 'suave' }: AvatarProps) {
  return (
    <span className={`${styles.avatar} ${styles[CLASES_TAMANO[tamano]]} ${styles[CLASES_TONO[tono]]}`} aria-hidden="true">
      {foto ? (
        <img className={styles.photo} src={foto} alt="" />
      ) : (
        obtenerIniciales(nombre) || <Icono nombre="persona" tamano={TAMANO_ICONO[tamano]} />
      )}
    </span>
  )
}
