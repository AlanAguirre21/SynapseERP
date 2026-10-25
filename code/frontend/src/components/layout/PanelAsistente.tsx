import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAsistente } from '../../context/AsistenteContext'
import styles from './PanelAsistente.module.css'

// Panel lateral derecho del asistente (024). Se monta en `MainLayout` solo
// mientras está abierto; la conversación vive en `AsistenteContext`.
export function PanelAsistente() {
  const asistente = useAsistente()
  const [texto, setTexto] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const final = useRef<HTMLDivElement>(null)

  const conversacion = asistente?.conversacion
  const cerrar = asistente?.cerrar
  const iniciar = conversacion?.iniciar
  const cantidad = conversacion?.mensajes.length ?? 0

  // Al abrir: inicia la conversación (una sola vez) y enfoca la caja de texto.
  useEffect(() => {
    iniciar?.()
    campo.current?.focus()
    // Solo al montarse el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `Esc` cierra el panel.
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') cerrar?.()
    }
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [cerrar])

  // Mantiene visible el mensaje más reciente.
  useEffect(() => {
    final.current?.scrollIntoView?.({ block: 'end' })
  }, [cantidad])

  if (!asistente || !conversacion) return null

  const ultimo = conversacion.mensajes[conversacion.mensajes.length - 1]
  const soloBotones = ultimo?.autor === 'asistente' && ultimo.modo === 'solo_arbol'

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const pregunta = texto.trim()
    if (!pregunta || conversacion?.cargando) return
    setTexto('')
    conversacion?.enviarTexto(pregunta)
  }

  return (
    <aside className={styles.panel} aria-label="Asistente">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Asistente</h2>
        <button type="button" className={styles.closeButton} onClick={asistente.cerrar} aria-label="Cerrar asistente">
          ✕
        </button>
      </div>

      <div className={styles.messages} aria-live="polite">
        {conversacion.mensajes.map((mensaje, indice) => {
          const esUltimo = indice === conversacion.mensajes.length - 1
          return (
            <div
              key={mensaje.clave}
              className={mensaje.autor === 'usuario' ? styles.userMessage : styles.assistantMessage}
            >
              <p className={styles.messageText}>{mensaje.texto}</p>
              {mensaje.enlace && (
                <Link to={mensaje.enlace.ruta} className={styles.messageLink}>
                  {mensaje.enlace.etiqueta}
                </Link>
              )}
              {/* Solo los botones del último mensaje siguen activos. */}
              {esUltimo && mensaje.botones && mensaje.botones.length > 0 && (
                <div className={styles.quickReplies}>
                  {mensaje.botones.map((boton) => (
                    <button
                      key={boton.nodo}
                      type="button"
                      className={styles.quickReply}
                      onClick={() => conversacion.pulsarBoton(boton)}
                      disabled={conversacion.cargando}
                    >
                      {boton.etiqueta}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {conversacion.cargando && <p className={styles.typing}>Escribiendo…</p>}
        <div ref={final} />
      </div>

      {soloBotones && <p className={styles.notice}>La búsqueda por texto no está disponible; usa los botones.</p>}

      <form className={styles.composer} onSubmit={enviar}>
        <input
          ref={campo}
          className={styles.composerInput}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu pregunta…"
          aria-label="Pregunta para el asistente"
          maxLength={300}
        />
        <button type="submit" className={styles.sendButton} disabled={!texto.trim() || conversacion.cargando}>
          Enviar
        </button>
      </form>
    </aside>
  )
}
