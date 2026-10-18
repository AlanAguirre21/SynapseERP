import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import type { Usuario } from './api/usuarios'
import { AuthProvider } from './context/AuthContext'
import { Header } from './components/layout/Header'
import layout from './components/layout/MainLayout.module.css'
import { Sidebar } from './components/layout/Sidebar'
import { InformacionUsuario } from './pages/InformacionUsuario/InformacionUsuario'

const USUARIO_PREVIEW: Usuario = {
  id: 1,
  username: 'juanp',
  email: 'juanp@flebosil.test',
  first_name: 'Juan',
  last_name: 'Pérez López',
  nombre: 'Juan Pérez López',
  rol: 'operador',
  modulos: [
    { slug: 'ventas', nombre: 'Ventas', ruta: '/ventas' },
    { slug: 'compras', nombre: 'Compras', ruta: '/compras' },
    { slug: 'produccion', nombre: 'Producción', ruta: '/produccion' },
    { slug: 'inventario', nombre: 'Inventario', ruta: '/inventario' },
    { slug: 'facturacion', nombre: 'Facturación', ruta: '/facturacion' },
    { slug: 'caja', nombre: 'Caja', ruta: '/caja' },
    { slug: 'catalogo', nombre: 'Catálogo', ruta: '/catalogo' },
    { slug: 'rrhh', nombre: 'Recursos Humanos', ruta: '/rrhh' },
    { slug: 'terceros', nombre: 'Terceros', ruta: '/terceros' },
    { slug: 'usuarios', nombre: 'Usuarios', ruta: '/usuarios' },
    { slug: 'sucursales', nombre: 'Sucursales', ruta: '/sucursales' },
    { slug: 'contabilidad', nombre: 'Contabilidad', ruta: '/contabilidad' },
    { slug: 'configuracion_fiscal', nombre: 'Configuración Fiscal', ruta: '/configuracion-fiscal' },
  ],
}

const queryClient = new QueryClient()
queryClient.setQueryData(['usuario-actual'], USUARIO_PREVIEW)
queryClient.setQueryData(['alertas-stock'], [
  { tipo: 'producto', nombre: 'Suero fisiológico', sucursal: 'Matriz', stock_actual: 2, stock_minimo: 10 },
])

export function PreviewDiseno() {
  const [colapsado, setColapsado] = useState(false)
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className={layout.layout}>
          <Header onToggleSidebar={() => setColapsado((v) => !v)} />
          <div className={layout.layoutBody}>
            <Sidebar modulos={USUARIO_PREVIEW.modulos} colapsado={colapsado} />
            <main className={layout.layoutContent}>
              <InformacionUsuario />
            </main>
          </div>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  )
}
