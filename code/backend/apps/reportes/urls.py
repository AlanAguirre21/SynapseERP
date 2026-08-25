from django.urls import path

from .views import ResumenDashboardView

urlpatterns = [
    path('resumen/', ResumenDashboardView.as_view(), name='reportes-resumen'),
]
