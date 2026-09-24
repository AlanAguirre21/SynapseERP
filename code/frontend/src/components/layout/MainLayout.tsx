import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { Footer } from './Footer'
import { Header } from './Header'
import styles from './MainLayout.module.css'
import { Sidebar } from './Sidebar'

function sidebarColapsadaPorDefecto() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function MainLayout() {
  const [colapsado, setColapsado] = useState(sidebarColapsadaPorDefecto)
  const { data: usuario, isLoading, isError } = useUsuarioActual()

  if (isLoading) {
    return <div className={styles.estado}>Cargando…</div>
  }

  if (isError || !usuario) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className={styles.layout}>
      <Header onToggleSidebar={() => setColapsado((valor) => !valor)} />
      <div className={styles.cuerpo}>
        <Sidebar modulos={usuario.modulos} colapsado={colapsado} />
        <main className={styles.contenido}>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
