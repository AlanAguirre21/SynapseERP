"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.usuarios.views import (
    CambiarContrasenaView,
    LoginView,
    SolicitarRecuperacionView,
    VerificarCodigoView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/recuperar/', SolicitarRecuperacionView.as_view(), name='auth-recuperar'),
    path(
        'api/auth/verificar-codigo/',
        VerificarCodigoView.as_view(),
        name='auth-verificar-codigo',
    ),
    path(
        'api/auth/cambiar-contrasena/',
        CambiarContrasenaView.as_view(),
        name='auth-cambiar-contrasena',
    ),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/usuarios/', include('apps.usuarios.urls')),
    path('api/inventario/', include('apps.inventario.urls')),
    path('api/sucursales/', include('apps.sucursales.urls')),
    path('api/catalogo/', include('apps.catalogo.urls')),
    path('api/personas/', include('apps.personas.urls')),
    path('api/compras/', include('apps.compras.urls')),
    path('api/ventas/', include('apps.ventas.urls')),
    path('api/produccion/', include('apps.produccion.urls')),
    path('api/caja/', include('apps.caja.urls')),
]
