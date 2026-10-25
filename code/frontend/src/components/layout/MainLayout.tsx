import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { AsistenteProvider, useAsistente } from '../../context/AsistenteContext'
import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Footer } from './Footer'
import { Header } from './Header'
import styles from './MainLayout.module.css'
import { PanelAsistente } from './PanelAsistente'
import { Sidebar } from './Sidebar'

function esPantallaAngosta() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function MainLayout() {
  const [colapsado, setColapsado] = useState(esPantallaAngosta)
  const { data: usuario, isLoading, isError } = useUsuarioActual()

  if (isLoading) {
    return <div className={styles.loadingState}>Cargando…</div>
  }

  if (isError || !usuario) {
    return <Navigate to="/login" replace />
  }

  // En pantallas angostas el sidebar es un panel superpuesto: se cierra al
  // elegir un destino. En escritorio conserva el estado que eligió el usuario.
  function cerrarSiEsPanel() {
    if (esPantallaAngosta()) setColapsado(true)
  }

  return (
    <AsistenteProvider>
      <div className={styles.layout}>
        <Header onToggleSidebar={() => setColapsado((valor) => !valor)} />
        <div className={styles.layoutBody}>
          <Sidebar modulos={usuario.modulos} colapsado={colapsado} onNavegar={cerrarSiEsPanel} />
          {!colapsado && <div className={styles.backdrop} onClick={() => setColapsado(true)} aria-hidden="true" />}
          <main className={styles.layoutContent}>
            <Outlet />
          </main>
          <PanelSiAbierto />
        </div>
        <Footer />
      </div>
    </AsistenteProvider>
  )
}

// El panel (024) se monta solo abierto; su conversación sigue en el contexto.
function PanelSiAbierto() {
  return useAsistente()?.abierto ? <PanelAsistente /> : null
}
