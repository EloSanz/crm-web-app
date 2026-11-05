# Sistema CRM para Gestión Comercial — UNLaM (GADS II)

Plataforma web integral para la administración del ciclo de vida comercial, gestión de empresas y contactos, seguimiento de oportunidades y embudo de ventas, diseñada bajo las directrices del Trabajo Práctico de **Gestión Aplicada al Desarrollo de Software II** (Ingeniería en Informática, UNLaM).

---

## 🛠️ Stack Tecnológico

- **Frontend**: [Next.js 16 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) + [TypeScript](https://www.typescriptlang.org/) + [Lucide Icons](https://lucide.dev/).
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+) con [uv](https://docs.astral.sh/uv/) como package manager y runner de alta velocidad.
- **Validación & Schemas**: [Pydantic v2](https://docs.pydantic.dev/) + Pydantic Settings.
- **Base de Datos & Auth**: [Supabase](https://supabase.com/) / [PostgreSQL](https://www.postgresql.org/) con RLS, migraciones declarativas y triggers.
- **Calidad & Testing**: [Ruff](https://astral.sh/ruff) (Linter y Formatter) + [Pytest](https://docs.pytest.org/) (Tests unitarios y de integración) + [ESLint 9](https://eslint.org/).
- **CI / CD**: GitHub Actions unificado con verificación en paralelo de backend y frontend.
- **Despliegue**: Optimizado para [Vercel](https://vercel.com/) (Frontend) y Docker / Serverless (Backend).

---

## 📂 Estructura del Proyecto

```text
crm-web-app/
├── .github/
│   └── workflows/
│       └── ci.yml                      # CI unificado (Backend + Frontend)
├── backend/                            # Servidor API FastAPI
│   ├── config.py                       # Configuración y lectura de .env (Pydantic Settings)
│   ├── database.py                     # Singleton cliente Supabase
│   ├── controllers/                    # Endpoints REST (auth, health, etc.)
│   │   ├── auth_controller.py          # /api/auth/login, /api/auth/me
│   │   └── health_controller.py        # /health, /api/health
│   ├── models/                         # Modelos y esquemas Pydantic
│   ├── services/                       # Lógica de negocio y auth service
│   ├── main.py                         # FastAPI App & configuración CORS
│   └── Dockerfile                      # Imagen Docker del backend
├── bruno/                              # Colección de peticiones para Bruno API Client
│   ├── environments/Local.bru
│   ├── Auth/
│   └── Health/
├── frontend/                           # Aplicación Next.js
│   ├── src/
│   │   ├── app/                        # Rutas App Router (/, /login, error, loading)
│   │   ├── components/                 # Componentes modulares (auth, ui)
│   │   ├── lib/                        # Cliente Supabase en frontend
│   │   └── types/                      # Tipos TypeScript
│   ├── package.json                    # Dependencias frontend
│   └── tsconfig.json
├── migrations/                         # Migraciones de Base de Datos
│   └── 01_initial_crm_schema.sql       # Schema Supabase (usuarios, roles, CRM base)
├── postman/                            # Colecciones de Postman v2.1.0 y Entornos
│   ├── crm-web-app.postman_collection.json
│   └── crm-local.postman_environment.json
├── skills/                             # Documentación y consignas (UNLaM GADS II)
│   └── crm-skills/
├── tests/                              # Suite de pruebas automatizadas
│   ├── conftest.py                     # Fixtures compartidas de pytest
│   └── unit/                           # Tests unitarios
├── .env.example                        # Variables de entorno modelo
├── docker-compose.yml                  # Orquestación con Docker Compose
├── package.json                        # Configuración del workspace raíz
└── pyproject.toml                      # Configuración de dependencias backend (uv)
```

---

## 🚀 Inicio Rápido en Desarrollo Local

### Prerrequisitos
- **Python 3.12+** y **[uv](https://docs.astral.sh/uv/)** instalado: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Node.js 20+** y **npm**

### 1. Clonar y configurar variables de entorno
```bash
cp .env.example .env
```

### 2. Levantar el Backend (FastAPI con `uv`)
```bash
# Instalar dependencias de Python y crear virtualenv automáticamente
uv sync

# Ejecutar el servidor con hot-reload en http://localhost:8000
uv run uvicorn backend.main:app --reload --port 8000
```
- **Documentación Swagger interactiva**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Endpoint de Health**: [http://localhost:8000/health](http://localhost:8000/health)

### 3. Levantar el Frontend (Next.js)
En otra terminal:
```bash
# Instalar dependencias de Node.js
npm install

# Iniciar servidor de desarrollo en http://localhost:3000
npm run dev:frontend
```

---

## 🧪 Pruebas y Linters

```bash
# Ejecutar suite de pruebas de backend con pytest
uv run pytest

# Ejecutar linter de Python (Ruff)
uv run ruff check

# Formatear código de Python
uv run ruff format

# Ejecutar linter de Frontend (ESLint)
npm run lint:frontend

# Ejecutar todos los linters juntos
npm run lint
```

---

## 🔒 Usuarios, contraseñas y credenciales de prueba

### Usuarios demo (contraseña escrita en el código)

| Rol | Correo Electrónico | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `admin@crm.com` | `admin123` |
| **Responsable Comercial** | `gerente@crm.com` | `gerente123` |
| **Ejecutivo Comercial** | `vendedor@crm.com` | `vendedor123` |

Sólo funcionan en **modo local** (sin `SUPABASE_URL` real) o si el backend tiene `ALLOW_DEMO_LOGIN=true`.
Con Supabase configurado y `ALLOW_DEMO_LOGIN` en `false` (el valor por defecto) se entra únicamente con cuentas
reales de Supabase Auth.

### Usuarios reales (regla 13: contraseñas con hash seguro)

- **Alta** (pantalla *Usuarios*, sólo administrador): se define una contraseña inicial de 8 caracteres o más.
  Con Supabase se crea la cuenta en **Supabase Auth** (que guarda el hash bcrypt) y la fila de `crm_users` con el
  **mismo id**. Si falla la fila, se borra la cuenta recién creada (no quedan cuentas huérfanas).
- **Restablecer contraseña**: en *Editar usuario* (`POST /api/users/{id}/password`, sólo administrador). Si el
  usuario todavía no tenía cuenta de acceso, se la crea.
- **Baja**: el login rechaza a los usuarios con `is_active = false` y además se los bloquea en Supabase Auth
  (`ban_duration`); al reactivarlos se levanta el bloqueo.
- **Login**: Supabase Auth valida la contraseña; el rol y el nombre salen de `crm_users` (por id y, si no está,
  por correo: así una cuenta nueva de `admin@crm.com` usa el id fijo `…0001` que ya tienen los presupuestos).
  Una cuenta de Auth sin perfil en `crm_users` no entra.
- **Modo local**: el hash es `scrypt` (librería estándar) con sal aleatoria por usuario; nunca texto plano.
- La API nunca devuelve contraseñas ni hashes, y no se registran en los logs.

### Pasar producción a usuarios reales sin quedarse afuera

Hoy producción entra con los usuarios demo. El orden importa:

1. **Antes de desplegar esta versión**, cargar `ALLOW_DEMO_LOGIN=true` en las variables de entorno del backend en
   producción. Sin eso, al desplegar dejan de andar `admin123` y compañía.
2. Desplegar y comprobar que se sigue entrando con `admin@crm.com` / `admin123`.
3. Desde una máquina del grupo, con las credenciales de producción en el entorno (la *secret key*, no la publishable):
   ```bash
   export SUPABASE_URL=https://<proyecto>.supabase.co
   export SUPABASE_SECRET_KEY=<secret key>
   uv run python scripts/crear_usuarios_auth.py --dry-run   # lista quién no tiene cuenta
   uv run python scripts/crear_usuarios_auth.py             # pide la contraseña de cada uno (no se ve al tipear)
   ```
   Crea en Supabase Auth una cuenta por cada usuario activo de `crm_users` que no la tenga, con el mismo id.
   Enter sin contraseña lo saltea; se puede correr de nuevo cuando haga falta.
4. Entrar en producción con la **contraseña nueva** de `admin@crm.com` (y probar al menos un vendedor). Mientras
   `ALLOW_DEMO_LOGIN=true` siguen valiendo las dos contraseñas.
5. Recién ahí poner `ALLOW_DEMO_LOGIN=false` (o borrar la variable) y volver a desplegar. Comprobar que
   `admin123` ya no entra y la contraseña real sí.
6. Recomendado: en Supabase → Authentication → Sign In / Providers, desactivar *Allow new users to sign up*
   (las altas se hacen desde el CRM).

Si alguien se queda afuera: el administrador le restablece la contraseña desde *Usuarios*; si el que no puede
entrar es el administrador, volver a poner `ALLOW_DEMO_LOGIN=true` y desplegar, o cambiarle la contraseña desde el
panel de Supabase (Authentication → Users).

---

## 🤖 Asistente con IA y Gmail del vendedor

Tres módulos que cierran el desarrollo (planes de GADS, escenarios 1 a 3). Los tres funcionan **sin credenciales**
en modo simulado, así se desarrolla y se prueba sin gastar.

### 1 · Borradores de respuesta (`POST /api/ai/drafts`)
- En **Nuevo correo** y en el **chat de WhatsApp**, el botón «Sugerir respuesta» arma un borrador con el
  presupuesto, sus materiales, el seguimiento y los últimos mensajes. Se puede pedir otra versión («más corto»).
- El borrador **nunca sale solo**: «Usar borrador» lo pasa al editor y el vendedor lo revisa y lo manda.
  El seguimiento anota que el correo partió de un borrador.
- «Lead a responder»: el cliente escribió y nadie contestó, o el presupuesto lleva 8 días o más sin contacto
  (en ese caso el presupuesto muestra la tarjeta «Retomar el contacto»).
- El asistente escribe directo en el editor y se le piden ajustes desde abajo («más corto», «insertá el detalle
  del presupuesto»). Si se pide el detalle, inserta la misma tabla que «Insertar detalle del presupuesto».
- Respeta lo que el vendedor edita a mano: en cada ajuste compara su última versión con el texto actual y conserva
  esos cambios. Además guarda lo que se terminó enviando (`final_text`, migración 09) y usa esas correcciones como
  preferencias de estilo del vendedor en sus próximos borradores.
- También sirve sin presupuesto: desde la ficha de un cliente o contacto usa sus últimas interacciones.
- Un vendedor sólo pide borradores de presupuestos o clientes asignados a él.

### 2 · «Ponete al día» con el cliente (`/companies/<id>/ponete-al-dia`)
- Resumen sin costo (presupuestos, cotizado, último contacto) y 10 preguntas sugeridas.
- Sin base vectorial: el expediente completo del cliente (presupuestos, etapas, versiones, actividades y mensajes
  del cliente) entra en el prompt con referencias `[F12]`. Cada dato de la respuesta lleva su cita y la cita
  lleva a la actividad exacta del seguimiento (queda resaltada).
- Las citas inventadas se descartan en el backend; una respuesta sin fuentes se marca para verificarla y
  si el historial no alcanza responde «No lo encuentro en el historial del cliente».
- Pueden preguntar el admin y el responsable comercial por cualquier cliente; un vendedor, por los clientes
  asignados a él o con algún presupuesto suyo (el cliente heredado).

### Costo y control del modelo
- `ANTHROPIC_API_KEY` vacío = modo simulado. Con clave, usa `AI_MODEL` (por defecto `claude-opus-5-5`) con
  salida JSON con esquema y caché del expediente (varias preguntas seguidas pagan el historial una vez).
- Cada consulta queda en `crm_ai_requests` (quién, sobre qué cliente, tokens y costo). Antes de llamar se controla
  `AI_MONTHLY_BUDGET_USD` (tope mensual) y `AI_DAILY_REQUESTS_PER_USER`. `GET /api/ai/status` muestra el gasto.

### 3 · Correo desde el Gmail del vendedor (`/cuenta/correo`)
- El vendedor conecta su cuenta (OAuth de Google, permisos `gmail.send` y `gmail.readonly`). Los tokens se guardan
  cifrados (Fernet) en `crm_gmail_accounts`.
- Con la cuenta conectada, los correos del CRM salen de su dirección; «Responder» en la sección **Correos** del
  presupuesto sigue el mismo hilo. Sin cuenta conectada se usa `EMAIL_PROVIDER` (Resend / SMTP) como respaldo.
- Las respuestas se consultan cada tanto (al abrir el presupuesto, con «Buscar respuestas» y con el cron diario
  de Vercel en `/api/gmail/cron`). Sólo entran respuestas a hilos iniciados desde el CRM, sin duplicar: se crean
  el mensaje entrante y la actividad «Correo recibido».
- **Límites de Google:** `gmail.readonly` es un permiso restringido. En modo prueba la app admite hasta 100 usuarios
  de prueba y el permiso vence a los 7 días (hay que volver a conectar). Para producción hace falta la
  verificación de la app por Google.

### Puesta en marcha
1. Aplicar `migrations/08_asistente_ia_y_gmail.sql` en Supabase (idempotente).
2. Completar las variables nuevas de `.env.example` (todas opcionales).
3. **El token de sesión ahora está firmado** (HMAC con `JWT_SECRET_KEY`) y vence según `ACCESS_TOKEN_EXPIRE_MINUTES`:
   las sesiones viejas vuelven al login una vez. En producción, `JWT_SECRET_KEY` tiene que ser un secreto propio.

---

## 📋 Reglas Invariantes de Negocio (Consigna UNLaM)

1. **Historial inmutable**: Cada cambio de etapa y actividad se guarda como registro independiente y no se sobreescribe.
2. **Baja lógica obligatoria**: Empresas, contactos y oportunidades se dan de baja lógica mediante `is_deleted` y `deleted_at`.
3. **Autorización en servidor**: Validación de roles y permisos estricta en FastAPI.
4. **Separación Contacto ≠ Oportunidad**: Un contacto es una persona registrada; una oportunidad es una negociación concreta.
