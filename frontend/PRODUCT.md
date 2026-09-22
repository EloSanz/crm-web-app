# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Instalable como PWA: el mismo producto se usa en PC y en celular (uso mixto confirmado).

## Users

- **Vendedor del corralón** (usuario diario). Arma presupuestos de materiales en la PC del mostrador u oficina, entre cliente y cliente, y hace el seguimiento y las consultas rápidas desde el celular (visitas a obra, WhatsApp, calle). Trabaja con apuro y con interrupciones constantes.
- **Responsable comercial** (rol del CRM). Supervisa el embudo de todo el equipo, reasigna oportunidades y revisa ganadas y perdidas.
- **Administrador** (rol del CRM). Configura catálogos y usuarios; ve todo.
- **Dueño del corralón** (decisor de compra del producto). Quiere saber cuánta plata está viva en presupuestos y qué se está escapando por falta de seguimiento.

Los clientes del corralón son contratistas, maestros mayores de obra, capataces y particulares; son el objeto del CRM, no sus usuarios.

## Product Purpose

Corralap centraliza el flujo comercial de un corralón de materiales de construcción: presupuestos por obra, negociación y seguimiento de cada contratista, que hoy viven en papel, WhatsApp y memoria. Éxito: que ningún presupuesto quede sin seguimiento y que el vendedor sepa a quién llamar hoy.

## Positioning

Una oportunidad es un presupuesto de materiales para una obra puntual. La North Star Metric es el **pipeline activo real**: monto y cantidad de presupuestos abiertos con actividad registrada en los últimos N días (7 por defecto), con semáforo de salud por presupuesto (al día ≤7d, en riesgo 8–14d, estancado >14d). El dolor central es "tres obras abiertas, cero seguimiento", no la falta de un sistema de stock.

## Operating Context

- Cadena del negocio: Cliente (empresa contratista o contacto) → Obras → Presupuestos, vinculados a la obra o directo al cliente.
- Embudo: Consulta recibida → Presupuesto en preparación → Presupuesto enviado → Negociación → Venta concretada (ganada, registra valor final) / Perdida (registra motivo).
- Tipos de actividad: llamada, WhatsApp/mensaje, correo, visita a la obra, atención en el local, envío de presupuesto, nota interna. Las actividades son hechos ya ocurridos.
- Catálogo de materiales (sólo para cotizar, sin stock): aglomerantes, áridos, hierros y aceros, mampostería, techos e hidráulica, servicios/fletes. Unidades del rubro: bolsa 50 kg, m³, barra 12 m.
- Montos en pesos argentinos (ARS).
- Trabajo Práctico de GADS II (UNLaM). Primera entrega: 24/9 (demo: login → empresa y contacto → presupuesto → verlo en el embudo → cambiar de etapa → comprobar persistencia). Entrega final: 12/11.

## Capabilities and Constraints

- Stack: Next.js 16 (App Router) + React 19 + Tailwind v4 en `frontend/`; API FastAPI + Supabase.
- Invariantes: historial inmutable, baja lógica (nunca borrado físico), permisos validados en el backend, trazabilidad de usuario y fecha.
- Fuera de alcance (no prometer en UI): stock, tareas/agenda/recordatorios, notificaciones, facturación, pagos, exportación, multi-organización, recepción de correos entrantes.
- Roles del CRM: admin, gerente_comercial (responsable comercial), ejecutivo_ventas (vendedor).
- Permisos (ronda 5): cada vendedor ve y toca sólo sus presupuestos, y lo que crea queda asignado a él; admin y responsable comercial ven todo y reasignan. Indicadores: admin ve todas las pestañas; responsable comercial ve Ventas, Vendedores, Etapas, Presupuestos y Contacto; el vendedor no ve ningún indicador (su Inicio es la cola de trabajo, sin montos totales). El historial de cambios del catálogo es sólo para admin.
- Precios y negociación: cada material tiene precio minorista y, opcionalmente, mayorista desde una cantidad; el presupuesto aplica la escala sola por cantidad y admite descuento por renglón y descuento general. Cambiar materiales o descuento de un presupuesto abierto genera una nueva versión (con motivo) en vez de otro presupuesto: el historial conserva cada versión y los indicadores no se ensucian.
- Contacto con el cliente: botón «Contactar» (llamada registrada, WhatsApp dentro de la app con la API de WhatsApp Cloud o, sin configurar, wa.me, y correo con formato y adjuntos vía proveedor configurable). Todo contacto queda en el seguimiento y alimenta los indicadores.
- No se presupuesta a empresas inactivas ni «no contactar». No se repiten DNI, teléfono ni correo entre contactos.
- Idioma: español rioplatense.

## Brand Commitments

- Nombre del producto: **Corralap**. No hay identidad visual previa: se crea completa (logo, color, tipografía) con el objetivo explícito de vender mejor y ganar aceptación en corralones.
- Evitar: estética "startup / tech" de SaaS genérico y letra chica o densa.
- Tipografía: **Montserrat** (pedido explícito del usuario, en lugar de Poppins).
- Poco texto en pantalla: sin bajadas ni explicaciones debajo de los títulos.
- Navegación por vistas: detalle, alta y edición son páginas propias; nada de paneles laterales.
- Semáforo de salud en verde / naranja / rojo planos; la metáfora del óxido quedó descartada.
- Marca (ronda 4, pedido del usuario): imagotipo con una **C de cinco ladrillos macizos en traba** sobre placa **amarillo vial #FFC20E**, ladrillos en pavonado #16212B; nombre **CORRALAP** en Montserrat ExtraBold, mayúsculas, interletrado amplio. Versiones horizontal, vertical e isotipo; monocromos negro sólido y blanco puro (placa con ladrillos calados); área de protección = alto de una hilada; sin degradés, sin 3D, sin líneas finas. Descartado: el atado de círculos como logo y como gráfico del Inicio.
- El amarillo es de la marca, de la acción principal y de la ubicación actual en la navegación; nunca comunica estado.
- El diseño es la principal herramienta de venta: sistema de componentes propio (desplegables, calendario, campos, botones, avisos) y cero desbordes.

## Evidence on Hand

- Catálogo precargado de materiales reales con precios de referencia y obras de ejemplo en el backend mock.
- No hay clientes, testimonios, métricas de uso ni casos reales: no inventarlos en la UI.

## Product Principles

1. **Seguimiento antes que registro.** Cada pantalla responde primero "¿qué presupuesto se está enfriando y a quién llamo?".
2. **Plata a la vista.** Montos, estado y salud se leen sin abrir nada.
3. **Legible con apuro.** Texto grande, contraste alto y acciones obvias, en mostrador y en celular.
4. **Del corralón, no de Silicon Valley.** El vocabulario y el mundo visual son los del rubro.
5. **Honesto con el alcance.** Nada de stock, agenda ni WhatsApp integrado.

## Accessibility & Inclusion

Legibilidad en entornos de mostrador (luz de local, pantallas mediocres) y en exterior con el celular: tamaños de texto generosos, contraste WCAG AA como mínimo y objetivos táctiles de 44 px.
