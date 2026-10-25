import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import {
  abrirConversacion,
  enviarMensajeAsistente,
  getRegistroAsistente,
  type BotonAsistente,
  type EnlaceAsistente,
  type EntradaAsistente,
  type FiltrosRegistroAsistente,
  type ModoAsistente,
} from '../api/asistente'

export interface MensajeChat {
  // Clave local estable para React.
  clave: number
  autor: 'usuario' | 'asistente'
  texto: string
  botones?: BotonAsistente[]
  enlace?: EnlaceAsistente | null
  modo?: ModoAsistente
}

const ERROR_RED = 'No pude comunicarme con el asistente. Revisa tu conexión e intenta de nuevo.'

// Estado de una conversación del panel (024). Vive en `AsistenteContext`,
// provisto por `MainLayout`, para que no se pierda al navegar entre módulos;
// recargar la página empieza una conversación nueva.
export function useConversacionAsistente() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const conversacion = useRef<number | null>(null)
  const siguienteClave = useRef(0)

  function agregar(mensaje: Omit<MensajeChat, 'clave'>) {
    const clave = siguienteClave.current++
    setMensajes((actuales) => [...actuales, { ...mensaje, clave }])
  }

  const abrir = useMutation({
    mutationFn: abrirConversacion,
    onSuccess: (datos) => {
      conversacion.current = datos.conversacion
      agregar({ autor: 'asistente', texto: datos.texto, botones: datos.botones })
    },
    onError: () => agregar({ autor: 'asistente', texto: ERROR_RED }),
  })

  const enviar = useMutation({
    mutationFn: ({ id, entrada }: { id: number; entrada: EntradaAsistente }) => enviarMensajeAsistente(id, entrada),
    onSuccess: (respuesta) =>
      agregar({
        autor: 'asistente',
        texto: respuesta.texto,
        botones: respuesta.botones,
        enlace: respuesta.enlace,
        modo: respuesta.modo,
      }),
    onError: () => agregar({ autor: 'asistente', texto: ERROR_RED }),
  })

  // Abre la conversación la primera vez que se muestra el panel.
  function iniciar() {
    if (conversacion.current === null && !abrir.isPending) abrir.mutate()
  }

  async function mandar(entrada: EntradaAsistente, textoVisible: string) {
    if (conversacion.current === null) {
      try {
        await abrir.mutateAsync()
      } catch {
        return
      }
    }
    agregar({ autor: 'usuario', texto: textoVisible })
    enviar.mutate({ id: conversacion.current as number, entrada })
  }

  return {
    mensajes,
    cargando: abrir.isPending || enviar.isPending,
    iniciar,
    enviarTexto: (texto: string) => mandar({ texto }, texto),
    pulsarBoton: (boton: BotonAsistente) => mandar({ nodo: boton.nodo }, boton.etiqueta),
  }
}

export function useRegistroAsistente(filtros: FiltrosRegistroAsistente) {
  return useQuery({
    queryKey: ['asistente', 'registro', filtros],
    queryFn: () => getRegistroAsistente(filtros),
  })
}
