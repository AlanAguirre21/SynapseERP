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
