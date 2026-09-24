"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.usuarios.views import (
    CambiarContrasenaView,
    LoginView,
    LogoutView,
    SolicitarRecuperacionView,
    VerificarCodigoView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
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
    path('api/terceros/', include('apps.terceros.urls')),
    path('api/rrhh/', include('apps.rrhh.urls')),
    path('api/compras/', include('apps.compras.urls')),
    path('api/ventas/', include('apps.ventas.urls')),
    path('api/produccion/', include('apps.produccion.urls')),
    path('api/caja/', include('apps.caja.urls')),
    path('api/reportes/', include('apps.reportes.urls')),
    path('api/configuracion-fiscal/', include('apps.configuracion_fiscal.urls')),
    path('api/facturacion/', include('apps.facturacion.urls')),
    path('api/contabilidad/', include('apps.contabilidad.urls')),
]

if settings.DEBUG:
    # Solo las fotografías de empleado (008 · RRHH) — nunca `MEDIA_URL`/
    # `MEDIA_ROOT` en sí, que guardan los XML/PDF de Facturación y deben
    # seguir sin una URL pública (ver nota en `config/settings.py`).
    urlpatterns += static(settings.EMPLEADOS_FOTOS_URL, document_root=settings.EMPLEADOS_FOTOS_ROOT)
