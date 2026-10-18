from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

# Fotografía de perfil (017 · Información de Usuario / 010 · Usuarios). Una
# sola definición para los dos serializers que escriben `foto_usuario`, para
# que ambos caminos acepten exactamente los mismos archivos.
TAMANO_MAXIMO_FOTO = 2 * 1024 * 1024
FORMATOS_FOTO = {'JPEG', 'PNG', 'WEBP'}

MENSAJE_FORMATO_FOTO = 'La fotografía debe ser JPG, PNG o WebP.'
MENSAJE_TAMANO_FOTO = 'La fotografía no puede pesar más de 2 MB.'


def validar_foto_usuario(archivo):
    if archivo.size > TAMANO_MAXIMO_FOTO:
        raise serializers.ValidationError(MENSAJE_TAMANO_FOTO)

    # Por contenido, no por extensión: `ImageField` ya rechaza lo que no es
    # una imagen, pero acepta cualquier formato que Pillow sepa leer.
    try:
        archivo.seek(0)
        formato = Image.open(archivo).format
    except (UnidentifiedImageError, OSError) as exc:
        raise serializers.ValidationError(MENSAJE_FORMATO_FOTO) from exc
    finally:
        archivo.seek(0)

    if formato not in FORMATOS_FOTO:
        raise serializers.ValidationError(MENSAJE_FORMATO_FOTO)
