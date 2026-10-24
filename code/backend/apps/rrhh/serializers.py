from rest_framework import serializers

from .models import (
    ContactoEmergencia,
    Departamento,
    Dependiente,
    Empleado,
    EmpleadoPosicion,
    Posicion,
    SolicitudNomina,
)


class DepartamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Departamento
        fields = ['id', 'nombre_departamento', 'departamento_padre', 'posicion_manager', 'activo']
        read_only_fields = ['id', 'activo']


class PosicionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Posicion
        fields = [
            'id', 'titulo_posicion', 'departamento', 'reporta_a',
            'salario_minimo', 'salario_maximo', 'activo',
        ]
        read_only_fields = ['id', 'activo']

    def validate(self, attrs):
        minimo = attrs.get('salario_minimo', getattr(self.instance, 'salario_minimo', None))
        maximo = attrs.get('salario_maximo', getattr(self.instance, 'salario_maximo', None))

        if minimo is not None and maximo is not None and minimo > maximo:
            raise serializers.ValidationError({
                'salario_maximo': 'El salario máximo no puede ser menor al salario mínimo.',
            })

        return attrs


class ContratarEmpleadoSerializer(serializers.Serializer):
    """Alta combinada de `Empleado` + su primera `EmpleadoPosicion` (motivo
    fijo `'contratacion'`), en una sola operación — evita el registro
    huérfano de `Empleado` que quedaría si el frontend hiciera dos
    peticiones separadas y la segunda (la asignación) fallara por rango
    salarial, dejando un empleado sin ninguna posición y sin aviso claro.
    Usada por `EmpleadoViewSet.contratar`, envuelta en `transaction.atomic`.
    """

    nombre_completo = serializers.CharField(max_length=150)
    curp = serializers.CharField(max_length=18, required=False, allow_blank=True, default='')
    rfc = serializers.CharField(max_length=13, required=False, allow_blank=True, default='')
    nss = serializers.CharField(max_length=11, required=False, allow_blank=True, default='')
    telefono = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    cuenta_bancaria = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    fotografia = serializers.ImageField(required=False, allow_null=True)
    posicion = serializers.PrimaryKeyRelatedField(queryset=Posicion.objects.all())
    salario_asignado = serializers.DecimalField(max_digits=12, decimal_places=2)
    fecha_inicio = serializers.DateField()

    def validate(self, attrs):
        posicion = attrs['posicion']
        salario = attrs['salario_asignado']

        if not (posicion.salario_minimo <= salario <= posicion.salario_maximo):
            raise serializers.ValidationError({
                'salario_asignado': (
                    f'El salario asignado debe estar entre {posicion.salario_minimo} y '
                    f'{posicion.salario_maximo} para la posición "{posicion.titulo_posicion}".'
                ),
            })

        return attrs

    def create(self, validated_data):
        posicion = validated_data.pop('posicion')
        salario_asignado = validated_data.pop('salario_asignado')
        fecha_inicio = validated_data.pop('fecha_inicio')

        empleado = Empleado.objects.create(**validated_data)
        EmpleadoPosicion.objects.create(
            empleado=empleado, posicion=posicion, salario_asignado=salario_asignado,
            fecha_inicio=fecha_inicio, motivo_cambio='contratacion',
        )
        return empleado


class EmpleadoSerializer(serializers.ModelSerializer):
    """`fotografia` se sirve desde un storage propio (ver `models.py`), no
    desde `MEDIA_ROOT`/`MEDIA_URL` — DRF resuelve la URL absoluta igual,
    `ImageField.storage.base_url` es transparente para el serializer.
    """

    class Meta:
        model = Empleado
        fields = [
            'id', 'nombre_completo', 'curp', 'rfc', 'nss', 'telefono', 'email',
            'fotografia', 'cuenta_bancaria', 'activo',
        ]
        read_only_fields = ['id', 'activo']


class EmpleadoPosicionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpleadoPosicion
        fields = [
            'id', 'empleado', 'posicion', 'salario_asignado',
            'fecha_inicio', 'fecha_termino', 'motivo_cambio',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        posicion = attrs.get('posicion', getattr(self.instance, 'posicion', None))
        salario = attrs.get('salario_asignado', getattr(self.instance, 'salario_asignado', None))

        if posicion is not None and salario is not None and not (
            posicion.salario_minimo <= salario <= posicion.salario_maximo
        ):
            raise serializers.ValidationError({
                'salario_asignado': (
                    f'El salario asignado debe estar entre {posicion.salario_minimo} y '
                    f'{posicion.salario_maximo} para la posición "{posicion.titulo_posicion}".'
                ),
            })

        fecha_inicio = attrs.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fecha_termino = attrs.get('fecha_termino', getattr(self.instance, 'fecha_termino', None))
        if fecha_inicio and fecha_termino and fecha_termino < fecha_inicio:
            raise serializers.ValidationError({
                'fecha_termino': 'La fecha de término no puede ser anterior a la fecha de inicio.',
            })

        return attrs


class ContactoEmergenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactoEmergencia
        fields = ['id', 'empleado', 'nombre_contacto', 'telefono', 'parentesco']
        read_only_fields = ['id']


class DependienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dependiente
        fields = ['id', 'empleado', 'nombre_dependiente', 'parentesco']
        read_only_fields = ['id']


class SolicitudNominaSerializer(serializers.ModelSerializer):
<<<<<<< HEAD
    """`estado`/`fecha_resolucion`/`resuelto_por` son de solo lectura aquí —
    solo cambian a través de las acciones `aprobar`/`rechazar` del ViewSet,
    nunca directo por PATCH, para no perder el rastro de quién resolvió.
    """

    class Meta:
        model = SolicitudNomina
        fields = [
            'id', 'empleado', 'periodo_inicio', 'periodo_fin', 'monto',
            'estado', 'fecha_solicitud', 'fecha_resolucion', 'resuelto_por',
        ]
        read_only_fields = ['id', 'estado', 'fecha_solicitud', 'fecha_resolucion', 'resuelto_por']

    def validate(self, attrs):
=======
    """El estado y los datos de pago, rechazo y reverso son de solo lectura:
    cambian únicamente por las acciones del ViewSet (`aprobar`, `pagar-lote`,
    `rechazar`, `revertir`), que pasan por `services/nomina.py`. Al editar
    una solicitud (solo pendiente, lo verifica la vista) únicamente cambia
    el monto; empleado y periodo se fijan al crearla.
    """

    empleado_nombre = serializers.CharField(source='empleado.nombre_completo', read_only=True)
    empleado_foto = serializers.ImageField(source='empleado.fotografia', read_only=True)
    posicion_nombre = serializers.SerializerMethodField()
    resuelto_por_nombre = serializers.SerializerMethodField()
    revertido_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudNomina
        fields = [
            'id', 'empleado', 'empleado_nombre', 'empleado_foto', 'posicion_nombre',
            'periodo_inicio', 'periodo_fin', 'monto', 'estado', 'fecha_solicitud',
            'fecha_resolucion', 'resuelto_por', 'resuelto_por_nombre',
            'movimiento_pago', 'movimiento_reverso', 'motivo_reverso', 'fecha_reverso',
            'revertido_por', 'revertido_por_nombre',
        ]
        read_only_fields = [
            'id', 'estado', 'fecha_solicitud', 'fecha_resolucion', 'resuelto_por',
            'movimiento_pago', 'movimiento_reverso', 'motivo_reverso', 'fecha_reverso', 'revertido_por',
        ]

    def get_fields(self):
        campos = super().get_fields()
        if self.instance is not None and not isinstance(self.instance, (list, tuple)):
            for nombre in ('empleado', 'periodo_inicio', 'periodo_fin'):
                campos[nombre].read_only = True
        return campos

    def get_posicion_nombre(self, solicitud):
        # `asignaciones_vigentes` lo precarga el ViewSet; sin él, una consulta.
        vigentes = getattr(solicitud.empleado, 'asignaciones_vigentes', None)
        if vigentes is None:
            vigentes = list(
                solicitud.empleado.asignaciones.filter(fecha_termino__isnull=True)
                .select_related('posicion').order_by('-fecha_inicio'),
            )
        return vigentes[0].posicion.titulo_posicion if vigentes else None

    def get_resuelto_por_nombre(self, solicitud):
        return solicitud.resuelto_por.nombre_mostrado() if solicitud.resuelto_por else None

    def get_revertido_por_nombre(self, solicitud):
        return solicitud.revertido_por.nombre_mostrado() if solicitud.revertido_por else None

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor que cero.')
        return value

    def validate(self, attrs):
        from .services.nomina import solicitudes_que_ocupan

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
        inicio = attrs.get('periodo_inicio', getattr(self.instance, 'periodo_inicio', None))
        fin = attrs.get('periodo_fin', getattr(self.instance, 'periodo_fin', None))

        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({
                'periodo_fin': 'El fin del periodo no puede ser anterior a su inicio.',
            })

<<<<<<< HEAD
        return attrs
=======
        empleado = attrs.get('empleado', getattr(self.instance, 'empleado', None))
        if empleado and inicio and fin:
            duplicada = solicitudes_que_ocupan(
                empleado.id, inicio, fin, excluir_id=getattr(self.instance, 'pk', None),
            ).first()
            if duplicada:
                raise serializers.ValidationError({
                    'periodo_inicio': (
                        f'Este empleado ya tiene una solicitud de nómina (#{duplicada.id}) '
                        'para un periodo que se traslapa con este.'
                    ),
                })

        return attrs


class GenerarNominaSerializer(serializers.Serializer):
    """Entrada de "Generar nómina": quincena 1 (1–15) o 2 (16–fin de mes)."""

    anio = serializers.IntegerField(min_value=2000, max_value=2100)
    mes = serializers.IntegerField(min_value=1, max_value=12)
    quincena = serializers.ChoiceField(choices=[1, 2])


class PagarLoteNominaSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)


class RevertirPagoNominaSerializer(serializers.Serializer):
    motivo = serializers.CharField(allow_blank=False, trim_whitespace=True)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
