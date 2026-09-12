"""Arma el diccionario que se envía a `pac_client.timbrar()` a partir de
la venta, los datos fiscales del cliente (`008`) y de la empresa (`016`)
— feature `017 · Facturación`.
"""

from apps.configuracion_fiscal.models import DatosFiscalesEmpresa


def armar_datos_cfdi(venta, factura, serie_folio):
    empresa = DatosFiscalesEmpresa.cargar()
    datos_fiscales_cliente = venta.cliente.datos_fiscales

    conceptos = [
        {
            'descripcion': detalle.producto.nombre_producto,
            'cantidad': str(detalle.cantidad),
            'valor_unitario': str(detalle.precio_unitario),
            'importe': str(detalle.subtotal),
        }
        for detalle in venta.detalles.select_related('producto').all()
    ]
    # Sin esto, el total del CFDI no reconciliaría con la suma de sus
    # propios conceptos cuando la venta tiene gasto de envío — un PAC real
    # rechazaría ese timbrado (ver spec.md de 011 · Ventas, "Gasto de envío").
    if venta.gasto_envio:
        conceptos.append({
            'descripcion': 'Gastos de envío',
            'cantidad': '1.00',
            'valor_unitario': str(venta.gasto_envio),
            'importe': str(venta.gasto_envio),
        })

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
        'conceptos': conceptos,
        'total': str(venta.total),
    }
