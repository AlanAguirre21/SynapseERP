import { Navigate, Outlet } from 'react-router-dom'

import { useUsuarioActual } from '../../hooks/useUsuarioActual'

interface RutaModuloProps {
  slug: string
}

// Guarda de navegación por módulo: si el rol del usuario no tiene el módulo
// (lista `modulos` que ya filtra el backend en /api/usuarios/me/), escribir su
// URL a mano redirige al Dashboard en vez de mostrar la pantalla vacía.
// Es solo experiencia de uso: la autoridad sigue siendo el backend, que
// rechaza las peticiones de esos módulos con sus clases de permisos DRF.
export function RutaModulo({ slug }: RutaModuloProps) {
  const { data: usuario } = useUsuarioActual()

  // `MainLayout` ya resolvió al usuario antes de renderizar sus rutas hijas.
  if (!usuario) return null

  const permitido = usuario.modulos.some((modulo) => modulo.slug === slug)
  return permitido ? <Outlet /> : <Navigate to="/dashboard" replace />
}
