import { useState } from 'react'

// Conecta un botón del encabezado de la página con el formulario de alta que
// vive dentro de una pestaña: la página incrementa un contador y la pestaña
// abre su formulario al recibir un valor nuevo. Se compara durante el render
// (patrón de estado derivado de React), sin efectos. Al montarse, la pestaña
// toma el valor actual como atendido, así que cambiar de pestaña no abre nada.
export function useSolicitudNuevo(solicitud: number, abrir: () => void) {
  const [atendida, setAtendida] = useState(solicitud)
  if (solicitud !== atendida) {
    setAtendida(solicitud)
    abrir()
  }
}
