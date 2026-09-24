import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { login as loginRequest } from '../api/auth'
import { clearTokens, getRefreshToken, getToken, setRefreshToken, setToken } from '../api/client'
import { logout as logoutRequest } from '../api/usuarios'

interface AuthContextValue {
  autenticado: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  iniciarSesionConTokens: (access: string, refresh: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(() => Boolean(getToken()))
  const queryClient = useQueryClient()

  const login = useCallback(async (email: string, password: string) => {
    const { access, refresh } = await loginRequest(email, password)
    setToken(access)
    setRefreshToken(refresh)
    setAutenticado(true)
  }, [])

  // Guarda tokens ya emitidos por el backend (ej. tras cambiar contraseña
  // en la feature 005), sin volver a llamar al endpoint de login.
  const iniciarSesionConTokens = useCallback((access: string, refresh: string) => {
    setToken(access)
    setRefreshToken(refresh)
    setAutenticado(true)
  }, [])

  const logout = useCallback(() => {
    // Best-effort: si la petición de red falla, igual se limpian los
    // tokens localmente — no debe dejar al usuario atrapado en la sesión
    // actual solo porque el backend no respondió (ver plan.md). Importante:
    // `clearTokens()` va en `.finally()`, no justo después de disparar la
    // petición — el interceptor de `apiClient` que agrega el header
    // `Authorization` corre en un microtask async: si se llama a
    // `clearTokens()` de forma síncrona inmediatamente después, borra el
    // token antes de que el interceptor llegue a leerlo, y la petición de
    // logout sale sin credenciales (401).
    logoutRequest(getRefreshToken())
      .catch(() => {})
      .finally(() => clearTokens())
    setAutenticado(false)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({ autenticado, login, logout, iniciarSesionConTokens }),
    [autenticado, login, logout, iniciarSesionConTokens],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook de conveniencia junto a su Provider, patrón estándar de contexto de React
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
