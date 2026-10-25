# SynapseERP — Enterprise Manager

Aplicación web interna para la gestión de la empresa **SynapseERP**: ventas, compras, producción, inventario por sucursal, caja, facturación electrónica (CFDI 4.0), contabilidad básica, recursos humanos, auditoría automatizada, pronósticos y un asistente conversacional.

Es un sistema de uso exclusivo de la empresa (no multiempresa, sin acceso público ni registro abierto) con dos roles: **admin** y **operador**.

## Principios

- **Trazabilidad total**: los movimientos de caja e inventario son *insert-only*; las correcciones se registran como movimientos inversos.
- **El backend es la única fuente de verdad de permisos**: el frontend solo oculta opciones, la API hace cumplir cada regla de rol.
- **Precisión financiera**: todo monto o cantidad de inventario usa `Decimal`, nunca `float`.
- **La sucursal es una dimensión de inventario**: ganancias, caja y personal son globales a la empresa.
- **Simplicidad sobre escalabilidad prematura**: un solo mantenedor a largo plazo.

El detalle está en [`spec/constitution/mission.md`](spec/constitution/mission.md) y [`spec/constitution/tech-stack.md`](spec/constitution/tech-stack.md).

## Módulos

| Módulo | Roles | Descripción |
|---|---|---|
| Dashboard | Ambos | Resumen de ventas, compras y ganancias (cifras propias para el operador). |
| Ventas / Compras | Ambos | Cabecera-detalle con precio o costo congelado; afectan stock y caja de forma atómica. |
| Producción | Ambos | Recetas (solo admin) y producciones que consumen materia prima y generan producto. |
| Inventario | Ambos | Stock por sucursal, historial de movimientos y traslados entre sucursales. |
| Catálogo | Ambos | Productos, materia prima y categorías. |
| Terceros | Ambos | Clientes, proveedores y datos fiscales. |
| Sucursales | Ambos | Ubicaciones de inventario (escritura solo admin). |
| Facturación | Ambos | CFDI 4.0 timbrados mediante un PAC externo. |
| Auditoría y análisis | Ambos* | Conciliación de caja, auditoría de inventario, conteos físicos, pronósticos y registro del asistente. *El operador solo usa *Conteos físicos*. |
| Caja | Admin | Movimientos de caja globales. |
| RRHH | Admin | Empleados, departamentos, posiciones y solicitudes de nómina. |
| Usuarios | Admin | Cuentas de acceso e historial de accesos. |
| Contabilidad | Admin | Catálogo de cuentas, libro diario y balance de comprobación. |
| Configuración Fiscal | Admin | Datos fiscales de la empresa, PAC y series/folios. |
| Asistente | Ambos | Panel lateral global que responde sobre ventas, compras, ganancias y pronósticos (estos dos solo admin). |

El estado de cada feature está en [`spec/constitution/roadmap.md`](spec/constitution/roadmap.md).

## Stack

- **Backend:** Python 3.12, Django 6 + Django REST Framework, JWT (`simplejwt`), PostgreSQL 16.
- **Frontend:** React 19 + TypeScript (`strict`), Vite, React Router, TanStack Query, Tailwind CSS v4 + CSS Modules, Recharts.
- **Asistente (`024`):** clasificador de intención con *embeddings* locales (`fastembed` / ONNX, sin GPU). El texto del usuario no sale del servidor.
- **Tests:** Pytest + pytest-django; Vitest + React Testing Library. **Lint:** Ruff, ESLint.
- **Despliegue:** Docker, Gunicorn detrás de Nginx, frontend compilado como estático.

## Estructura

```
SynapseERP/
├── code/
│   ├── backend/            # Proyecto Django (config/, core/, apps/<módulo>/)
│   │   ├── Dockerfile      # Imagen del backend (descarga el modelo del asistente en el build)
│   │   └── requirements.txt
│   ├── frontend/           # App React + Vite (src/api, src/hooks, src/components, src/pages)
│   └── docker-compose.yml  # PostgreSQL de desarrollo
├── spec/
│   ├── constitution/       # Misión, stack y convenciones, roadmap
│   └── features/           # NNN-nombre-feature/{spec,plan,tasks}.md
└── Base de Datos Synapse.txt  # Referencia inicial de tablas (la spec tiene prioridad)
```

## Puesta en marcha (desarrollo)

Requisitos: Python 3.12 (conda o venv), Node.js 20.19+ o 22.12+, Docker (para PostgreSQL).

### 1. Base de datos

```bash
cd code
cp backend/.env.example backend/.env   # ajusta DB_PASSWORD, SECRET_KEY, FISCAL_ENCRYPTION_KEY
docker compose --env-file backend/.env up -d db
```

PostgreSQL queda en el puerto `DB_PORT` del `.env` (`5434` por defecto).

### 2. Backend

```bash
cd code/backend
conda activate erp_synapse            # o tu entorno virtual
pip install -r requirements.txt
python manage.py migrate
python manage.py indexar_intenciones  # descarga el modelo del asistente e indexa sus frases
python manage.py runserver            # http://localhost:8000
```

Crear el primer administrador (`createsuperuser` deja el rol en `operador` por defecto):

```bash
python manage.py createsuperuser
python manage.py shell -c "from apps.usuarios.models import Usuario; Usuario.objects.filter(email='TU_CORREO').update(rol_usuario='admin')"
```

Sin `indexar_intenciones`, el asistente funciona solo con botones y avisa que la búsqueda por texto no está disponible.

### 3. Frontend

```bash
cd code/frontend
cp .env.example .env    # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev             # http://localhost:5173
```

## Comandos

| Dónde | Comando | Para qué |
|---|---|---|
| backend | `pytest` | Tests del backend |
| backend | `ruff check .` | Lint de Python |
| backend | `python manage.py makemigrations <app>` | Crear migraciones |
| backend | `python manage.py ejecutar_auditorias [--tipo caja\|inventario]` | Auditorías programadas (`022`, por cron) |
| backend | `python manage.py generar_pronosticos` | Pronósticos semanales (`023`, por cron) |
| backend | `python manage.py generar_historial_demo` | Historial sintético para pronósticos (solo con `DEBUG=True`) |
| backend | `python manage.py indexar_intenciones` | Reindexa las frases del asistente (`024`) |
| backend | `python manage.py evaluar_asistente` | Mide el clasificador del asistente y sugiere umbrales |
| frontend | `npm run test` | Tests del frontend (Vitest) |
| frontend | `npm run lint` | ESLint |
| frontend | `npx tsc --noEmit` | Verificación de tipos |
| frontend | `npm run build` | Build de producción |

Antes de dar una feature por terminada deben pasar `ruff check .`, `pytest`, `npx tsc --noEmit`, `npm run lint` y `npm run test`.

## Imagen de Docker del backend

```bash
docker build -t synapse-backend code/backend
docker run --env-file code/backend/.env -p 8000:8000 synapse-backend
```

Al arrancar, la imagen corre `migrate` e `indexar_intenciones` y luego levanta Gunicorn. El modelo del asistente ya viene dentro de la imagen, así que no se descarga en tiempo de ejecución.

Pendiente para producción: `docker-compose.yml` solo levanta PostgreSQL (faltan los servicios del backend y de Nginx) y `settings.py` todavía no tiene configuración de producción (`ALLOWED_HOSTS`, `STATIC_ROOT`, `DEBUG=False`).

## Flujo de trabajo: Spec Driven Development

Todo cambio sigue **spec → plan → tasks → código**:

1. `spec/features/NNN-nombre/spec.md`: qué hace la feature y sus criterios de aceptación.
2. `plan.md`: enfoque técnico, decisiones y riesgos.
3. `tasks.md`: lista de tareas que se marca durante la implementación.

La constitución (`spec/constitution/`) manda sobre cualquier feature: si una feature la contradice, se replantea la feature, o se propone el cambio a la constitución para su aprobación.

## Seguridad

- Nunca se versionan `.env`, credenciales del PAC ni del SMTP.
- Las claves de `.env.example` son marcadores; genera las tuyas por entorno (por ejemplo, `FISCAL_ENCRYPTION_KEY` con `Fernet.generate_key()`).
