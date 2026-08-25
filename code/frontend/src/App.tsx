import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { MainLayout } from './components/layout/MainLayout'
import { AuthProvider } from './context/AuthContext'
import { CambiarContrasena } from './pages/CambiarContrasena/CambiarContrasena'
import { Catalogo } from './pages/Catalogo/Catalogo'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { Inventario } from './pages/Inventario/Inventario'
import { Login } from './pages/Login/Login'
import { Personas } from './pages/Personas/Personas'
import { RecuperarContrasena } from './pages/RecuperarContrasena/RecuperarContrasena'
import { Sucursales } from './pages/Sucursales/Sucursales'

const queryClient = new QueryClient()

function InformacionUsuarioPlaceholder() {
  return (
    <div>
      <h1>Información de Usuario</h1>
      <p>Próximamente — feature 015 · Información de Usuario.</p>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
            <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sucursales" element={<Sucursales />} />
              <Route path="/catalogo" element={<Catalogo />} />
              <Route path="/personas" element={<Personas />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/informacion-usuario" element={<InformacionUsuarioPlaceholder />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
