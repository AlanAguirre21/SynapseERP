"""Cifrado/descifrado simétrico de la `api_key` del PAC (feature 016).

Cifrado manual con `cryptography.fernet` en vez de `django-cryptography`
(que internamente también depende de `cryptography`) — evita sumar una
dependencia extra para un solo campo, consistente con "simplicidad sobre
escalabilidad prematura" (`constitution/tech-stack.md`). La clave vive en
`settings.FISCAL_ENCRYPTION_KEY` (variable de entorno, `.env` — nunca
comiteada), igual que `SECRET_KEY`.
"""

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet():
    return Fernet(settings.FISCAL_ENCRYPTION_KEY.encode())


def cifrar(valor: str) -> str:
    return _fernet().encrypt(valor.encode()).decode()


def descifrar(valor_cifrado: str) -> str:
    return _fernet().decrypt(valor_cifrado.encode()).decode()
