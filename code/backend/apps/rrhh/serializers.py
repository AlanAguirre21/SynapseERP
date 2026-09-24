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
        inicio = attrs.get('periodo_inicio', getattr(self.instance, 'periodo_inicio', None))
        fin = attrs.get('periodo_fin', getattr(self.instance, 'periodo_fin', None))

        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({
                'periodo_fin': 'El fin del periodo no puede ser anterior a su inicio.',
            })

        return attrs
