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

- **Una oportunidad = un presupuesto de materiales para una obra puntual.**
- Se incorpora la entidad propia **Obra / Proyecto**.
- Cadena del negocio:
  **Cliente (contratista) → tiene varias Obras → cada Obra tiene varios
  Presupuestos (oportunidades).**
- Un presupuesto **siempre** cuelga de una obra; una obra **siempre** pertenece a
  un cliente (empresa o contacto).

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

- Un presupuesto (oportunidad) siempre pertenece a una obra.
- Una obra siempre pertenece a un cliente (empresa o contacto).
- La venta concretada registra el valor final del presupuesto.

## Stack técnico

- **Backend:** Python + FastAPI
- **Base de datos:** PostgreSQL
- **Frontend:** Next.js (React)
- **Autenticación:** JWT (OAuth2 password) + hashing con bcrypt
- **Entorno / repo:** GitHub + Docker (FastAPI + PostgreSQL en contenedores)

Al codear, aplicá las convenciones de `convenciones-desarrollo.md` sobre este
stack (SQLAlchemy para modelos, Pydantic para validación, dependencias de FastAPI
para autorización por rol, etc.).

## Otras decisiones

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
