import { apiClient } from './client'

export interface TokensAuth {
  access: string
  refresh: string
}

export async function login(email: string, password: string): Promise<TokensAuth> {
  const { data } = await apiClient.post<TokensAuth>('/auth/login/', { email, password })
  return data
}

export async function solicitarRecuperacion(email: string): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>('/auth/recuperar/', { email })
  return data
}

export async function verificarCodigo(email: string, codigo: string): Promise<{ detail: string }> {
  const { data } = await apiClient.post<{ detail: string }>('/auth/verificar-codigo/', {
    email,
    codigo,
  })
  return data
}

export async function cambiarContrasena(
  email: string,
  password: string,
  passwordConfirmacion: string,
): Promise<TokensAuth> {
  const { data } = await apiClient.post<TokensAuth>('/auth/cambiar-contrasena/', {
    email,
    password,
    password_confirmacion: passwordConfirmacion,
  })
  return data
}
