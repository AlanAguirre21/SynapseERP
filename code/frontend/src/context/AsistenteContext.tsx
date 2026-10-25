import { createContext, useContext, useState, type ReactNode } from 'react'

import { useConversacionAsistente } from '../hooks/useAsistente'

type ConversacionAsistente = ReturnType<typeof useConversacionAsistente>

interface AsistenteContextValor {
  abierto: boolean
  alternar: () => void
  cerrar: () => void
  conversacion: ConversacionAsistente
}

const AsistenteContext = createContext<AsistenteContextValor | null>(null)

// Provisto por `MainLayout` (fuera del `<Outlet>`): el panel y su
// conversación sobreviven a la navegación entre módulos (024).
export function AsistenteProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const conversacion = useConversacionAsistente()

  return (
    <AsistenteContext.Provider
      value={{ abierto, alternar: () => setAbierto((valor) => !valor), cerrar: () => setAbierto(false), conversacion }}
    >
      {children}
    </AsistenteContext.Provider>
  )
}

// `null` fuera del layout principal (y en pruebas que renderizan el Header
// solo): quien lo use decide no mostrar el asistente.
// eslint-disable-next-line react-refresh/only-export-components -- hook del mismo contexto, como `useAuth`
export function useAsistente() {
  return useContext(AsistenteContext)
}
