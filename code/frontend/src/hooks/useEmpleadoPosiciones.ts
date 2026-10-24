import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearEmpleadoPosicion,
<<<<<<< HEAD
=======
  getEmpleadoPosicionesVigentes,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
  getEmpleadoPosicionesVigentesPorPosicion,
  type EmpleadoPosicionFormulario,
} from '../api/rrhh'

<<<<<<< HEAD
=======
// Comparte el prefijo `empleado-posiciones`: contratar y desactivar ya
// invalidan ese prefijo completo, así que esta consulta se refresca sola.
const CLAVE_VIGENTES = ['empleado-posiciones', 'vigentes'] as const

// Todas las asignaciones vigentes de la empresa (directorio y ocupación).
export function useAsignacionesVigentes() {
  return useQuery({
    queryKey: CLAVE_VIGENTES,
    queryFn: getEmpleadoPosicionesVigentes,
  })
}

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
// Empleados que desempeñan una posición ahora mismo, ya ordenados por el
// backend (antigüedad en el puesto) — el selector 5/10/todos de `RRHH.tsx`
// recorta este arreglo del lado del cliente, sin volver a pedirlo.
export function useEmpleadoPosicionesVigentes(posicionId: number | null) {
  return useQuery({
    queryKey: ['empleado-posiciones', posicionId],
    queryFn: () => getEmpleadoPosicionesVigentesPorPosicion(posicionId as number),
    enabled: posicionId !== null,
  })
}

export function useCrearEmpleadoPosicion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: EmpleadoPosicionFormulario) => crearEmpleadoPosicion(datos),
    onSuccess: (asignacion) => {
      queryClient.invalidateQueries({ queryKey: ['empleado-posiciones', asignacion.posicion] })
<<<<<<< HEAD
=======
      queryClient.invalidateQueries({ queryKey: CLAVE_VIGENTES })
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
      queryClient.invalidateQueries({ queryKey: ['empleados-rrhh'] })
    },
  })
}
