"""Capa de comunicación con el PAC (Proveedor Autorizado de Certificación)
— feature `017 · Facturación`. Aislada del resto del sistema (vistas,
modelos, frontend) a propósito: si la empresa cambia de proveedor de PAC,
solo se reescribe este archivo (ver `plan.md`, sección Decisiones).

Ningún método lanza una excepción por un rechazo esperado del PAC (datos
inválidos, servicio no disponible, credenciales incorrectas, etc.) —
siempre devuelve un diccionario normalizado `{'exito': bool, ...}` para
que la vista decida el estado de la `Factura` sin try/except adicional.
Las vistas mockean esta clase en los tests (no hay un PAC real
configurado en desarrollo).
"""

import requests
from requests.exceptions import RequestException

from apps.configuracion_fiscal.crypto import descifrar
from apps.configuracion_fiscal.models import ConfiguracionPAC

TIMEOUT_SEGUNDOS = 15


class ConfiguracionPACIncompletaError(Exception):
    """La conexión al PAC (`016 · Configuración Fiscal`) no está lista."""


class PACClient:
    def __init__(self):
        self._configuracion = None

    def _config(self):
        if self._configuracion is None:
            configuracion = ConfiguracionPAC.cargar()
            if not configuracion.esta_completa():
                raise ConfiguracionPACIncompletaError(
                    'La conexión al PAC no está configurada — revisa 016 · Configuración Fiscal.',
                )
            self._configuracion = configuracion
        return self._configuracion

    def _cabeceras(self):
        api_key = descifrar(self._config().api_key_cifrada)
        return {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}

    def _post(self, ruta, payload):
        endpoint = self._config().api_endpoint.rstrip('/')
        try:
            respuesta = requests.post(
                f'{endpoint}/{ruta}', json=payload, headers=self._cabeceras(), timeout=TIMEOUT_SEGUNDOS,
            )
        except RequestException as exc:
            return {'exito': False, 'error': f'No se pudo conectar con el PAC: {exc}'}

        if respuesta.status_code != 200:
            detalle = respuesta.text[:500] if respuesta.text else f'El PAC respondió con estado {respuesta.status_code}.'
            return {'exito': False, 'error': detalle}

        try:
            datos = respuesta.json()
        except ValueError:
            return {'exito': False, 'error': 'El PAC devolvió una respuesta que no es JSON válido.'}

        datos['exito'] = True
        return datos

    def _intentar(self, ruta, payload):
        try:
            return self._post(ruta, payload)
        except ConfiguracionPACIncompletaError as exc:
            return {'exito': False, 'error': str(exc)}

    def timbrar(self, datos_cfdi):
        return self._intentar('timbrar', datos_cfdi)

    def cancelar(self, folio_fiscal, motivo):
        return self._intentar('cancelar', {'folio_fiscal': folio_fiscal, 'motivo': motivo})

    def timbrar_complemento_pago(self, datos):
        return self._intentar('timbrar-complemento-pago', datos)
