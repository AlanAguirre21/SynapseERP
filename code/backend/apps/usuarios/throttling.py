from rest_framework.throttling import SimpleRateThrottle


class ThrottlePorCorreoDestino(SimpleRateThrottle):
    """Limita por el correo destino en el cuerpo de la petición, no por IP.

    Un atacante puede rotar IPs fácilmente; limitar por correo evita que se
    sature la bandeja de un usuario específico sin importar el origen.
    """

    def get_cache_key(self, request, view):
        email = str(request.data.get('email', '')).strip().lower()
        if not email:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': email}


class ThrottleRecuperarPassword(ThrottlePorCorreoDestino):
    scope = 'recuperar_password'


class ThrottleVerificarCodigo(ThrottlePorCorreoDestino):
    scope = 'verificar_codigo'
