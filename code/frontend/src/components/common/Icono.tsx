import type { ReactNode, SVGProps } from 'react'

export type NombreIcono =
  | 'menu'
  | 'campana'
  | 'candado'
  | 'ventas'
  | 'compras'
  | 'produccion'
  | 'inventario'
  | 'facturacion'
  | 'caja'
  | 'catalogo'
  | 'personas'
  | 'sucursales'
  | 'contabilidad'
  | 'configuracionFiscal'
  | 'usuarios'

const TRAZOS: Record<NombreIcono, ReactNode> = {
  menu: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>
  ),
  campana: (
    <>
      <path d="M12 4a5 5 0 0 0-5 5c0 4.5-1.5 6-1.5 6h13S17 13.5 17 9a5 5 0 0 0-5-5Z" />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  ventas: (
    <>
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20.5 8H6" />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  compras: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  produccion: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3" />
      <path d="M7.5 14h9" />
    </>
  ),
  inventario: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7Z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </>
  ),
  facturacion: (
    <>
      <path d="M7 3h7l4 4v14H7Z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 12h6M9.5 15.5h6M9.5 9h3" />
    </>
  ),
  caja: (
    <>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <circle cx="12" cy="12.5" r="2.3" />
      <path d="M6 9.5v.01M18 15.5v.01" />
    </>
  ),
  catalogo: (
    <>
      <path d="M11.5 3H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l6-6a2 2 0 0 0 0-2.8l-9-9a2 2 0 0 0-1.4-.6Z" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  personas: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 20a6 6 0 0 1 12 0" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M14.8 20a5 5 0 0 1 8.2-4" />
    </>
  ),
  sucursales: (
    <>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  contabilidad: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <circle cx="8.3" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8.3" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  configuracionFiscal: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="14" cy="6" r="2.2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="9" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="16" cy="18" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  usuarios: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M6 16c.5-1.8 1.8-2.6 2.5-2.6s2 .8 2.5 2.6" />
      <path d="M14 10h5M14 13h5M14 16h3" />
    </>
  ),
}

interface IconoProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  nombre: NombreIcono
  tamano?: number
}

export function Icono({ nombre, tamano = 20, ...resto }: IconoProps) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...resto}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
