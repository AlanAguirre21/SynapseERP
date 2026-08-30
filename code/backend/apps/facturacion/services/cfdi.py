"""Arma el diccionario que se envía a `pac_client.timbrar()` a partir de
la venta, los datos fiscales del cliente (`008`) y de la empresa (`016`)
— feature `017 · Facturación`.
"""

from apps.configuracion_fiscal.models import DatosFiscalesEmpresa


def armar_datos_cfdi(venta, factura, serie_folio):
    empresa = DatosFiscalesEmpresa.cargar()
    datos_fiscales_cliente = venta.cliente.datos_fiscales

    return {
        'emisor': {
            'rfc': empresa.rfc,
            'razon_social': empresa.razon_social,
            'regimen_fiscal': empresa.regimen_fiscal,
        },
        'receptor': {
            'rfc': datos_fiscales_cliente.rfc,
            'razon_social': datos_fiscales_cliente.razon_social,
            'codigo_postal_fiscal': datos_fiscales_cliente.codigo_postal_fiscal,
            'regimen_fiscal': datos_fiscales_cliente.regimen_fiscal,
            'uso_cfdi': factura.uso_cfdi,
        },
        'serie': serie_folio.serie,
        'folio': serie_folio.folio_actual + 1,
        'fecha': venta.fecha.isoformat(),
        'forma_pago': factura.forma_pago,
        'metodo_pago': factura.metodo_pago,
        'conceptos': [
            {
                'descripcion': detalle.producto.nombre_producto,
                'cantidad': str(detalle.cantidad),
                'valor_unitario': str(detalle.precio_unitario),
                'importe': str(detalle.subtotal),
            }
            for detalle in venta.detalles.select_related('producto').all()
        ],
        'total': str(venta.total),
    }
