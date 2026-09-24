from decimal import Decimal

from django.core.validators import MinValueValidator
from rest_framework import serializers

from .models import MovimientoCaja


class MovimientoCajaSerializer(serializers.ModelSerializer):
    """`motivo`, `referencia_id`, `saldo_resultante` y `usuario` son de
    solo lectura: el registro real ocurre en
    `apps.caja.services.registrar_movimiento_caja()`, nunca en
    `serializer.save()` — ver `MovimientoCajaViewSet.create()`. Un
    movimiento manual siempre queda con `motivo = manual`, fijado por el
    backend, nunca elegido por el cliente.

    `observacion` (la "descripción") es obligatoria aquí aunque el modelo
    la declare `blank=True` — los movimientos automáticos de Ventas la
    llenan igual, así que exigirla en la creación manual no rompe nada.
    """

    monto = serializers.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))],
    )
    observacion = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoCaja
        fields = [
            'id', 'fecha', 'tipo_movimiento', 'monto', 'motivo', 'referencia_id', 'observacion',
            'usuario', 'usuario_nombre', 'saldo_resultante',
        ]
        read_only_fields = ['id', 'fecha', 'motivo', 'referencia_id', 'usuario', 'saldo_resultante']

    def get_usuario_nombre(self, movimiento):
        return movimiento.usuario.nombre_mostrado()
