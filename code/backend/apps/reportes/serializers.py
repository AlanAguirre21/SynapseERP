from rest_framework import serializers

from .services import PERIODOS_VALIDOS


class PuntoResumenSerializer(serializers.Serializer):
    fecha = serializers.CharField()
    ganancia = serializers.DecimalField(max_digits=12, decimal_places=2)


class ResumenDashboardSerializer(serializers.Serializer):
    periodo = serializers.ChoiceField(choices=PERIODOS_VALIDOS)
    ventas_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    compras_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    ganancia = serializers.DecimalField(max_digits=12, decimal_places=2)
    serie = PuntoResumenSerializer(many=True)


<<<<<<< HEAD
=======
class ResumenDashboardOperadorSerializer(serializers.Serializer):
    """Resumen para el operador: los totales que usan las secciones de Ventas
    y Compras, sin la ganancia ni su serie (solo admin)."""

    periodo = serializers.ChoiceField(choices=PERIODOS_VALIDOS)
    ventas_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    compras_total = serializers.DecimalField(max_digits=12, decimal_places=2)


>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
class PuntoMontoSerializer(serializers.Serializer):
    fecha = serializers.CharField()
    monto = serializers.DecimalField(max_digits=12, decimal_places=2)


class ConteoEstadoSerializer(serializers.Serializer):
    tipo = serializers.CharField()
    cantidad = serializers.IntegerField()


class ResumenVentasSerializer(serializers.Serializer):
    periodo = serializers.ChoiceField(choices=PERIODOS_VALIDOS)
    con_envio = PuntoMontoSerializer(many=True)
    sin_envio = PuntoMontoSerializer(many=True)
    envio = PuntoMontoSerializer(many=True)
    conteo_estado = ConteoEstadoSerializer(many=True)


class ResumenComprasSerializer(serializers.Serializer):
    periodo = serializers.ChoiceField(choices=PERIODOS_VALIDOS)
    todas = PuntoMontoSerializer(many=True)
    productos = PuntoMontoSerializer(many=True)
    insumos = PuntoMontoSerializer(many=True)
    conteo_estado = ConteoEstadoSerializer(many=True)


class ProductoTopSerializer(serializers.Serializer):
    producto = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=2)


class ClienteTopSerializer(serializers.Serializer):
    cliente = serializers.CharField()
    monto = serializers.DecimalField(max_digits=12, decimal_places=2)


<<<<<<< HEAD
=======
class ClienteTopOperadorSerializer(serializers.Serializer):
    """Top de clientes para el operador: número de compras, sin importes
    (`016`, "Actualización: ganancias y movimientos de caja solo para admin")."""

    cliente = serializers.CharField()
    compras = serializers.IntegerField()


>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
class MovimientoCajaReporteSerializer(serializers.Serializer):
    fecha = serializers.DateTimeField()
    tipo_movimiento = serializers.CharField()
    observacion = serializers.CharField()
<<<<<<< HEAD
=======


# --- Resumen facturación (`016`, "Actualización: Resumen facturación con datos")


class PuntoFacturacionSerializer(serializers.Serializer):
    fecha = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    pue = serializers.DecimalField(max_digits=12, decimal_places=2)
    ppd = serializers.DecimalField(max_digits=12, decimal_places=2)


class ConteoEstadoFacturaSerializer(serializers.Serializer):
    estado = serializers.CharField()
    tipo = serializers.CharField()
    cantidad = serializers.IntegerField()


class FacturaPorAtenderSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    serie = serializers.CharField(allow_blank=True)
    folio_interno = serializers.IntegerField(allow_null=True)
    cliente = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    estado = serializers.CharField()
    fecha = serializers.DateTimeField()


class ResumenFacturacionSerializer(serializers.Serializer):
    periodo = serializers.ChoiceField(choices=PERIODOS_VALIDOS)
    facturado_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    facturas_emitidas = serializers.IntegerField()
    por_cobrar_ppd = serializers.DecimalField(max_digits=12, decimal_places=2)
    porcentaje_facturado = serializers.DecimalField(max_digits=5, decimal_places=1, allow_null=True)
    serie = PuntoFacturacionSerializer(many=True)
    conteo_estado = ConteoEstadoFacturaSerializer(many=True)
    requiere_atencion = FacturaPorAtenderSerializer(many=True)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
