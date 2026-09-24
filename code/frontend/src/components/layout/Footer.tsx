import { APP_VERSION } from '../../config/version'
import styles from './Footer.module.css'

export function Footer() {
  const anio = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <span>v{APP_VERSION}</span>
      <span>© {anio} FleboSil</span>
    </footer>
  )
}
