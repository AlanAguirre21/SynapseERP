from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.response import Response

from core.permissions import EsAdmin

from .models import ConfiguracionPAC, DatosFiscalesEmpresa, SerieFolio
from .serializers import (
    ConfiguracionPACSerializer,
    DatosFiscalesEmpresaSerializer,
    SerieFolioSerializer,
)


class DatosFiscalesEmpresaView(RetrieveUpdateAPIView):
    """GET/PATCH — fila única de datos fiscales de la empresa. Restringido
    a admin en su totalidad (ni siquiera lectura para operador) — a
    diferencia de Catálogo/Sucursales, esta configuración es sensible y
    exclusiva de admin, según lo define `spec.md` de esta feature.
    """

    serializer_class = DatosFiscalesEmpresaSerializer
    permission_classes = [EsAdmin]

    def get_object(self):
        return DatosFiscalesEmpresa.cargar()


class ConfiguracionPACView(RetrieveUpdateAPIView):
    """GET/PATCH — fila única de conexión al PAC. `api_key` nunca se
    devuelve en la respuesta de lectura (ver `ConfiguracionPACSerializer`).
    """

    serializer_class = ConfiguracionPACSerializer
    permission_classes = [EsAdmin]

    def get_object(self):
        return ConfiguracionPAC.cargar()


class SerieFolioViewSet(viewsets.ModelViewSet):
    """CRUD del catálogo de series de facturación. Restringido a admin en
    su totalidad. `perform_destroy` nunca borra físicamente — mismo patrón
    reutilizable de `activo` que Categoria/Producto/MateriaPrima/Sucursal:
    una serie con folios ya usados (o sin usar) solo se desactiva, jamás
    se elimina de verdad, satisfaciendo el criterio de aceptación sin
    necesitar una validación condicional aparte.
    """

    queryset = SerieFolio.objects.all()
    serializer_class = SerieFolioSerializer
    permission_classes = [EsAdmin]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        serie = self.get_object()

        if serie.activo:
            return Response({'detail': 'La serie ya está activa.'}, status=400)

        serie.activo = True
        serie.save(update_fields=['activo'])

        return Response(self.get_serializer(serie).data)
