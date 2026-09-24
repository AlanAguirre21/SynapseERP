"""Utilidades compartidas para la generación de PDF con xhtml2pdf.

xhtml2pdf no resuelve por sí solo las URL que produce `{% static %}`
(`/static/...`): necesita una ruta absoluta en disco. `resolver_ruta_estatica`
es el `link_callback` que hace esa traducción, para que las plantillas sigan
usando `{% static %}` en vez de rutas relativas frágiles.
"""

import os

from django.conf import settings
from django.contrib.staticfiles import finders


def resolver_ruta_estatica(uri, rel):
    """Traduce una URL de `STATIC_URL`/`MEDIA_URL` a su ruta absoluta en disco.

    Devuelve la `uri` sin tocar si es remota (http/https), un `data:` URI, o si
    el archivo no se encuentra — así una imagen faltante no rompe la generación
    completa del PDF, solo se omite.
    """

    if uri.startswith(('http://', 'https://', 'data:', 'file:')):
        return uri

    static_url = settings.STATIC_URL or ''
    media_url = settings.MEDIA_URL or ''

    if static_url and uri.startswith(static_url):
        ruta_relativa = uri[len(static_url):]
        # En desarrollo los estáticos viven en cada app; en producción, ya
        # recolectados en STATIC_ROOT. Se intentan ambos.
        ruta = finders.find(ruta_relativa)
        if not ruta and getattr(settings, 'STATIC_ROOT', None):
            ruta = os.path.join(settings.STATIC_ROOT, ruta_relativa)
    elif media_url and uri.startswith(media_url):
        ruta = os.path.join(settings.MEDIA_ROOT, uri[len(media_url):])
    else:
        return uri

    if ruta and os.path.isfile(ruta):
        return os.path.normpath(ruta)
    return uri
