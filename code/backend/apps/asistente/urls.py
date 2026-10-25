from django.urls import path

from .views import ConversacionesView, MensajesView, MenuView, RegistroView

urlpatterns = [
    path('conversaciones/', ConversacionesView.as_view(), name='asistente-conversaciones'),
    path('conversaciones/<int:conversacion_id>/mensajes/', MensajesView.as_view(), name='asistente-mensajes'),
    path('menu/', MenuView.as_view(), name='asistente-menu'),
    path('registro/', RegistroView.as_view(), name='asistente-registro'),
]
