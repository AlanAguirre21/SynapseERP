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


class MovimientoCajaReporteSerializer(serializers.Serializer):
    fecha = serializers.DateTimeField()
    tipo_movimiento = serializers.CharField()
    observacion = serializers.CharField()
