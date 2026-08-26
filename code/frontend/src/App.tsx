import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { MainLayout } from './components/layout/MainLayout'
import { AuthProvider } from './context/AuthContext'
import { Caja } from './pages/Caja/Caja'
import { CambiarContrasena } from './pages/CambiarContrasena/CambiarContrasena'
import { Catalogo } from './pages/Catalogo/Catalogo'
import { Compras } from './pages/Compras/Compras'
import { DetalleCompra } from './pages/Compras/DetalleCompra'
import { NuevaCompra } from './pages/Compras/NuevaCompra'
import { ConfiguracionFiscal } from './pages/ConfiguracionFiscal/ConfiguracionFiscal'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { InformacionUsuario } from './pages/InformacionUsuario/InformacionUsuario'
import { Inventario } from './pages/Inventario/Inventario'
import { Login } from './pages/Login/Login'
import { Personas } from './pages/Personas/Personas'
import { Produccion } from './pages/Produccion/Produccion'
import { RecuperarContrasena } from './pages/RecuperarContrasena/RecuperarContrasena'
import { Sucursales } from './pages/Sucursales/Sucursales'
import { DetalleVenta } from './pages/Ventas/DetalleVenta'
import { NuevaVenta } from './pages/Ventas/NuevaVenta'
import { Ventas } from './pages/Ventas/Ventas'

const queryClient = new QueryClient()

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
              <Route path="/compras" element={<Compras />} />
              <Route path="/compras/nueva" element={<NuevaCompra />} />
              <Route path="/compras/:id" element={<DetalleCompra />} />
              <Route path="/ventas" element={<Ventas />} />
              <Route path="/ventas/nueva" element={<NuevaVenta />} />
              <Route path="/ventas/:id" element={<DetalleVenta />} />
              <Route path="/produccion" element={<Produccion />} />
              <Route path="/caja" element={<Caja />} />
              <Route path="/configuracion-fiscal" element={<ConfiguracionFiscal />} />
              <Route path="/informacion-usuario" element={<InformacionUsuario />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
