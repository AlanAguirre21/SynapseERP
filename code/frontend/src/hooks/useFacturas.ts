import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cancelarFactura,
  descargarPdfFactura,
  descargarXmlFactura,
  generarFactura,
  getComplementosPago,
  getFactura,
  getFacturas,
  registrarComplementoPago,
  type FiltrosFacturas,
  type MotivoCancelacion,
} from '../api/facturacion'

export function useFacturas(filtros: FiltrosFacturas) {
  return useQuery({
    queryKey: ['facturas', filtros],
    queryFn: () => getFacturas(filtros),
  })
}

export function useFactura(id: number) {
  return useQuery({
    queryKey: ['factura', id],
    queryFn: () => getFactura(id),
    enabled: Number.isFinite(id),
  })
}

// Filtra por venta en el cliente (la lista de facturas ya suele ser
// pequeña) para saber, desde `DetalleVenta`, si esa venta ya tiene una
// factura vigente o un intento fallido que se puede reintentar.
export function useFacturaDeVenta(ventaId: number) {
  const { data: facturas, isLoading } = useFacturas({})
  const factura = (facturas ?? []).find((f) => f.venta === ventaId)
  return { data: factura, isLoading }
}

export function useGenerarFactura() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generarFactura,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
    },
  })
}

export function useCancelarFactura() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: MotivoCancelacion }) => cancelarFactura(id, motivo),
    onSuccess: (factura) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
      queryClient.invalidateQueries({ queryKey: ['factura', factura.id] })
    },
  })
}

export function useDescargarXmlFactura() {
  return useMutation({ mutationFn: descargarXmlFactura })
}

export function useDescargarPdfFactura() {
  return useMutation({ mutationFn: descargarPdfFactura })
}

export function useComplementosPago(facturaId: number) {
  return useQuery({
    queryKey: ['complementos-pago', facturaId],
    queryFn: () => getComplementosPago(facturaId),
    enabled: Number.isFinite(facturaId),
  })
}

export function useRegistrarComplementoPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: registrarComplementoPago,
    onSuccess: (complemento) => {
      queryClient.invalidateQueries({ queryKey: ['complementos-pago', complemento.factura] })
    },
  })
}
