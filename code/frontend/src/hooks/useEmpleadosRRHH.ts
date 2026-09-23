import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  contratarEmpleado,
  crearEmpleado,
  desactivarEmpleado,
  editarEmpleado,
  getEmpleados,
  reactivarEmpleado,
  type ContratarEmpleadoFormulario,
  type EmpleadoFormulario,
  type MotivoCambio,
} from '../api/rrhh'

// Nombre distinto al hook legado `useEmpleados` de `personas` (feature 008 ·
// Personas, ya dividida) — ese hook se elimina en este split, ver `tasks.md`.
const CLAVE_EMPLEADOS = ['empleados-rrhh']

export function useEmpleadosRRHH() {
  return useQuery({
    queryKey: CLAVE_EMPLEADOS,
    queryFn: getEmpleados,
  })
}

export function useCrearEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ datos, foto }: { datos: EmpleadoFormulario; foto?: File | null }) =>
      crearEmpleado(datos, foto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS }),
  })
}

export function useContratarEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ datos, foto }: { datos: ContratarEmpleadoFormulario; foto?: File | null }) =>
      contratarEmpleado(datos, foto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS })
      queryClient.invalidateQueries({ queryKey: ['empleado-posiciones'] })
    },
  })
}

export function useEditarEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos, foto }: { id: number; datos: EmpleadoFormulario; foto?: File | null }) =>
      editarEmpleado(id, datos, foto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS }),
  })
}

export function useDesactivarEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivoCambio }: { id: number; motivoCambio: MotivoCambio }) =>
      desactivarEmpleado(id, motivoCambio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS })
      queryClient.invalidateQueries({ queryKey: ['empleado-posiciones'] })
      // La desactivación puede haber cerrado la sesión del usuario vinculado
      // (cascada del backend) — invalidar por si el admin lo está viendo.
      queryClient.invalidateQueries({ queryKey: ['usuarios-cuentas'] })
    },
  })
}

export function useReactivarEmpleado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivarEmpleado,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_EMPLEADOS }),
  })
}
