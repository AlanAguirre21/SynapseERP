import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Footer } from './Footer'
import { Header } from './Header'
import styles from './MainLayout.module.css'
import { Sidebar } from './Sidebar'

<<<<<<< HEAD
function sidebarColapsadaPorDefecto() {
=======
function esPantallaAngosta() {
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function MainLayout() {
<<<<<<< HEAD
  const [colapsado, setColapsado] = useState(sidebarColapsadaPorDefecto)
  const { data: usuario, isLoading, isError } = useUsuarioActual()

  if (isLoading) {
    return <div className={styles.estado}>Cargando…</div>
=======
  const [colapsado, setColapsado] = useState(esPantallaAngosta)
  const { data: usuario, isLoading, isError } = useUsuarioActual()

  if (isLoading) {
    return <div className={styles.loadingState}>Cargando…</div>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  }

  if (isError || !usuario) {
    return <Navigate to="/login" replace />
  }

<<<<<<< HEAD
  return (
    <div className={styles.layout}>
      <Header onToggleSidebar={() => setColapsado((valor) => !valor)} />
      <div className={styles.cuerpo}>
        <Sidebar modulos={usuario.modulos} colapsado={colapsado} />
        <main className={styles.contenido}>
=======
  // En pantallas angostas el sidebar es un panel superpuesto: se cierra al
  // elegir un destino. En escritorio conserva el estado que eligió el usuario.
  function cerrarSiEsPanel() {
    if (esPantallaAngosta()) setColapsado(true)
  }

  return (
    <div className={styles.layout}>
      <Header onToggleSidebar={() => setColapsado((valor) => !valor)} />
      <div className={styles.layoutBody}>
        <Sidebar modulos={usuario.modulos} colapsado={colapsado} onNavegar={cerrarSiEsPanel} />
        {!colapsado && <div className={styles.backdrop} onClick={() => setColapsado(true)} aria-hidden="true" />}
        <main className={styles.layoutContent}>
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
