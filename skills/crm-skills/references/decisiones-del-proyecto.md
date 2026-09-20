# Decisiones del proyecto (fuente de verdad)

El grupo **ya definió** el proyecto. Esta es la especialización concreta: cuando
haya que modelar, diseñar pantallas, escribir reglas o codear, seguí **esto**, no
el modo genérico. Si algo de acá contradice un ejemplo genérico de otra
referencia, mandan estas decisiones.

## Identidad

- **Tipo de CRM:** especializado.
- **Target:** corralón de materiales de construcción que vende mayormente a
  **contratistas y maestros mayores de obra**.
- **Propuesta de valor:** los presupuestos y el seguimiento de clientes se manejan
  de forma informal (papel, WhatsApp, memoria) → centralizar y ordenar el flujo de
  cotización, negociación y seguimiento de cada obra/cliente.
- **Alcance:** la **gestión de stock queda fuera** (lo dice la consigna). El
  catálogo de materiales existe solo para armar presupuestos; el CRM no controla
  existencias.

## Concepto central

- **Una oportunidad = un presupuesto de materiales para una obra puntual o compra directa.**
- Se incorpora la entidad propia **Obra / Proyecto** (opcional, para obras con entregas en locación).
- Cadena del negocio:
  **Cliente (contratista) → tiene Obras asociadas → Presupuestos (oportunidades) vinculados a la Obra o directo al Cliente.**

### Entidad Obra / Proyecto

- Nombre/identificación (ej. "Edificio Rivadavia 1200")
- Dirección o ubicación
- Cliente (empresa o contacto)
- Tipo de obra (vivienda, edificio, refacción, obra pública…) — opcional
- Estado de la obra (en curso, finalizada, frenada) — opcional
- Observaciones

## Embudo comercial (etapas)

Abiertas: 1) **Consulta recibida** → 2) **Presupuesto en preparación** →
3) **Presupuesto enviado** → 4) **Negociación**.
Cierre: 5) **Venta concretada** (estado Ganada) · 6) **Perdida** (estado Perdida).

Estado ↔ etapa: **Abierta** en 1–4; **Ganada** en Venta concretada; **Perdida** en
Perdida. La oportunidad ganada registra el **valor final** del presupuesto.

## Catálogos

- **Orígenes:** Recomendación de otro contratista · Cliente existente / recompra ·
  Vino al local (mostrador) · Redes sociales · Publicidad · Página web ·
  Prospección propia.
- **Motivos de pérdida:** Precio · Plazo de entrega · Eligió otro corralón · Obra
  frenada o postergada · No hubo acuerdo en financiación / cuenta corriente · Falta
  de respuesta del cliente · Faltante de material.
- **Tipos de actividad:** Llamada · WhatsApp / Mensaje · Correo · Visita a la obra ·
  Atención en el local · Envío de presupuesto · Nota interna.
- **Productos / servicios precargados** (catálogo para presupuestar, sin stock):
  Aglomerantes (cemento, cal, yeso) · Áridos (arena, piedra partida, cascote) ·
  Hierros/aceros (hierro Ø6/8/10/12, malla Sima, alambre, clavos) · Mampostería
  (ladrillo común, ladrillo hueco, bloque de hormigón) · Techos (chapa, tirantería,
  membrana) · Hidráulica (caños PVC, codos, cámaras) · Servicio: flete / entrega en
  obra.

## Roles, permisos y visibilidad

Roles: los tres mínimos (**Administrador, Vendedor, Responsable comercial**), sin
extras.

- **Vendedor:** ve y opera solo sobre **sus clientes/obras asignados**; puede
  cerrar (ganar/perder) sus propias oportunidades.
- **Responsable comercial** y **Administrador:** ven todo el equipo.
- **Reasignar** oportunidades y **autorizar reabrir/modificar una oportunidad
  cerrada:** solo responsable comercial y administrador.

## Reglas de negocio propias (además de las de la consigna)

- Un presupuesto (oportunidad) pertenece a un cliente (empresa o contacto) y opcionalmente a una obra puntual.
- Toda obra pertenece a un cliente (empresa o contacto).
- La venta concretada registra el valor final del presupuesto.

## Stack técnico

Stack **efectivamente en uso** en el repo (`crm-web-app`), tras el primer
scaffolding:

- **Backend:** Python 3.12 + FastAPI, con `uv` como package manager/runner.
- **Base de datos & Auth:** **Supabase** (PostgreSQL gestionado + Supabase Auth).
  El acceso a datos va por el cliente `supabase-py` (no SQLAlchemy).
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript.
- **Validación:** Pydantic v2 + Pydantic Settings.
- **Calidad:** Ruff (lint + format) + Pytest (backend) · ESLint 9 (frontend).
- **CI/CD:** GitHub Actions (backend y frontend en paralelo).
- **Despliegue:** Vercel (frontend) + Docker/serverless (backend). El
  `docker-compose` levanta **solo** backend y frontend; la BD es Supabase
  hosteado (no hay Postgres en contenedor).

### Desviación respecto del plan inicial (blanqueada)

El plan original era **PostgreSQL self-hosted + JWT propio (OAuth2 password) +
bcrypt + Docker con FastAPI y Postgres en contenedores**. Se cambió a **Supabase**
(Postgres gestionado + Auth). No rompe la consigna —Supabase es Postgres— pero hay
que tener presentes estas implicancias:

- **Autorización SIEMPRE en el backend (FastAPI).** El backend usa el
  `service_role`/secret key de Supabase, que **bypassea RLS**. Por lo tanto RLS
  **no** protege las llamadas del backend: los permisos por rol se validan sí o sí
  en FastAPI (invariantes 3 y 12). No delegar la autorización en RLS.
- **Hashing de contraseñas:** si la auth se hace con **Supabase Auth**, el hashing
  seguro lo maneja Supabase (cumple el invariante). Si en cambio se usa una tabla
  propia de credenciales, hay que hashear con bcrypt/argon2. **No** vale el hash
  SHA-256 ni un "token" base64 sin firmar (placeholder actual del scaffold).
- **Token/sesión:** debe ser un **JWT verificado** (el de Supabase, validado con su
  JWKS, o uno propio firmado con `pyjwt`). Verificar firma y expiración en cada
  request; que el token no sea falsificable.

Al codear, aplicá las convenciones de `convenciones-desarrollo.md` sobre este stack
(Pydantic para validación; dependencias de FastAPI —`Depends`— para autorización
por rol; acceso a datos vía `supabase-py`).

## Otras decisiones

- **Ciclo de vida:** Incremental. **Modelo de negocio:** Suscripción (SaaS). El
  detalle y los descartes, junto con el modelo de procesos (MCVS) y los roles del
  equipo, están en `ciclo-vida-negocio-procesos.md`.
- **Go-to-market / buyer persona:** el corralón vende a contratistas y maestros
  mayores de obra; el dolor es la falta de seguimiento. Detalle del funnel en
  `marketing-y-funnel.md`. Recordá: el CRM **no** gestiona stock y **no** integra
  WhatsApp (ambos fuera de alcance), aunque aparezcan en el discurso de venta.
- Maneja **valores monetarios**: sí (presupuesto con valor estimado; venta con
  valor final).
- **Probabilidad de cierre:** no se usa (se puede sumar más adelante).
- **Estados de empresa/contacto:** los mínimos — Potencial, Cliente, Inactivo, No
  contactar.
- **Idioma:** español.
- **IA (opcional):** se decide más adelante, recién con lo principal completo y
  probado.

## Pendiente de definir (no bloquea el desarrollo)

- Organización interna del grupo (responsabilidades, fechas internas).
- Decisión final sobre la funcionalidad de IA.