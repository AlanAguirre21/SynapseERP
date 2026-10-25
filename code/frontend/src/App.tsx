import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { MainLayout } from './components/layout/MainLayout'
import { RutaModulo } from './components/layout/RutaModulo'
import { AuthProvider } from './context/AuthContext'
import { Caja } from './pages/Caja/Caja'
import { CambiarContrasena } from './pages/CambiarContrasena/CambiarContrasena'
import { Catalogo } from './pages/Catalogo/Catalogo'
import { Compras } from './pages/Compras/Compras'
import { DetalleCompra } from './pages/Compras/DetalleCompra'
import { NuevaCompra } from './pages/Compras/NuevaCompra'
import { ConfiguracionFiscal } from './pages/ConfiguracionFiscal/ConfiguracionFiscal'
import { Contabilidad } from './pages/Contabilidad/Contabilidad'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { DetalleFactura } from './pages/Facturacion/DetalleFactura'
import { Facturacion } from './pages/Facturacion/Facturacion'
import { InformacionUsuario } from './pages/InformacionUsuario/InformacionUsuario'
import { Inventario } from './pages/Inventario/Inventario'
import { Login } from './pages/Login/Login'
import { Produccion } from './pages/Produccion/Produccion'
import { RecuperarContrasena } from './pages/RecuperarContrasena/RecuperarContrasena'
import { RRHH } from './pages/RRHH/RRHH'
import { Sucursales } from './pages/Sucursales/Sucursales'
import { Terceros } from './pages/Terceros/Terceros'
import { Usuarios } from './pages/Usuarios/Usuarios'
import { DetalleVenta } from './pages/Ventas/DetalleVenta'
import { NuevaVenta } from './pages/Ventas/NuevaVenta'
import { Ventas } from './pages/Ventas/Ventas'
import { PreviewDiseno } from './PreviewDiseno'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/preview-diseno" element={<PreviewDiseno />} />
            <Route
              path="/preview-cambiar-contrasena"
              element={<Navigate to="/cambiar-contrasena" state={{ email: 'preview@synapse.test' }} replace />}
            />
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
            <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route element={<RutaModulo slug="sucursales" />}>
                <Route path="/sucursales" element={<Sucursales />} />
              </Route>
              <Route element={<RutaModulo slug="catalogo" />}>
                <Route path="/catalogo" element={<Catalogo />} />
              </Route>
              <Route element={<RutaModulo slug="rrhh" />}>
                <Route path="/rrhh" element={<RRHHPorPestana />} />
              </Route>
              <Route element={<RutaModulo slug="terceros" />}>
                <Route path="/terceros" element={<Terceros />} />
              </Route>
              <Route element={<RutaModulo slug="usuarios" />}>
                <Route path="/usuarios" element={<Usuarios />} />
              </Route>
              <Route element={<RutaModulo slug="inventario" />}>
                <Route path="/inventario" element={<Inventario />} />
              </Route>
              <Route element={<RutaModulo slug="compras" />}>
                <Route path="/compras" element={<Compras />} />
                <Route path="/compras/nueva" element={<NuevaCompra />} />
                <Route path="/compras/:id" element={<DetalleCompra />} />
              </Route>
              <Route element={<RutaModulo slug="ventas" />}>
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/ventas/nueva" element={<NuevaVenta />} />
                <Route path="/ventas/:id" element={<DetalleVenta />} />
              </Route>
              <Route element={<RutaModulo slug="produccion" />}>
                <Route path="/produccion" element={<Produccion />} />
              </Route>
              <Route element={<RutaModulo slug="facturacion" />}>
                <Route path="/facturacion" element={<Facturacion />} />
                <Route path="/facturacion/:id" element={<DetalleFactura />} />
              </Route>
              <Route element={<RutaModulo slug="caja" />}>
                <Route path="/caja" element={<Caja />} />
              </Route>
              <Route element={<RutaModulo slug="configuracion_fiscal" />}>
                <Route path="/configuracion-fiscal" element={<ConfiguracionFiscal />} />
              </Route>
              <Route element={<RutaModulo slug="contabilidad" />}>
                <Route path="/contabilidad" element={<Contabilidad />} />
              </Route>
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

// RRHH lee `?pestana=` solo al montarse (ver `leerPestañaInicial`); si ya se
// está en /rrhh y un enlace (campana del Header, Caja) cambia solo la
// búsqueda, la clave nueva la vuelve a montar en la pestaña pedida.
function RRHHPorPestana() {
  const { search } = useLocation()
  return <RRHH key={search} />
}

