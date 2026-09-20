# Ciclo de vida, modelo de negocio y modelo de procesos

Decisiones ya tomadas por el grupo en los TP de **Gestión Aplicada al Desarrollo
de Software** (ciclo de vida / modelo de negocio y modelo de procesos). Forman
parte de la fuente de verdad: si algo choca con esto, mandan estas decisiones.

## Ciclo de vida: Incremental

**Elegido: Incremental.** El problema se entiende **entero desde el inicio**
(dominio de CRM maduro y consigna cerrada) y se divide en un número **conocido y
planificado** de incrementos. El **orden obligatorio de desarrollo** *es* el plan
de incrementos: usuarios/roles → empresas y contactos → productos → oportunidades
y embudo → actividades e historial. Cada incremento se desarrolla, prueba y evalúa
por separado, entregando valor temprano con el núcleo comercial.

Descartes:

- **Cascada:** ejecuta una sola vez y no admite entregas por etapas; el trabajo
  está partido en dos entregas y necesita valor temprano.
- **Evolutivo:** aplica cuando solo se conoce parte de los requisitos y el resto
  se descubre con feedback. Acá el dominio es conocido y los incrementos están
  previstos de antemano. Podría usarse **puntualmente** en la IA opcional.

## Modelo de negocio: Suscripción (SaaS)

**Elegido: Suscripción SaaS.** Cobro recurrente con ingresos predecibles que
financian hosting, soporte y evolución, y escala con el uso (cantidad de
corralones, usuarios u obras). Es un CRM web hosteado (FastAPI + PostgreSQL +
Next.js sobre Docker), naturalmente entregable como servicio. Riesgo a gestionar:
la retención a largo plazo.

Descartes: **licencia única** (no financia soporte continuo) · **freemium** (no hay
masa crítica; es B2B) · **publicidad** (incompatible con datos sensibles, sin
tráfico masivo) · **transaccional/por uso** (el CRM no procesa pagos ni
facturación: no hay operación sobre la cual cobrar).

## Modelo de procesos (MCVS / ISO-IEC 12207 sobre Incremental)

El grupo mapeó los procesos del ciclo de vida a los tres incrementos (Prod. 1/2/3)
y armó el flujo del ciclo, que **se repite Inc. 1 → 2 → 3**.

Flujo de cada incremento (secuencial):

1. Entra el pedido del cliente → **Cliente (corralón)**.
2. Selección del MCVS — *Líder, una vez*.
3. Iniciación, planificación y estimación — *Líder, una vez*.
4. Pre-desarrollo: exploración de conceptos y asignación del sistema — *Analista,
   una vez*.
5. Análisis de requisitos del software — *Analista, por incremento*.
6. Diseño (datos, interfaces, detallado) — *Diseñador, por incremento*.
7. Implementación e integración — *Devs, por incremento*.
8. Instalación y aceptación — *Devs + QA, por incremento*.
9. Entrega del incremento → **Cliente** — *Equipo*.

Procesos **integrales** (se ejecutan durante todo el proyecto):

- Seguimiento y control del proyecto — *Líder de proyecto*.
- Gestión de calidad del software — *QA*.
- Verificación y validación / pruebas — *QA*.
- Gestión de configuración — *Todo el equipo · Git · Docker*.
- Documentación — *Todo el equipo*.
- Operación, soporte y mantenimiento — *Soporte/Equipo, luego de cada entrega*
  (coherente con el modelo SaaS).

**No aplican** (marcados en el TP): retiro del sistema, reaplicar el ciclo de vida,
generar código objeto y planificar la transición del sistema. Son coherentes con
una app web SaaS.

## Roles del proceso ≠ roles del CRM

Cuidado con no mezclar dos cosas que se llaman "roles":

- **Roles del proceso / equipo** (este documento): Líder de proyecto, Analista,
  Diseñador, Devs, QA, Soporte. Sirven para organizar **quién hace qué** en el
  desarrollo. **No** son entidades del sistema.
- **Roles del CRM** (usuarios del sistema): Administrador, Vendedor, Responsable
  comercial. Estos **sí** se modelan y se usan para permisos (ver
  `roles-casos-pantallas.md` y `modelo-de-datos.md`).

Si alguien pide "agregar el rol QA al CRM" o similar, es una confusión entre ambos:
QA es rol de proceso, no un usuario del CRM.