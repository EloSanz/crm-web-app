---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: ["src/components"]
---

# Corralap · App (todas las pantallas)

## Scope and mode

Aplicación completa en `frontend/src/app`: login, Inicio, Presupuestos (embudo, detalle, alta), Obras, Clientes (Empresas y Contactos, con detalle), Catálogo y la página de sistema de diseño `/sistema`. Modo **Operate**. PWA instalable, uso mixto PC de mostrador + celular.

## Audience, job, constraints

- Vendedor del corralón con apuro e interrupciones: ver qué presupuesto se enfría, llamar, registrar el contacto, mover de etapa, armar presupuestos desde el catálogo.
- Responsable comercial / dueño: plata viva vs. plata que se enfría.
- Misma API y funcionalidad. Demo de la primera entrega (24/9) intacta.
- Ronda 4: marca rehecha (C de ladrillos sobre amarillo vial, mayúsculas con interletrado amplio, monocromos, área de protección, manual en `/sistema`); el gráfico de burbujas del Inicio se reemplaza por un embudo de barras por etapa.
- Decisiones fijadas por el usuario en la ronda 2 (mandan sobre el sorteo): tipografía geométrica (Montserrat); poco texto, sin descripciones ni explicaciones; nada de paneles laterales, cada tarea es una vista navegable; semáforo sin óxido; cero desbordes; sistema de diseño propio para dropdowns, datepickers, inputs, botones y toasts que comuniquen su tipo.

## Chosen direction and memorable moment

Punta pintada, lavada, con marca de obra. Momento memorable: la C de ladrillos amarilla que recibe en el ingreso y el armador de presupuestos con la hoja del presupuesto armándose en vivo al lado.

## Unresolved decisions

- Numeración real de presupuestos: el backend no expone un correlativo; se muestra una referencia corta derivada del id.

## Direction contract

THESIS: Cartelería de obra: amarillo vial sobre pavonado para la marca y la acción, y una punta pintada por presupuesto que dice qué tan fresco está el seguimiento. Rechaza el CRM SaaS genérico y la pantalla llena de explicaciones.

OWN-WORLD: Riel pavonado azul-negro con la ubicación actual en amarillo vial, suelo zinc, superficies claras de radio 12; Montserrat (Buenos Aires) geométrica en todo; logo C de ladrillos macizos; puntas planas con punto interior en verde / naranja / rojo; acción principal en amarillo con texto pavonado, selección en pavonado, verde sólo para salud y ventas; componentes propios.

STORY: El vendedor abre, ve cuánta plata está viva y qué se enfría, llama al primero de la lista y deja registrado el contacto.

FIRST VIEWPORT: Inicio: saludo corto; banda pavonado con el pipeline activo en cifra gigante; debajo, el embudo por etapa (barras partidas por seguimiento) y «A quién llamar hoy»; «Nuevo presupuesto» en amarillo arriba a la derecha.

FORM: Punta pintada, posición 5 de 7 en la lista ordenada, seed 9616a4ec; ronda 2 con decisiones fijadas por el usuario.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
