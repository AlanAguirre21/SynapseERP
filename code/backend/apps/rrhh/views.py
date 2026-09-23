from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import EsAdmin

from .models import (
    MOTIVOS_CAMBIO,
    ContactoEmergencia,
    Departamento,
    Dependiente,
    Empleado,
    EmpleadoPosicion,
    Posicion,
    SolicitudNomina,
)
from .serializers import (
    ContactoEmergenciaSerializer,
    ContratarEmpleadoSerializer,
    DepartamentoSerializer,
    DependienteSerializer,
    EmpleadoPosicionSerializer,
    EmpleadoSerializer,
    PosicionSerializer,
    SolicitudNominaSerializer,
)

# Admin-only en todo RRHH (7 ViewSets): a diferencia del patrón estándar de
# catálogo (LecturaParaTodosEscrituraSoloAdmin), aquí el operador no debe
# tener ni lectura — mismo criterio ya aplicado a Caja/Contabilidad/
# Configuración Fiscal.


class DepartamentoViewSet(viewsets.ModelViewSet):
    """CRUD de departamentos. Jerarquía por `departamento_padre`, construida
    del lado del frontend a partir de la lista completa — el árbol de
    departamentos de una empresa es lo bastante chico para no justificar
    una consulta recursiva en el backend.
    """

    queryset = Departamento.objects.all().order_by('nombre_departamento')
    serializer_class = DepartamentoSerializer
    permission_classes = [EsAdmin]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        departamento = self.get_object()

        if departamento.activo:
            return Response({'detail': 'El departamento ya está activo.'}, status=400)

        departamento.activo = True
        departamento.save(update_fields=['activo'])

        return Response(self.get_serializer(departamento).data)


class PosicionViewSet(viewsets.ModelViewSet):
    """CRUD de posiciones. Igual que Departamento, la jerarquía por
    `reporta_a` se construye en el frontend a partir de la lista ya
    filtrada por departamento (`?departamento=<id>`).
    """

    queryset = Posicion.objects.select_related('departamento', 'reporta_a').all().order_by('titulo_posicion')
    serializer_class = PosicionSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        departamento_id = self.request.query_params.get('departamento')
        return queryset.filter(departamento_id=departamento_id) if departamento_id else queryset

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        posicion = self.get_object()

        if posicion.activo:
            return Response({'detail': 'La posición ya está activa.'}, status=400)

        posicion.activo = True
        posicion.save(update_fields=['activo'])

        return Response(self.get_serializer(posicion).data)


class EmpleadoViewSet(viewsets.ModelViewSet):
    """CRUD de empleados. Movido desde `apps.personas` (feature 008)."""

    queryset = Empleado.objects.all().order_by('nombre_completo')
    serializer_class = EmpleadoSerializer
    permission_classes = [EsAdmin]

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def contratar(self, request):
        """Alta combinada de `Empleado` + su primera `EmpleadoPosicion` en
        una sola transacción — ver `ContratarEmpleadoSerializer`. El flujo
        "Nuevo empleado" del frontend (dentro de una posición) usa este
        endpoint en vez de dos peticiones separadas, para no dejar un
        `Empleado` huérfano si la asignación falla por rango salarial.
        """
        serializer = ContratarEmpleadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        empleado = serializer.save()
        return Response(EmpleadoSerializer(empleado).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_destroy(self, instance):
        # Idempotente, mismo patrón que Sucursal (006): desactivar a un
        # empleado ya inactivo no debe reabrir ni tocar su historial.
        if not instance.activo:
            return

        asignacion_vigente = (
            instance.asignaciones.select_for_update().filter(fecha_termino__isnull=True).first()
        )

        if asignacion_vigente:
            motivo_cambio = self.request.data.get('motivo_cambio')
            if motivo_cambio not in dict(MOTIVOS_CAMBIO):
                raise ValidationError({
                    'motivo_cambio': (
                        'Debes indicar un motivo_cambio válido (ej. "despido" o "renuncia") para '
                        'desactivar a un empleado con una posición vigente.'
                    ),
                })
            asignacion_vigente.fecha_termino = timezone.now().date()
            asignacion_vigente.motivo_cambio = motivo_cambio
            asignacion_vigente.save(update_fields=['fecha_termino', 'motivo_cambio'])

        instance.activo = False
        instance.save(update_fields=['activo'])

        # Cascada (ver spec.md, criterio agregado por 010 · Usuarios): si el
        # empleado tiene una cuenta de Usuario vinculada, se desactiva
        # también, en la misma transacción — evita que conserve acceso al
        # sistema. `usuarios` es hoy un FK (podría haber más de una cuenta;
        # se convierte a 1:1 cuando 010 implemente esa relación), así que se
        # desactivan todas por seguridad, no solo "la primera".
        instance.usuarios.filter(is_active=True).update(is_active=False)

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        empleado = self.get_object()

        if empleado.activo:
            return Response({'detail': 'El empleado ya está activo.'}, status=400)

        empleado.activo = True
        empleado.save(update_fields=['activo'])

        return Response(self.get_serializer(empleado).data)


class EmpleadoPosicionViewSet(viewsets.ModelViewSet):
    """CRUD del historial de asignaciones. A diferencia de Empleado/
    Departamento/Posicion no tiene `activo`: el spec lo describe como CRUD
    pleno (permite corregir o borrar un registro mal capturado), no como
    ledger insert-only — ese patrón queda reservado a MovimientosCaja/
    MovimientosInventario (ver `constitution/tech-stack.md`).
    """

    queryset = EmpleadoPosicion.objects.select_related('empleado', 'posicion').all()
    serializer_class = EmpleadoPosicionSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        posicion_id = self.request.query_params.get('posicion')
        empleado_id = self.request.query_params.get('empleado')
        vigente = self.request.query_params.get('vigente')

        if posicion_id:
            queryset = queryset.filter(posicion_id=posicion_id)
        if empleado_id:
            queryset = queryset.filter(empleado_id=empleado_id)
        if vigente is not None:
            queryset = queryset.filter(fecha_termino__isnull=(vigente.lower() == 'true'))

        if posicion_id and vigente is not None:
            # "Empleados que desempeñan esa posición ahora mismo" (spec):
            # se ordenan por antigüedad en el puesto (fecha_inicio
            # ascendente) como interpretación de "mayor jerarquía primero"
            # — Posicion no tiene un campo de jerarquía por empleado
            # individual, solo por puesto, así que la antigüedad en el rol
            # es el criterio de desempate más razonable entre pares.
            queryset = queryset.order_by('fecha_inicio')

        return queryset


class ContactoEmergenciaViewSet(viewsets.ModelViewSet):
    queryset = ContactoEmergencia.objects.select_related('empleado').all()
    serializer_class = ContactoEmergenciaSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        empleado_id = self.request.query_params.get('empleado')
        return queryset.filter(empleado_id=empleado_id) if empleado_id else queryset


class DependienteViewSet(viewsets.ModelViewSet):
    queryset = Dependiente.objects.select_related('empleado').all()
    serializer_class = DependienteSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        empleado_id = self.request.query_params.get('empleado')
        return queryset.filter(empleado_id=empleado_id) if empleado_id else queryset


class SolicitudNominaViewSet(viewsets.ModelViewSet):
    """`aprobar`/`rechazar` son las únicas formas de tocar `estado` — ver
    nota en `SolicitudNominaSerializer`. No genera movimientos de caja
    (spec.md, "Fuera de alcance"): es un registro informativo con
    historial de aprobación.
    """

    queryset = SolicitudNomina.objects.select_related('empleado', 'resuelto_por').all()
    serializer_class = SolicitudNominaSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        estado = self.request.query_params.get('estado')
        return queryset.filter(estado=estado) if estado else queryset

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        return self._resolver(request, 'aprobado')

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        return self._resolver(request, 'rechazado')

    def _resolver(self, request, nuevo_estado):
        solicitud = self.get_object()

        if solicitud.estado != 'pendiente':
            return Response(
                {
                    'detail': (
                        f'Esta solicitud ya fue {solicitud.get_estado_display().lower()}, '
                        'no se puede volver a resolver.'
                    ),
                },
                status=400,
            )

        solicitud.estado = nuevo_estado
        solicitud.fecha_resolucion = timezone.now()
        solicitud.resuelto_por = request.user
        solicitud.save(update_fields=['estado', 'fecha_resolucion', 'resuelto_por'])

        return Response(self.get_serializer(solicitud).data)
