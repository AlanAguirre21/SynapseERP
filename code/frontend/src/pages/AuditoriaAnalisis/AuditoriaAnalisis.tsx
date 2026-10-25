import { useState } from 'react'

import { useUsuarioActual } from '../../hooks/useUsuarioActual'
import { PestanaConteos } from './PestanaConteos'
import { PestanaCortesCaja } from './PestanaCortesCaja'
import { PestanaDiscrepancias } from './PestanaDiscrepancias'
import { PestanaEjecuciones } from './PestanaEjecuciones'
import { PestanaPronosticos } from './PestanaPronosticos'
import { PestanaRegistroAsistente } from './PestanaRegistroAsistente'

export type PestanaAuditoria = 'discrepancias' | 'ejecuciones' | 'cortes' | 'conteos' | 'pronosticos' | 'asistente'

const PESTANAS: { clave: PestanaAuditoria; etiqueta: string; soloAdmin: boolean }[] = [
  { clave: 'discrepancias', etiqueta: 'Discrepancias', soloAdmin: true },
  { clave: 'ejecuciones', etiqueta: 'Ejecuciones', soloAdmin: true },
  { clave: 'cortes', etiqueta: 'Cortes de caja', soloAdmin: true },
  { clave: 'conteos', etiqueta: 'Conteos físicos', soloAdmin: false },
  // 023 · Analítica predictiva.
  { clave: 'pronosticos', etiqueta: 'Pronósticos', soloAdmin: true },
  // 024 · Asistente conversacional.
  { clave: 'asistente', etiqueta: 'Registro del asistente', soloAdmin: true },
]

// Pestaña y sucursal iniciales desde la URL (enlaces de Inventario, Caja y
// el Header). Se leen de `window.location`, igual que en RRHH; solo son el
// valor inicial.
function leerParametrosIniciales(): { pestana: string | null; sucursal: number | null } {
  const parametros = new URLSearchParams(window.location.search)
  const sucursal = Number(parametros.get('sucursal'))
  return { pestana: parametros.get('pestana'), sucursal: Number.isInteger(sucursal) && sucursal > 0 ? sucursal : null }
}

export function AuditoriaAnalisis() {
  const { data: usuario, isLoading } = useUsuarioActual()

  if (isLoading || !usuario) {
    return <p>Cargando…</p>
  }

  return <AuditoriaAnalisisContenido esAdmin={usuario.rol === 'admin'} />
}

function AuditoriaAnalisisContenido({ esAdmin }: { esAdmin: boolean }) {
  // El operador solo recibe "Conteos físicos": las demás pestañas no se
  // renderizan (y sus endpoints le responden 403 en el backend).
  const disponibles = PESTANAS.filter((p) => esAdmin || !p.soloAdmin)
  const [iniciales] = useState(leerParametrosIniciales)
  const [pestana, setPestana] = useState<PestanaAuditoria>(() => {
    const pedida = disponibles.find((p) => p.clave === iniciales.pestana)
    return (pedida ?? disponibles[0]!).clave
  })

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageHeading">
          <h1 className="pageTitle">Auditoría y análisis</h1>
          <p className="pageHint">
            {esAdmin
              ? 'Conciliación de caja y auditoría de inventario automatizadas, y pronósticos de ventas y clientes.'
              : 'Registra los conteos físicos de inventario de cada sucursal.'}
          </p>
        </div>
      </div>

      {disponibles.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Vistas de Auditoría y análisis">
          {disponibles.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={pestana === p.clave}
              className={pestana === p.clave ? 'tab tabActive' : 'tab'}
              onClick={() => setPestana(p.clave)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      )}

      {pestana === 'discrepancias' && <PestanaDiscrepancias sucursalInicial={iniciales.sucursal} />}
      {pestana === 'ejecuciones' && <PestanaEjecuciones />}
      {pestana === 'cortes' && <PestanaCortesCaja />}
      {pestana === 'conteos' && <PestanaConteos esAdmin={esAdmin} />}
      {pestana === 'pronosticos' && <PestanaPronosticos />}
      {pestana === 'asistente' && <PestanaRegistroAsistente />}
    </div>
  )
}
