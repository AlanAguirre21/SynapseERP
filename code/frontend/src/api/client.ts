import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const TOKEN_KEY = 'flebosil_access_token'
const REFRESH_TOKEN_KEY = 'flebosil_refresh_token'

interface ConfigConReintento extends InternalAxiosRequestConfig {
  _reintentada?: boolean
}

interface RespuestaRefresh {
  access: string
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refrescoEnCurso: Promise<string | null> | null = null

function refrescarAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return Promise.resolve(null)
  }

  if (!refrescoEnCurso) {
    refrescoEnCurso = axios
      .post<RespuestaRefresh>(`${import.meta.env.VITE_API_URL}/token/refresh/`, {
        refresh: refreshToken,
      })
      .then(({ data }) => {
        setToken(data.access)
        return data.access
      })
      .catch(() => {
        clearTokens()
        return null
      })
      .finally(() => {
        refrescoEnCurso = null
      })
  }

  return refrescoEnCurso
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const peticionOriginal = error.config as ConfigConReintento | undefined

    if (error.response?.status === 401 && peticionOriginal && !peticionOriginal._reintentada) {
      peticionOriginal._reintentada = true
      const nuevoAccessToken = await refrescarAccessToken()
      if (nuevoAccessToken) {
        peticionOriginal.headers.Authorization = `Bearer ${nuevoAccessToken}`
        return apiClient(peticionOriginal)
      }
      clearTokens()
    }

    return Promise.reject(error)
  },
)

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}
