import { apiClient } from './client'

export interface BotonAsistente {
  etiqueta: string
  nodo: string
}

export interface EnlaceAsistente {
  ruta: string
  etiqueta: string
}

export type ConfianzaAsistente = 'alta' | 'media' | 'baja' | 'boton'
export type ModoAsistente = 'semantico' | 'solo_arbol'

export interface ConversacionNueva {
  conversacion: number
  texto: string
  botones: BotonAsistente[]
}

export interface RespuestaAsistente {
  mensaje: number
  texto: string
  botones: BotonAsistente[]
  enlace: EnlaceAsistente | null
  intencion: string
  confianza: ConfianzaAsistente
  modo: ModoAsistente
}

// Exactamente uno: una pregunta escrita o el nodo de un botón.
export type EntradaAsistente = { texto: string } | { nodo: string }

export async function abrirConversacion(): Promise<ConversacionNueva> {
  const { data } = await apiClient.post<ConversacionNueva>('/asistente/conversaciones/')
  return data
}

export async function enviarMensajeAsistente(conversacion: number, entrada: EntradaAsistente): Promise<RespuestaAsistente> {
  const { data } = await apiClient.post<RespuestaAsistente>(`/asistente/conversaciones/${conversacion}/mensajes/`, entrada)
  return data
}

export interface MensajeRegistroAsistente {
  id: number
  conversacion: number
  usuario: number
  usuario_nombre: string
  fecha: string
  entrada_tipo: 'texto' | 'boton'
  entrada_texto: string
  nodo_solicitado: string
  intencion: string
  confianza: ConfianzaAsistente
  puntuacion: string | null
  alternativas: { intencion: string; puntuacion: number }[]
  periodo: string
  nodo_respuesta: string
  version_catalogo: string
  respuesta_texto: string
  modo: ModoAsistente
}

export interface FiltrosRegistroAsistente {
  usuario?: number
  confianza?: ConfianzaAsistente
  intencion?: string
  solo_dudosas?: 'true'
  fecha_desde?: string
  fecha_hasta?: string
}

export async function getRegistroAsistente(filtros: FiltrosRegistroAsistente): Promise<MensajeRegistroAsistente[]> {
  const { data } = await apiClient.get<MensajeRegistroAsistente[]>('/asistente/registro/', { params: filtros })
  return data
}
