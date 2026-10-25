# Imagen del backend de SynapseERP (Django + Gunicorn).
#
#   docker build -t synapse-backend code/backend
#
# El modelo de embeddings del asistente (024) se descarga aquí, en el build,
# para que ninguna petición de usuario lo descargue en tiempo de ejecución.
# Al arrancar, `docker-entrypoint.sh` corre `migrate` y luego
# `indexar_intenciones` antes de levantar Gunicorn.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dependencias de sistema para compilar pycairo (requerido por xhtml2pdf, PDFs).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Modelo de embeddings del asistente (024): mismas variables que lee `settings.py`.
ARG ASISTENTE_MODELO_EMBEDDINGS=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
ENV ASISTENTE_MODELO_EMBEDDINGS=${ASISTENTE_MODELO_EMBEDDINGS} \
    ASISTENTE_CACHE_MODELOS=/opt/modelos_embeddings
RUN python -c "import os; from fastembed import TextEmbedding; \
TextEmbedding(os.environ['ASISTENTE_MODELO_EMBEDDINGS'], cache_dir=os.environ['ASISTENTE_CACHE_MODELOS'])"

COPY . .
# `sed`: por si el checkout en Windows dejó finales de línea CRLF.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh \
    && useradd --system --create-home synapse \
    && mkdir -p media media_rrhh media_usuarios \
    && chown -R synapse:synapse /app /opt/modelos_embeddings

USER synapse

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]
