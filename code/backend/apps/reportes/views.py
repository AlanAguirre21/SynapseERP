from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ResumenDashboardSerializer
from .services import PERIODO_DIA, PERIODOS_VALIDOS, calcular_resumen


class ResumenDashboardView(APIView):
    """GET /api/reportes/resumen/?periodo=dia|semana|mes — feature
    014 · Dashboard. Abierta a cualquier usuario autenticado, sin
    restricción de rol (pantalla de entrada general del sistema).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodo = request.query_params.get('periodo', PERIODO_DIA)
        if periodo not in PERIODOS_VALIDOS:
            raise ValidationError({'periodo': f'Debe ser uno de: {", ".join(PERIODOS_VALIDOS)}.'})

        resumen = calcular_resumen(periodo)
        return Response(ResumenDashboardSerializer(resumen).data)
