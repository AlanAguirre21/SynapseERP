import styles from './SeccionFacturacion.module.css'

export function SeccionFacturacion() {
  return (
    <section className={styles.seccion}>
      <h2 className={styles.tituloSeccion}>Resumen facturación</h2>
      <div className={styles.placeholder}>
        <span className={styles.placeholderTitulo}>En construcción</span>
        <span>Esta sección del panel de reportes estará disponible próximamente.</span>
      </div>
    </section>
  )
}
