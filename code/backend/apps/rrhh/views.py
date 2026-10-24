from django.db import transaction
<<<<<<< HEAD
=======
from django.db.models import Prefetch
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

<<<<<<< HEAD
from core.permissions import EsAdmin

from .models import (
=======
from apps.caja.services import SaldoInsuficienteError
from core.permissions import EsAdmin

from .models import (
    ESTADO_NOMINA_PENDIENTE,
    ESTADO_NOMINA_RECHAZADO,
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
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
<<<<<<< HEAD
    PosicionSerializer,
    SolicitudNominaSerializer,
)
=======
    GenerarNominaSerializer,
    PagarLoteNominaSerializer,
    PosicionSerializer,
    RevertirPagoNominaSerializer,
    SolicitudNominaSerializer,
)
from .services.nomina import (
    ErrorNomina,
    generar_nomina,
    pagar_solicitudes,
    revertir_pago,
)
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b

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

    def get_queryset(self):
        """`?disponible=true` filtra a empleados activos sin cuenta de
        usuario vinculada — usado por el selector de empleado del alta de
        `010 · Usuarios` (relación 1:1, ver `Usuario.empleado`)."""
        queryset = Empleado.objects.all().order_by('nombre_completo')
        if self.request.query_params.get('disponible') == 'true':
            queryset = queryset.filter(activo=True, usuario__isnull=True)
        return queryset

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

        # Cascada (spec.md, criterio agregado por 010 · Usuarios): si el
        # empleado tiene una cuenta de Usuario vinculada (1:1 desde 010), se
        # desactiva también, en la misma transacción — evita que conserve
        # acceso al sistema. El descriptor inverso de un `OneToOneField` sin
        # fila relacionada lanza `RelatedObjectDoesNotExist` (subclase de
        # `AttributeError`), por eso `getattr(instance, 'usuario', None)` en
        # vez de acceder directo.
        cuenta_vinculada = getattr(instance, 'usuario', None)
        if cuenta_vinculada and cuenta_vinculada.is_active:
            cuenta_vinculada.is_active = False
            cuenta_vinculada.save(update_fields=['is_active'])

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
<<<<<<< HEAD
    """`aprobar`/`rechazar` son las únicas formas de tocar `estado` — ver
    nota en `SolicitudNominaSerializer`. No genera movimientos de caja
    (spec.md, "Fuera de alcance"): es un registro informativo con
    historial de aprobación.
    """

    queryset = SolicitudNomina.objects.select_related('empleado', 'resuelto_por').all()
=======
    """Nómina con pago en caja (`spec.md`, "Actualización: nómina con pago en
    caja"). `aprobar` aprueba **y paga**: registra el retiro de Caja en la
    misma transacción. Toda la lógica de pago, pago en bloque y reverso vive
    en `services/nomina.py`; aquí solo se traducen sus errores a
    `{"detail": ...}`. Exclusivo de admin, como todo RRHH.
    """

>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
    serializer_class = SolicitudNominaSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
<<<<<<< HEAD
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
=======
        queryset = (
            SolicitudNomina.objects.select_related('empleado', 'resuelto_por', 'revertido_por')
            .prefetch_related(Prefetch(
                'empleado__asignaciones',
                queryset=EmpleadoPosicion.objects.filter(fecha_termino__isnull=True)
                .select_related('posicion').order_by('-fecha_inicio'),
                to_attr='asignaciones_vigentes',
            ))
            .all()
        )
        parametros = self.request.query_params
        if parametros.get('estado'):
            queryset = queryset.filter(estado=parametros['estado'])
        if parametros.get('empleado'):
            queryset = queryset.filter(empleado_id=parametros['empleado'])
        # Periodo: solicitudes que se traslapan con [periodo_inicio, periodo_fin].
        if parametros.get('periodo_inicio'):
            queryset = queryset.filter(periodo_fin__gte=parametros['periodo_inicio'])
        if parametros.get('periodo_fin'):
            queryset = queryset.filter(periodo_inicio__lte=parametros['periodo_fin'])
        return queryset

    @staticmethod
    def _error(mensaje):
        return Response({'detail': mensaje}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        if self.get_object().estado != ESTADO_NOMINA_PENDIENTE:
            return self._error('Solo se puede editar una solicitud de nómina pendiente.')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # Una solicitud resuelta es parte del historial (y puede tener
        # movimientos de caja ligados): solo se borra si sigue pendiente.
        if self.get_object().estado != ESTADO_NOMINA_PENDIENTE:
            return self._error('Solo se puede eliminar una solicitud de nómina pendiente.')
        return super().destroy(request, *args, **kwargs)

    def _datos(self, solicitudes):
        refrescadas = self.get_queryset().filter(pk__in=[s.pk for s in solicitudes]).order_by('id')
        return self.get_serializer(refrescadas, many=True).data

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        solicitud = self.get_object()
        try:
            pagar_solicitudes([solicitud.pk], request.user)
        except (ErrorNomina, SaldoInsuficienteError) as error:
            return self._error(str(error))
        return Response(self._datos([solicitud])[0])

    @action(detail=False, methods=['post'], url_path='pagar-lote')
    def pagar_lote(self, request):
        entrada = PagarLoteNominaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            pagadas = pagar_solicitudes(entrada.validated_data['ids'], request.user)
        except (ErrorNomina, SaldoInsuficienteError) as error:
            return self._error(str(error))
        return Response(self._datos(pagadas))

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        with transaction.atomic():
            solicitud = SolicitudNomina.objects.select_for_update().get(pk=self.get_object().pk)
            if solicitud.estado != ESTADO_NOMINA_PENDIENTE:
                return self._error(
                    f'Esta solicitud ya fue {solicitud.get_estado_display().lower()}, no se puede volver a resolver.',
                )
            solicitud.estado = ESTADO_NOMINA_RECHAZADO
            solicitud.fecha_resolucion = timezone.now()
            solicitud.resuelto_por = request.user
            solicitud.save(update_fields=['estado', 'fecha_resolucion', 'resuelto_por'])
        return Response(self._datos([solicitud])[0])

    @action(detail=True, methods=['post'])
    def revertir(self, request, pk=None):
        solicitud = self.get_object()
        entrada = RevertirPagoNominaSerializer(data=request.data)
        if not entrada.is_valid():
            return self._error('Indica el motivo del reverso.')
        try:
            revertir_pago(solicitud.pk, entrada.validated_data['motivo'], request.user)
        except (ErrorNomina, SaldoInsuficienteError) as error:
            return self._error(str(error))
        return Response(self._datos([solicitud])[0])

    @action(detail=False, methods=['post'])
    def generar(self, request):
        entrada = GenerarNominaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        creadas, omitidas = generar_nomina(**entrada.validated_data)
        return Response(
            {
                'creadas': self._datos(creadas) if creadas else [],
                'omitidas': [
                    {'empleado': empleado.id, 'empleado_nombre': empleado.nombre_completo, 'motivo': motivo}
                    for empleado, motivo in omitidas
                ],
            },
            status=status.HTTP_201_CREATED,
        )
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
