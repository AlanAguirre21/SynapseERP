import { apiClient } from './client'

// --- Departamentos ----------------------------------------------------------

export interface Departamento {
  id: number
  nombre_departamento: string
  departamento_padre: number | null
  posicion_manager: number | null
  activo: boolean
}

export type DepartamentoFormulario = Pick<
  Departamento,
  'nombre_departamento' | 'departamento_padre' | 'posicion_manager'
>

export async function getDepartamentos(): Promise<Departamento[]> {
  const { data } = await apiClient.get<Departamento[]>('/rrhh/departamentos/')
  return data
}

export async function crearDepartamento(datos: DepartamentoFormulario): Promise<Departamento> {
  const { data } = await apiClient.post<Departamento>('/rrhh/departamentos/', datos)
  return data
}

export async function editarDepartamento(id: number, datos: DepartamentoFormulario): Promise<Departamento> {
  const { data } = await apiClient.patch<Departamento>(`/rrhh/departamentos/${id}/`, datos)
  return data
}

export async function desactivarDepartamento(id: number): Promise<void> {
  await apiClient.delete(`/rrhh/departamentos/${id}/`)
}

export async function reactivarDepartamento(id: number): Promise<Departamento> {
  const { data } = await apiClient.post<Departamento>(`/rrhh/departamentos/${id}/reactivar/`)
  return data
}

// --- Posiciones --------------------------------------------------------------

export interface Posicion {
  id: number
  titulo_posicion: string
  departamento: number
  reporta_a: number | null
  salario_minimo: string
  salario_maximo: string
  activo: boolean
}

export type PosicionFormulario = Pick<
  Posicion,
  'titulo_posicion' | 'departamento' | 'reporta_a' | 'salario_minimo' | 'salario_maximo'
>

export async function getPosiciones(departamentoId: number): Promise<Posicion[]> {
  const { data } = await apiClient.get<Posicion[]>('/rrhh/posiciones/', {
    params: { departamento: departamentoId },
  })
  return data
}

export async function crearPosicion(datos: PosicionFormulario): Promise<Posicion> {
  const { data } = await apiClient.post<Posicion>('/rrhh/posiciones/', datos)
  return data
}

export async function editarPosicion(id: number, datos: PosicionFormulario): Promise<Posicion> {
  const { data } = await apiClient.patch<Posicion>(`/rrhh/posiciones/${id}/`, datos)
  return data
}

export async function desactivarPosicion(id: number): Promise<void> {
  await apiClient.delete(`/rrhh/posiciones/${id}/`)
}

export async function reactivarPosicion(id: number): Promise<Posicion> {
  const { data } = await apiClient.post<Posicion>(`/rrhh/posiciones/${id}/reactivar/`)
  return data
}

// --- Empleados -----------------------------------------------------------

export interface Empleado {
  id: number
  nombre_completo: string
  curp: string
  rfc: string
  nss: string
  telefono: string
  email: string
  fotografia: string | null
  cuenta_bancaria: string
  activo: boolean
}

export type EmpleadoFormulario = Pick<
  Empleado,
  'nombre_completo' | 'curp' | 'rfc' | 'nss' | 'telefono' | 'email' | 'cuenta_bancaria'
>

export type MotivoCambio = 'contratacion' | 'ascenso' | 'transferencia' | 'despido' | 'renuncia'

function construirFormDataEmpleado(datos: EmpleadoFormulario, foto?: File | null): FormData {
  const formData = new FormData()
  Object.entries(datos).forEach(([clave, valor]) => formData.append(clave, valor))
  if (foto) formData.append('fotografia', foto)
  return formData
}

export async function getEmpleados(): Promise<Empleado[]> {
  const { data } = await apiClient.get<Empleado[]>('/rrhh/empleados/')
  return data
}

// Selector de empleado en el alta/edición de Usuario (feature 010 ·
// Usuarios): solo empleados activos sin cuenta ya vinculada (relación 1:1).
export async function getEmpleadosDisponibles(): Promise<Empleado[]> {
  const { data } = await apiClient.get<Empleado[]>('/rrhh/empleados/', { params: { disponible: 'true' } })
  return data
}

export async function getEmpleado(id: number): Promise<Empleado> {
  const { data } = await apiClient.get<Empleado>(`/rrhh/empleados/${id}/`)
  return data
}

export async function crearEmpleado(datos: EmpleadoFormulario, foto?: File | null): Promise<Empleado> {
  const { data } = await apiClient.post<Empleado>(
    '/rrhh/empleados/', construirFormDataEmpleado(datos, foto),
  )
  return data
}

export async function editarEmpleado(id: number, datos: EmpleadoFormulario, foto?: File | null): Promise<Empleado> {
  const { data } = await apiClient.patch<Empleado>(
    `/rrhh/empleados/${id}/`, construirFormDataEmpleado(datos, foto),
  )
  return data
}

// `motivoCambio` viaja siempre en el cuerpo del DELETE: el backend solo lo
// exige de verdad cuando el empleado tiene una asignación vigente que
// cerrar, pero pedirlo siempre en el modal de confirmación es más simple
// que consultar por adelantado si existe esa asignación.
export async function desactivarEmpleado(id: number, motivoCambio: MotivoCambio): Promise<void> {
  await apiClient.delete(`/rrhh/empleados/${id}/`, { data: { motivo_cambio: motivoCambio } })
}

export async function reactivarEmpleado(id: number): Promise<Empleado> {
  const { data } = await apiClient.post<Empleado>(`/rrhh/empleados/${id}/reactivar/`)
  return data
}

export interface ContratarEmpleadoFormulario extends EmpleadoFormulario {
  posicion: number
  salario_asignado: string
  fecha_inicio: string
}

// Alta combinada de Empleado + su primera EmpleadoPosicion, en una sola
// petición atómica del lado del backend — a propósito NO son dos llamadas
// separadas (crear empleado, luego crear asignación): si la segunda
// fallara por rango salarial, la primera ya habría dejado un Empleado
// huérfano sin ninguna posición. Va como FormData (no JSON), igual que
// crearEmpleado/editarEmpleado, para poder llevar la fotografía inicial.
export async function contratarEmpleado(datos: ContratarEmpleadoFormulario, foto?: File | null): Promise<Empleado> {
  const formData = new FormData()
  Object.entries(datos).forEach(([clave, valor]) => formData.append(clave, String(valor)))
  if (foto) formData.append('fotografia', foto)

  const { data } = await apiClient.post<Empleado>('/rrhh/empleados/contratar/', formData)
  return data
}

// --- EmpleadoPosicion (historial de asignaciones) -------------------------

export interface EmpleadoPosicion {
  id: number
  empleado: number
  posicion: number
  salario_asignado: string
  fecha_inicio: string
  fecha_termino: string | null
  motivo_cambio: MotivoCambio
}

export type EmpleadoPosicionFormulario = Pick<
  EmpleadoPosicion,
  'empleado' | 'posicion' | 'salario_asignado' | 'fecha_inicio' | 'motivo_cambio'
>

// Empleados que desempeñan `posicionId` en este momento — ya ordenados por
// el backend (antigüedad en el puesto). El selector 5/10/todos recorta este
// arreglo del lado del cliente, sin volver a llamar a la API.
export async function getEmpleadoPosicionesVigentesPorPosicion(posicionId: number): Promise<EmpleadoPosicion[]> {
  const { data } = await apiClient.get<EmpleadoPosicion[]>('/rrhh/empleado-posiciones/', {
    params: { posicion: posicionId, vigente: true },
  })
  return data
}

export async function crearEmpleadoPosicion(datos: EmpleadoPosicionFormulario): Promise<EmpleadoPosicion> {
  const { data } = await apiClient.post<EmpleadoPosicion>('/rrhh/empleado-posiciones/', datos)
  return data
}

// --- ContactoEmergencia / Dependiente ---------------------------------------

export interface ContactoEmergencia {
  id: number
  empleado: number
  nombre_contacto: string
  telefono: string
  parentesco: string
}

export type ContactoEmergenciaFormulario = Pick<
  ContactoEmergencia, 'empleado' | 'nombre_contacto' | 'telefono' | 'parentesco'
>

export async function getContactosEmergencia(empleadoId: number): Promise<ContactoEmergencia[]> {
  const { data } = await apiClient.get<ContactoEmergencia[]>('/rrhh/contactos-emergencia/', {
    params: { empleado: empleadoId },
  })
  return data
}

export async function crearContactoEmergencia(datos: ContactoEmergenciaFormulario): Promise<ContactoEmergencia> {
  const { data } = await apiClient.post<ContactoEmergencia>('/rrhh/contactos-emergencia/', datos)
  return data
}

export async function eliminarContactoEmergencia(id: number): Promise<void> {
  await apiClient.delete(`/rrhh/contactos-emergencia/${id}/`)
}

export interface Dependiente {
  id: number
  empleado: number
  nombre_dependiente: string
  parentesco: string
}

export type DependienteFormulario = Pick<Dependiente, 'empleado' | 'nombre_dependiente' | 'parentesco'>

export async function getDependientes(empleadoId: number): Promise<Dependiente[]> {
  const { data } = await apiClient.get<Dependiente[]>('/rrhh/dependientes/', {
    params: { empleado: empleadoId },
  })
  return data
}

export async function crearDependiente(datos: DependienteFormulario): Promise<Dependiente> {
  const { data } = await apiClient.post<Dependiente>('/rrhh/dependientes/', datos)
  return data
}

export async function eliminarDependiente(id: number): Promise<void> {
  await apiClient.delete(`/rrhh/dependientes/${id}/`)
}

// --- SolicitudNomina ---------------------------------------------------------

export type EstadoSolicitudNomina = 'pendiente' | 'aprobado' | 'rechazado'

export interface SolicitudNomina {
  id: number
  empleado: number
  periodo_inicio: string
  periodo_fin: string
  monto: string
  estado: EstadoSolicitudNomina
  fecha_solicitud: string
  fecha_resolucion: string | null
  resuelto_por: number | null
}

export type SolicitudNominaFormulario = Pick<SolicitudNomina, 'empleado' | 'periodo_inicio' | 'periodo_fin' | 'monto'>

export async function crearSolicitudNomina(datos: SolicitudNominaFormulario): Promise<SolicitudNomina> {
  const { data } = await apiClient.post<SolicitudNomina>('/rrhh/solicitudes-nomina/', datos)
  return data
}

export async function getSolicitudesNominaPendientes(): Promise<SolicitudNomina[]> {
  const { data } = await apiClient.get<SolicitudNomina[]>('/rrhh/solicitudes-nomina/', {
    params: { estado: 'pendiente' },
  })
  return data
}

export async function aprobarSolicitudNomina(id: number): Promise<SolicitudNomina> {
  const { data } = await apiClient.post<SolicitudNomina>(`/rrhh/solicitudes-nomina/${id}/aprobar/`)
  return data
}

export async function rechazarSolicitudNomina(id: number): Promise<SolicitudNomina> {
  const { data } = await apiClient.post<SolicitudNomina>(`/rrhh/solicitudes-nomina/${id}/rechazar/`)
  return data
}
