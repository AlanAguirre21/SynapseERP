#!/bin/sh
# Pasos de despliegue antes de levantar el servidor: migraciones y, después,
# el índice de frases del asistente (024), que se reconstruye en cada arranque.
set -e

python manage.py migrate --noinput
python manage.py indexar_intenciones

exec "$@"
