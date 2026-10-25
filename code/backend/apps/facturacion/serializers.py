from rest_framework import serializers

from apps.ventas.models import Venta
from core.permissions import es_admin

from .models import ComplementoPago, Factura


class FacturaSerializer(serializers.ModelSerializer):
    """`venta` es el único campo realmente escrito por el cliente en
    `create` junto con `uso_cfdi`/`forma_pago`/`metodo_pago` — el resto
    (`folio_fiscal`, `serie`, `estado`, etc.) lo decide
    `FacturaViewSet.create()` según la respuesta del PAC, nunca el
    request. Ninguna factura se puede editar una vez creada (el ViewSet
    no expone `update`/`destroy`), así que no hace falta distinguir un
    serializer de escritura aparte.
    """

    venta = serializers.PrimaryKeyRelatedField(
        queryset=Venta.objects.all(), error_messages={'does_not_exist': 'No existe la venta indicada.'},
    )
    cliente_nombre = serializers.SerializerMethodField()
    usuario_nombre = serializers.SerializerMethodField()
    venta_total = serializers.DecimalField(source='venta.total', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Factura
        fields = [
            'id', 'venta', 'venta_total', 'cliente_nombre', 'usuario', 'usuario_nombre',
            'folio_fiscal', 'serie', 'folio_interno', 'uso_cfdi', 'forma_pago', 'metodo_pago',
            'estado', 'mensaje_error', 'motivo_cancelacion', 'fecha_solicitud_cancelacion',
            'fecha_creacion', 'fecha_timbrado',
        ]
        read_only_fields = [
            'id', 'usuario', 'folio_fiscal', 'serie', 'folio_interno', 'estado', 'mensaje_error',
            'motivo_cancelacion', 'fecha_solicitud_cancelacion', 'fecha_creacion', 'fecha_timbrado',
        ]

    def get_fields(self):
        # El operador solo puede facturar sus propias ventas: una ajena "no
        # existe" para él (`019`, "Actualización: el operador solo ve las
        # facturas de sus ventas").
        campos = super().get_fields()
        request = self.context.get('request')
        if request is not None and not es_admin(request.user):
            campos['venta'].queryset = Venta.objects.filter(usuario=request.user)
        return campos

    def get_cliente_nombre(self, factura):
        return factura.venta.cliente.nombre_cliente if factura.venta.cliente else 'Sin cliente'

    def get_usuario_nombre(self, factura):
        return factura.usuario.nombre_mostrado()


class ComplementoPagoSerializer(serializers.ModelSerializer):
    """`factura` es el único campo de entrada real además de
    `monto_pagado`/`fecha_pago` — `folio_fiscal_rep`/`estado` los decide
    `ComplementoPagoViewSet.create()` según la respuesta del PAC.
    """

    factura = serializers.PrimaryKeyRelatedField(
        queryset=Factura.objects.all(), error_messages={'does_not_exist': 'No existe la factura indicada.'},
    )

    class Meta:
        model = ComplementoPago
        fields = [
            'id', 'factura', 'usuario', 'monto_pagado', 'fecha_pago', 'folio_fiscal_rep',
            'estado', 'mensaje_error', 'fecha_creacion',
        ]
        read_only_fields = ['id', 'usuario', 'folio_fiscal_rep', 'estado', 'mensaje_error', 'fecha_creacion']

    def get_fields(self):
        # Complementos solo sobre facturas de ventas propias para el operador.
        campos = super().get_fields()
        request = self.context.get('request')
        if request is not None and not es_admin(request.user):
            campos['factura'].queryset = Factura.objects.filter(venta__usuario=request.user)
        return campos
