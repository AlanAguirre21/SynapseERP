import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  crearEmpleadoPosicion,
  getEmpleadoPosicionesVigentesPorPosicion,
  type EmpleadoPosicionFormulario,
} from '../api/rrhh'

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
      queryClient.invalidateQueries({ queryKey: ['empleados-rrhh'] })
    },
  })
}
