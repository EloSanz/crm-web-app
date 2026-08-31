---
name: crm-gestion-comercial
description: >-
  Guía para analizar, diseñar y desarrollar el Sistema CRM para Gestión Comercial
  del Trabajo Práctico de Gestión Aplicada al Desarrollo de Software II (UNLaM,
  Ing. en Informática): modelo de datos, atributos mínimos, reglas de negocio,
  roles y permisos, casos de uso, pantallas, alcance, fechas y requisitos de cada
  entrega, cómo especializar el CRM a una industria y convenciones de desarrollo.
  Usá esta skill SIEMPRE que se trabaje sobre este TP: al modelar entidades
  (empresa, contacto, oportunidad, actividad, etapa, historial), diseñar el embudo
  comercial, definir reglas o permisos, planear una entrega, elegir el tipo de CRM
  o la industria, escribir o revisar código, o preparar la IA opcional. Aplica
  aunque no se diga "CRM" pero el contexto sea este trabajo: oportunidades, embudo,
  responsable comercial, motivos de pérdida, orígenes, historial de etapas, etc.
---

# CRM para Gestión Comercial — Trabajo Práctico (GADS II, UNLaM)

Esta skill es la fuente de verdad de la consigna. Antes de proponer un modelo,
una pantalla, una regla o una porción de código, verificá lo que dicen estos
documentos en vez de improvisar: la consigna es específica y perder un requisito
cuesta puntos en la evaluación.

## Antes que nada: fijar el tipo de CRM

La consigna obliga a decidir esto **antes** de diseñar. Todo lo demás depende de
la respuesta.

- **CRM genérico**: sirve para distintos tipos de empresa. Las etapas, tipos de
  actividad, orígenes, motivos de pérdida, productos/servicios y estados deben ser
  **configurables** desde el sistema.
- **CRM especializado** (seguros, inmobiliaria, educación, salud, turismo,
  concesionaria, servicios profesionales…): dirigido a una industria concreta. La
  especialización debe producir **cambios reales en el modelo de datos y en el
  proceso comercial**, no alcanza con renombrar, recolorear o cambiar textos.

Si el grupo **todavía no eligió**, trabajá en modo genérico y dejá los puntos de
extensión marcados. Cuando elijan industria, leé `references/especializacion.md`
para adaptar entidades, embudo, reglas y vocabulario. Si te piden ayuda sin que el
tipo esté definido, preguntá o asumí genérico y decilo explícitamente.

## Reglas invariantes (nunca las rompas)

Estas atraviesan todo el sistema. Si una propuesta las viola, corregila antes de
seguir:

1. **Historial inmutable.** Cada cambio de etapa y cada actividad se guarda como
   registro independiente. El historial **no se reemplaza ni se sobrescribe** al
   modificar la oportunidad.
2. **Baja lógica, nunca física.** Los registros con historial comercial (empresas,
   contactos, oportunidades…) no se eliminan de la base: se cambia su **estado**.
3. **Permisos en el backend.** Validar autorización en el servidor, no solo ocultar
   botones en el frontend.
4. **Contraseñas con hash seguro.** Nunca en texto plano.
5. **Trazabilidad.** Los cambios importantes deben registrar **qué usuario** los
   hizo y **cuándo**.
6. **Toda oportunidad** tiene responsable, una etapa actual, y está asociada como
   mínimo a una empresa o un contacto.
7. **Coherencia estado ↔ etapa.** Una oportunidad abierta está en etapa abierta;
   una cerrada (ganada/perdida) no vuelve a etapa abierta sin autorización.

El detalle completo de reglas está en `references/reglas-de-negocio.md`.

## Contacto ≠ Oportunidad (distinción clave)

Es el error conceptual más común en este TP. Mantenelos separados en el modelo:

- **Contacto**: una persona/empresa registrada en el CRM. Existe aunque hoy no
  haya negociación.
- **Oportunidad**: una posibilidad concreta de venta/contratación. Un mismo
  contacto o empresa puede tener **varias** oportunidades a lo largo del tiempo.

## Orden obligatorio de desarrollo

Seguí esta secuencia; está impuesta por la consigna y ordena las entregas:

1. Análisis del problema y elección del tipo de CRM.
2. Definición de usuarios, alcance y requerimientos.
3. Diseño de pantallas y modelo de datos.
4. Usuarios, roles y permisos.
5. Empresas y contactos.
6. Productos o servicios.
7. Oportunidades y embudo comercial.
8. Actividades e historial.
9. Pruebas y corrección de las funcionalidades principales.
10. Funcionalidad de IA (opcional, recién acá).
11. Pruebas finales y presentación.

**La IA va al final y es opcional.** No la incorpores antes de tener las
funcionalidades principales completas y probadas.

## Mantené el foco: qué queda AFUERA

No construyas de más. Está **fuera de alcance**: gestión de tareas, agenda,
recordatorios/notificaciones, indicadores y estadísticas, exportación,
integraciones con otros sistemas, API pública, importación automática,
facturación, pagos, contabilidad, stock, campañas de marketing, envío de mails
desde el CRM, integración con WhatsApp y soporte multi-organización. Si alguien
pide algo de esta lista, avisá que está fuera de la consigna antes de hacerlo.

Ojo con un matiz sutil: las **actividades** registran interacciones que **ya
ocurrieron** (hechos históricos). El sistema **no** gestiona acciones futuras,
tareas ni recordatorios.

## Índice de referencias (leé la que corresponda a la tarea)

- **`references/modelo-de-datos.md`** — Entidades, atributos mínimos, estados y
  relaciones. Leelo al diseñar el modelo, crear tablas/entidades, o definir el
  formulario de alta/edición de cualquier entidad.
- **`references/reglas-de-negocio.md`** — Las 15 reglas generales + las reglas de
  cambio de etapa. Leelo al implementar validaciones, transiciones de etapa o
  cierre de oportunidades.
- **`references/roles-casos-pantallas.md`** — Los tres roles con sus permisos, los
  17 casos de uso mínimos y las pantallas mínimas. Leelo al armar permisos, planear
  vistas o revisar cobertura funcional.
- **`references/entregas.md`** — Qué se pide en la primera entrega (24/9) y en la
  final (12/11), con checklists. Leelo al planificar el trabajo o antes de una
  entrega.
- **`references/especializacion.md`** — Cómo adaptar el CRM a una industria de
  forma real. Leelo cuando el grupo elija (o evalúe) una industria.
- **`references/convenciones-desarrollo.md`** — Arquitectura por capas, cómo
  implementar baja lógica / historial / permisos / hashing, y buenas prácticas
  independientes del stack. Leelo al escribir o revisar código.

## Cómo ayudar en cada fase

- **Analizar / diseñar**: partí de las entidades y reglas de las referencias. No
  inventes atributos que la consigna no pide salvo que aporten y lo aclares; no
  omitas los mínimos.
- **Desarrollar**: el TP no exige un stack ni arquitectura determinada. Respetá el
  stack que use el grupo y aplicá las convenciones de `convenciones-desarrollo.md`
  de forma agnóstica. Priorizá que las reglas invariantes queden implementadas de
  verdad (no solo en la UI).
- **Planificar**: usá el orden obligatorio y las dos entregas como columna
  vertebral.
- **Revisar**: chequeá contra las reglas invariantes y el alcance. Señalá lo que
  falte de los mínimos y lo que sobre por estar fuera de alcance.
