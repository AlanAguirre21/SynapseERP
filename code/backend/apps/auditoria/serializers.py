from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.catalogo.models import MateriaPrima, Producto
from apps.inventario.models import MovimientoInventario
from apps.inventario.services import (
    bloquear_inventario_materia_prima,
    bloquear_inventario_producto,
)
from apps.sucursales.models import Sucursal
from core.permissions import es_admin

from .models import (
    ConteoFisico,
    CorteCaja,
    DetalleConteoFisico,
    DiscrepanciaAuditoria,
    EjecucionAuditoria,
)
from .services import nombre_item


def _nombre_usuario(usuario):
    return usuario.nombre_mostrado() if usuario else ''


# --- Cortes de caja ----------------------------------------------------------


class CorteCajaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    diferencia = serializers.SerializerMethodField()

    class Meta:
        model = CorteCaja
        fields = [
            'id', 'fecha_hora_corte', 'monto_contado', 'observacion', 'usuario', 'usuario_nombre',
            'fecha_registro', 'reemplaza', 'ejecucion', 'saldo_esperado', 'diferencia', 'estado',
        ]
        read_only_fields = ['id', 'usuario', 'fecha_registro', 'ejecucion', 'saldo_esperado']
        extra_kwargs = {
            'fecha_hora_corte': {'required': False},
            'monto_contado': {'validators': [MinValueValidator(Decimal(0))]},
            'reemplaza': {'queryset': CorteCaja.objects.all()},
        }

    def get_usuario_nombre(self, corte):
        return _nombre_usuario(corte.usuario)

    def get_estado(self, corte):
        if hasattr(corte, 'reemplazado_por'):
            return 'reemplazado'
        return 'auditado' if corte.ejecucion_id else 'pendiente'

    def get_diferencia(self, corte):
        if corte.saldo_esperado is None:
            return None
        return serializers.DecimalField(max_digits=12, decimal_places=2).to_representation(
            corte.monto_contado - corte.saldo_esperado,
        )

    def validate_fecha_hora_corte(self, valor):
        if valor > timezone.now():
            raise serializers.ValidationError('La fecha y hora del corte no puede estar en el futuro.')
        return valor

    def validate_reemplaza(self, corte):
        if corte is None:
            return corte
        if corte.ejecucion_id:
            raise serializers.ValidationError(
                'Ese corte ya se auditó; corrige el saldo con un movimiento manual en Caja y justifica '
                'la discrepancia.',
            )
        if hasattr(corte, 'reemplazado_por'):
            raise serializers.ValidationError('Ese corte ya fue reemplazado por otro.')
        return corte

    def create(self, datos):
        datos.setdefault('fecha_hora_corte', timezone.now())
        return super().create(datos)


# --- Conteos físicos -----------------------------------------------------------


class DetalleConteoEntradaSerializer(serializers.Serializer):
    tipo_item = serializers.ChoiceField(choices=MovimientoInventario.TIPO_ITEM_CHOICES)
    item_id = serializers.IntegerField()
    cantidad_contada = serializers.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal(0))],
    )

    def validate(self, datos):
        modelo = Producto if datos['tipo_item'] == MovimientoInventario.TIPO_PRODUCTO else MateriaPrima
        item = modelo.objects.filter(pk=datos['item_id'], activo=True).first()
        if item is None:
            raise serializers.ValidationError({'item_id': 'El ítem no existe o está inactivo.'})
        datos['item'] = item
        return datos


class ConteoFisicoCrearSerializer(serializers.Serializer):
    """Entrada de `POST /api/auditoria/conteos/`. Congela el stock teórico de
    cada línea dentro de una transacción, con el stock bloqueado para que no
    cambie entre la lectura y el guardado."""

    sucursal = serializers.PrimaryKeyRelatedField(
        queryset=Sucursal.objects.filter(activo=True),
        error_messages={'does_not_exist': 'La sucursal no existe o está inactiva.'},
    )
    observacion = serializers.CharField(required=False, allow_blank=True, default='')
    detalles = DetalleConteoEntradaSerializer(
        many=True, allow_empty=False,
        error_messages={'empty': 'El conteo debe incluir al menos un ítem.'},
    )

    def validate(self, datos):
        vistos = set()
        for numero, linea in enumerate(datos['detalles'], start=1):
            clave = (linea['tipo_item'], linea['item_id'])
            if clave in vistos:
                raise serializers.ValidationError({
                    'detalles': f'El ítem de la línea {numero} ya está en otra línea del conteo.',
                })
            vistos.add(clave)
        return datos

    @transaction.atomic
    def create(self, datos):
        sucursal = datos['sucursal']
        conteo = ConteoFisico.objects.create(
            sucursal=sucursal, usuario=self.context['request'].user, observacion=datos['observacion'],
        )
        for linea in datos['detalles']:
            if linea['tipo_item'] == MovimientoInventario.TIPO_PRODUCTO:
                inventario = bloquear_inventario_producto(sucursal, linea['item'])
            else:
                inventario = bloquear_inventario_materia_prima(sucursal, linea['item'])
            DetalleConteoFisico.objects.create(
                conteo=conteo, tipo_item=linea['tipo_item'], item_id=linea['item_id'],
                cantidad_contada=linea['cantidad_contada'], stock_teorico=inventario.stock_actual,
            )
        return conteo


class DetalleConteoSerializer(serializers.ModelSerializer):
    item_nombre = serializers.SerializerMethodField()

    class Meta:
        model = DetalleConteoFisico
        fields = ['id', 'tipo_item', 'item_id', 'item_nombre', 'cantidad_contada', 'stock_teorico']

    def get_item_nombre(self, detalle):
        return nombre_item(detalle.tipo_item, detalle.item_id)

    def to_representation(self, detalle):
        datos = super().to_representation(detalle)
        # Conteo ciego: el operador nunca ve el stock teórico.
        if not es_admin(self.context['request'].user):
            datos.pop('stock_teorico')
        return datos


class ConteoFisicoSerializer(serializers.ModelSerializer):
    sucursal_nombre = serializers.CharField(source='sucursal.nombre_sucursal', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    detalles = DetalleConteoSerializer(many=True, read_only=True)

    class Meta:
        model = ConteoFisico
        fields = [
            'id', 'sucursal', 'sucursal_nombre', 'fecha_conteo', 'usuario', 'usuario_nombre', 'observacion',
            'estado', 'ejecucion', 'detalles',
        ]

    def get_usuario_nombre(self, conteo):
        return _nombre_usuario(conteo.usuario)

    def get_estado(self, conteo):
        if conteo.descartado:
            return 'descartado'
        return 'auditado' if conteo.ejecucion_id else 'pendiente'


# --- Ejecuciones y discrepancias ------------------------------------------------


class EjecucionAuditoriaSerializer(serializers.ModelSerializer):
    iniciada_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EjecucionAuditoria
        fields = [
            'id', 'tipo', 'origen', 'iniciada_por', 'iniciada_por_nombre', 'fecha_inicio', 'fecha_fin',
            'estado', 'elementos_revisados', 'discrepancias_encontradas', 'mensaje_error',
        ]

    def get_iniciada_por_nombre(self, ejecucion):
        return _nombre_usuario(ejecucion.iniciada_por)


class EjecutarAuditoriaSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=EjecucionAuditoria.TIPO_CHOICES)


class DiscrepanciaAuditoriaSerializer(serializers.ModelSerializer):
    sucursal_nombre = serializers.CharField(source='sucursal.nombre_sucursal', read_only=True, default='')
    item_nombre = serializers.SerializerMethodField()
    fecha_ejecucion = serializers.DateTimeField(source='ejecucion.fecha_inicio', read_only=True)
    tipo = serializers.CharField(source='ejecucion.tipo', read_only=True)
    resuelta_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = DiscrepanciaAuditoria
        fields = [
            'id', 'ejecucion', 'fecha_ejecucion', 'tipo', 'categoria', 'descripcion', 'corte',
            'movimiento_caja_id', 'sucursal', 'sucursal_nombre', 'tipo_item', 'item_id', 'item_nombre',
            'valor_esperado', 'valor_registrado', 'diferencia', 'estado', 'resuelta_por', 'resuelta_por_nombre',
            'fecha_resolucion', 'comentario_resolucion', 'movimiento_ajuste_id',
        ]

    def get_item_nombre(self, discrepancia):
        if not discrepancia.item_id:
            return ''
        return nombre_item(discrepancia.tipo_item, discrepancia.item_id)

    def get_resuelta_por_nombre(self, discrepancia):
        return _nombre_usuario(discrepancia.resuelta_por)


class ResolverDiscrepanciaSerializer(serializers.Serializer):
    comentario = serializers.CharField(required=False, allow_blank=True, default='')


class ResumenAuditoriaSerializer(serializers.Serializer):
    """Salida de `GET /api/auditoria/resumen/` (ver `services.resumen`)."""

    class UltimaEjecucion(serializers.Serializer):
        id = serializers.IntegerField()
        fecha = serializers.DateTimeField()
        estado = serializers.CharField()
        discrepancias_encontradas = serializers.IntegerField()
        discrepancias_abiertas = serializers.IntegerField()

    class AbiertasSucursal(serializers.Serializer):
        sucursal = serializers.IntegerField()
        sucursal_nombre = serializers.CharField()
        abiertas = serializers.IntegerField()

    class PuntoCorte(serializers.Serializer):
        id = serializers.IntegerField()
        fecha_hora_corte = serializers.DateTimeField()
        saldo_esperado = serializers.DecimalField(max_digits=12, decimal_places=2)
        monto_contado = serializers.DecimalField(max_digits=12, decimal_places=2)
        diferencia = serializers.DecimalField(max_digits=12, decimal_places=2)

    ultima_caja = UltimaEjecucion(allow_null=True)
    ultima_inventario = UltimaEjecucion(allow_null=True)
    abiertas_caja = serializers.IntegerField()
    abiertas_inventario = serializers.IntegerField()
    abiertas_por_sucursal = AbiertasSucursal(many=True)
    serie_cortes = PuntoCorte(many=True)
