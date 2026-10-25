from rest_framework import serializers

from apps.reportes.services import PERIODO_ANIO, PERIODO_MES, PERIODO_SEMANA

from . import modelo
from .models import GeneracionPronostico, Pronostico, PuntoPronostico

DECIMAL = {'max_digits': 14, 'decimal_places': 2}


class GeneracionPronosticoSerializer(serializers.ModelSerializer):
    iniciada_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = GeneracionPronostico
        fields = [
            'id', 'origen', 'iniciada_por', 'iniciada_por_nombre', 'fecha_inicio', 'fecha_fin', 'estado',
            'horizonte', 'granularidad', 'periodo_desde', 'periodo_hasta', 'historial_desde', 'historial_hasta',
            'mensaje_error',
        ]

    def get_iniciada_por_nombre(self, generacion):
        return generacion.iniciada_por.nombre_mostrado() if generacion.iniciada_por else ''


class GenerarPronosticoSerializer(serializers.Serializer):
    """Entrada de `POST /api/analitica/generaciones/generar/`. Sin
    `horizonte` genera los tres estándar; `personalizado` exige el rango.
    Las reglas del rango (fechas futuras, máximo de periodos) las aplica
    `services.resolver_rango()`."""

    horizonte = serializers.ChoiceField(choices=GeneracionPronostico.HORIZONTE_CHOICES, required=False)
    desde = serializers.DateField(required=False)
    hasta = serializers.DateField(required=False)
    granularidad = serializers.ChoiceField(choices=GeneracionPronostico.GRANULARIDAD_CHOICES, required=False)

    def validate(self, datos):
        if datos.get('horizonte') == GeneracionPronostico.HORIZONTE_PERSONALIZADO:
            faltantes = [campo for campo in ('desde', 'hasta', 'granularidad') if not datos.get(campo)]
            if faltantes:
                raise serializers.ValidationError(
                    {campo: 'Obligatorio para un rango personalizado.' for campo in faltantes},
                )
        return datos


class PuntoPronosticoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PuntoPronostico
        fields = ['periodo_inicio', 'periodo_fin', 'valor', 'limite_inferior', 'limite_superior']


class PronosticoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre_producto', read_only=True, default='')
    categoria_nombre = serializers.CharField(source='categoria.nombre_categoria', read_only=True, default='')
    precision = serializers.SerializerMethodField()
    puntos = PuntoPronosticoSerializer(many=True, read_only=True)

    class Meta:
        model = Pronostico
        fields = [
            'id', 'generacion', 'metrica', 'producto', 'producto_nombre', 'categoria', 'categoria_nombre', 'estado',
            'periodos_historial', 'periodos_minimos', 'metodo', 'wape', 'precision', 'total_pronosticado',
            'total_inferior', 'total_superior', 'puntos',
        ]

    def get_precision(self, pronostico):
        return modelo.etiqueta_precision(pronostico.wape)


class _PuntoHistorial(serializers.Serializer):
    periodo_inicio = serializers.DateField()
    valor = serializers.DecimalField(**DECIMAL)


class _PuntoPrecision(serializers.Serializer):
    periodo_inicio = serializers.DateField()
    pronosticado = serializers.DecimalField(**DECIMAL)
    real = serializers.DecimalField(**DECIMAL)


class _Precision(serializers.Serializer):
    generacion = serializers.IntegerField()
    puntos = _PuntoPrecision(many=True)
    wape = serializers.DecimalField(max_digits=7, decimal_places=4, allow_null=True)


class VistaPronosticoSerializer(serializers.Serializer):
    """Salida de `GET /api/analitica/vista/`: historial + pronóstico vigente
    + precisión real, listos para graficar."""

    generacion = GeneracionPronosticoSerializer(allow_null=True)
    pronostico = PronosticoSerializer(allow_null=True)
    historial = _PuntoHistorial(many=True)
    precision_real = _Precision(allow_null=True)


class VistaEntradaSerializer(serializers.Serializer):
    metrica = serializers.ChoiceField(choices=Pronostico.METRICA_CHOICES, default=Pronostico.METRICA_MONTO_VENTAS)
    horizonte = serializers.ChoiceField(
        choices=GeneracionPronostico.HORIZONTE_CHOICES, default=GeneracionPronostico.HORIZONTE_SEMANAS_4,
    )
    generacion = serializers.IntegerField(required=False)
    producto = serializers.IntegerField(required=False)
    categoria = serializers.IntegerField(required=False)


class _PuntoProyeccion(serializers.Serializer):
    periodo_inicio = serializers.DateField()
    valor = serializers.DecimalField(**DECIMAL)
    limite_inferior = serializers.DecimalField(**DECIMAL)
    limite_superior = serializers.DecimalField(**DECIMAL)


class ProyeccionDashboardSerializer(serializers.Serializer):
    granularidad = serializers.CharField()
    real = _PuntoHistorial(many=True)
    proyeccion = _PuntoProyeccion(many=True)
    generacion_fecha = serializers.DateTimeField(allow_null=True)


class ProyeccionEntradaSerializer(serializers.Serializer):
    periodo = serializers.ChoiceField(choices=[PERIODO_SEMANA, PERIODO_MES, PERIODO_ANIO])


class _ProductoDemanda(serializers.Serializer):
    producto = serializers.IntegerField()
    producto_nombre = serializers.CharField()
    unidades = serializers.DecimalField(**DECIMAL)
    limite_inferior = serializers.DecimalField(**DECIMAL)
    limite_superior = serializers.DecimalField(**DECIMAL)
    wape = serializers.DecimalField(max_digits=7, decimal_places=4, allow_null=True)
    precision = serializers.CharField(allow_null=True)
    stock_total = serializers.DecimalField(**DECIMAL)
    insuficiente = serializers.BooleanField()


class DemandaSerializer(serializers.Serializer):
    generacion = GeneracionPronosticoSerializer(allow_null=True)
    productos = _ProductoDemanda(many=True)


class DemandaEntradaSerializer(serializers.Serializer):
    horizonte = serializers.ChoiceField(
        choices=GeneracionPronostico.HORIZONTES_ESTANDAR, default=GeneracionPronostico.HORIZONTE_SEMANAS_4,
    )
    # Sin límite = todos los productos.
    limite = serializers.IntegerField(required=False, min_value=1)
    # Una generación concreta (ej. un rango personalizado) en vez de la vigente.
    generacion = serializers.PrimaryKeyRelatedField(queryset=GeneracionPronostico.objects.all(), required=False)
