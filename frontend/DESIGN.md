---
name: Corralap
description: CRM de presupuestos para corralones de materiales; amarillo vial sobre pavonado, como la cartelería de obra.
colors:
  pavonado: "#16212b"
  pavonado-2: "#1f2e3c"
  pavonado-3: "#2c3f51"
  pavonado-borde: "#34495c"
  niebla: "#a9b8c2"
  amarillo: "#ffc20e"
  amarillo-2: "#f2b400"
  amarillo-tinta: "#7a5500"
  amarillo-velo: "#fff3c4"
  suelo: "#eceeed"
  chapa: "#ffffff"
  chapa-2: "#f4f6f5"
  linea: "#dce1df"
  linea-fuerte: "#bfc7c4"
  tinta: "#16212b"
  tiza: "#5a666f"
  verde: "#1b8049"
  verde-tinta: "#146337"
  verde-claro: "#3dbe74"
  verde-velo: "#e4f3ea"
  ambar: "#e8830c"
  ambar-tinta: "#8a4700"
  ambar-claro: "#f7b25e"
  ambar-velo: "#fdebd6"
  rojo: "#cf3a2c"
  rojo-tinta: "#a4261b"
  rojo-claro: "#f07a6d"
  rojo-velo: "#fbe9e6"
typography:
  display:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(26px, 8.6vw, 64px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\", \"lnum\""
  headline:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.375
  meta:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
  rotulo:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  wordmark:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.09em"
  wordmark-sm:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.09em"
  wordmark-lg:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.09em"
  wordmark-xl:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.09em"
  hero:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline-mobile:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  body-lg:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  tab:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
  badge:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
rounded:
  sm: "5px"
  md: "8px"
  control: "10px"
  card: "12px"
  panel: "16px"
  full: "9999px"
spacing:
  gap-xs: "6px"
  gap-sm: "8px"
  gap-md: "12px"
  gap-lg: "16px"
  panel: "20px"
  panel-wide: "24px"
  page-mobile: "16px"
  page-tablet: "24px"
  page-desktop: "40px"
components:
  button-primario:
    backgroundColor: "{colors.amarillo}"
    textColor: "{colors.pavonado}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primario-hover:
    backgroundColor: "{colors.amarillo-2}"
  button-secundario:
    backgroundColor: "{colors.chapa}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-secundario-hover:
    backgroundColor: "{colors.chapa-2}"
  button-fantasma:
    textColor: "{colors.tiza}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-peligro:
    backgroundColor: "{colors.rojo}"
    textColor: "{colors.chapa}"
    rounded: "{rounded.control}"
    height: "44px"
  button-exito:
    backgroundColor: "{colors.verde}"
    textColor: "{colors.chapa}"
    rounded: "{rounded.control}"
    height: "44px"
  input:
    backgroundColor: "{colors.chapa}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  filter-chip:
    backgroundColor: "{colors.chapa}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "36px"
  filter-chip-selected:
    backgroundColor: "{colors.pavonado}"
    textColor: "{colors.chapa}"
  segmented-selected:
    backgroundColor: "{colors.pavonado}"
    textColor: "{colors.chapa}"
    rounded: "{rounded.md}"
    height: "36px"
  chip-verde:
    backgroundColor: "{colors.verde-velo}"
    textColor: "{colors.verde-tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "28px"
  chip-ambar:
    backgroundColor: "{colors.ambar-velo}"
    textColor: "{colors.ambar-tinta}"
    rounded: "{rounded.full}"
    height: "28px"
  chip-rojo:
    backgroundColor: "{colors.rojo-velo}"
    textColor: "{colors.rojo-tinta}"
    rounded: "{rounded.full}"
    height: "28px"
  chip-fuerte:
    backgroundColor: "{colors.pavonado}"
    textColor: "{colors.chapa}"
    rounded: "{rounded.full}"
    height: "28px"
  chip-neutro:
    backgroundColor: "{colors.chapa-2}"
    textColor: "{colors.tiza}"
    rounded: "{rounded.full}"
    height: "28px"
  nav-rail:
    backgroundColor: "{colors.pavonado}"
    textColor: "{colors.niebla}"
    width: "248px"
  nav-item-active:
    backgroundColor: "{colors.amarillo}"
    textColor: "{colors.pavonado}"
    rounded: "{rounded.control}"
    height: "44px"
  card-presupuesto:
    backgroundColor: "{colors.chapa}"
    rounded: "{rounded.card}"
    padding: "16px"
  panel:
    backgroundColor: "{colors.chapa}"
    rounded: "{rounded.panel}"
    padding: "24px"
  banda-pavonado:
    backgroundColor: "{colors.pavonado}"
    textColor: "{colors.chapa}"
    rounded: "{rounded.panel}"
    padding: "28px 32px"
---

# Design System: Corralap

## Overview

**Creative North Star: "Cartelería de obra"**

Corralap se ve como la señalización de un corralón: amarillo vial sobre acero pavonado para la marca y la acción, suelo de zinc claro para trabajar, y una punta de hierro pintada por presupuesto que dice qué tan fresco está el seguimiento. Es una herramienta de mostrador y de celular en la calle: cifras grandes, texto de 15px como piso de lectura, objetivos táctiles de 44px y casi nada de prosa en pantalla. Cada título está solo; no hay bajadas ni explicaciones.

El sistema separa tres voces de color y no las mezcla. El amarillo habla de marca, de la acción principal y de dónde estás. El pavonado marca lo seleccionado. Verde, naranja y rojo sólo hablan de salud del seguimiento y del resultado de la venta. Todo lo demás es neutro: chapa blanca, líneas de zinc, tinta pavonada, tiza para lo secundario.

La densidad es de operación, no de tablero SaaS: superficies claras con radio de 12 a 16px y sombra corta, un riel oscuro con grano de acero apenas visible, Montserrat pesada y apretada en títulos y cifras. Rechazos confirmados: la estética genérica de startup/SaaS, la letra chica o densa, los paneles laterales (drawers) y la metáfora del óxido para el semáforo.

**Key Characteristics:**
- Amarillo vial (marca + acción + ubicación) sobre pavonado azul-negro, sobre suelo zinc.
- Semáforo plano de tres pinturas reservado a la salud del seguimiento y al resultado de venta.
- Montserrat en todo: 800 apretada para títulos y cifras, 15px para leer, 13px para metadatos.
- Cifras tabulares siempre; la plata se lee sin abrir nada.
- Cada tarea es una ruta propia; cero desborde de página en cualquier ancho.
- Logo de cinco ladrillos macizos en traba sobre placa amarilla; formas llenas, sin líneas finas.

## Colors

Dos colores de marca de alto contraste, un neutro de zinc y un semáforo de tres pinturas planas, cada familia con su rol exclusivo.

### Primary
- **Amarillo vial** (`amarillo`): la placa del logo, el botón primario (con texto pavonado), el ítem activo del riel y la pastilla activa de la barra inferior. Hover del primario en **Amarillo vial profundo** (`amarillo-2`). **Tinta ámbar oscura** (`amarillo-tinta`) y **Velo amarillo** (`amarillo-velo`) existen para texto y fondos derivados de marca en el manual, nunca como estado.
- **Pavonado** (`pavonado`): acero azul-negro. Fondo del riel, la barra superior y la barra inferior en celular, la banda del pipeline activo en Inicio, los ladrillos del logo, el tooltip del embudo y el fondo del diálogo modal velado (50%). Es también el color de **selección**: pastilla de filtro activa, segmento activo, día elegido del calendario, switch encendido, `::selection`.
- **Pavonado 2 / 3 / borde** (`pavonado-2`, `pavonado-3`, `pavonado-borde`): hover de ítems y campo de búsqueda sobre el riel, divisores sobre oscuro.
- **Niebla** (`niebla`): texto secundario e íconos inactivos sobre pavonado; conteos dentro de una selección pavonada.

### Secondary
- **Verde al día** (`verde`, con `verde-tinta`, `verde-claro`, `verde-velo`): seguimiento al día (≤7 días) y venta concretada. Botón `exito` sólo para cerrar una venta; etapas ya recorridas en el detalle.
- **Naranja de señalización** (`ambar`, con `ambar-tinta`, `ambar-claro`, `ambar-velo`): seguimiento en riesgo (8 a 14 días) y el monto que "se enfría". Es naranja a propósito, separado del amarillo de marca. También tiñe el aviso (toast de advertencia).
- **Rojo frío** (`rojo`, con `rojo-tinta`, `rojo-claro`, `rojo-velo`): seguimiento estancado (más de 14 días), errores, campo inválido, botón `peligro`.

Cada tono de semáforo trabaja en cuatro pasos: base para puntos y rellenos, `-tinta` para texto sobre claro, `-claro` para el núcleo de la punta y texto sobre pavonado, `-velo` para fondos de pastilla y aviso.

### Neutral
- **Suelo zinc** (`suelo`): fondo de toda la aplicación.
- **Chapa** (`chapa`): superficies de trabajo: paneles, tarjetas, tablas, campos, diálogos.
- **Chapa 2** (`chapa-2`): encabezado de tabla, hover de filas y botones fantasma, campo deshabilitado, pastilla neutra.
- **Línea** (`linea`) y **Línea fuerte** (`linea-fuerte`): bordes de paneles y divisores; borde de campos y botón secundario.
- **Tinta** (`tinta`): texto principal (mismo valor que pavonado). Anillo de foco.
- **Tiza** (`tiza`): texto secundario, etiquetas de columna, íconos en reposo.

### Named Rules
**The Yellow Never Reports Rule.** El amarillo es marca, acción principal y ubicación actual. Nunca comunica estado, salud ni selección. Si algo amarillo no es el logo, el botón principal de la vista o "estás acá", está mal.

**The Pavonado Selects Rule.** Lo elegido por el usuario (filtro, segmento, fecha, switch) se pinta en pavonado con texto blanco. No en amarillo, no en verde.

**The Three Paints Rule.** Verde, naranja y rojo sólo dicen salud del seguimiento o resultado de venta (y rojo, además, error y peligro). Los estados de registro que no son salud (abierto, en pausa, perdido) usan las pastillas `fuerte` (pavonado), `pausa` (chapa con punto vacío) o `neutro`.

## Typography

**Display Font:** Montserrat (con ui-sans-serif, system-ui)
**Body Font:** Montserrat
**Label Font:** Montserrat

**Character:** Una sola familia geométrica, diseñada en Buenos Aires, trabajada por peso: 800 apretada (−0.025em) para títulos y cifras, 600–700 para lo accionable, 400 para leer. Todos los números llevan cifras tabulares y de caja alta.

### Hierarchy
- **Display** (800, clamp(26px, 8.6vw, 64px), 1): el monto del pipeline activo en la banda pavonada. Una por pantalla, sin cortar renglón.
- **Headline** (800, 28px en celular / 34px desde sm, 1.1): título de cada vista vía el encabezado de página. Solo, sin bajada.
- **Title** (800, 18–20px, 1.1): títulos de paneles ("Embudo", "A quién llamar hoy"), de diálogos y de estados vacíos.
- **Body** (400, 15px, 1.5): el tamaño de trabajo: celdas de tabla, campos, ítems de navegación, avisos. El cuerpo base del documento es 16px; ningún texto de lectura baja de 13px.
- **Body strong** (700, 15px): nombre de cada presupuesto o cliente en tarjetas y listas.
- **Meta** (400, 14px): cliente, etapa, encabezados de columna (600), contadores.
- **Label** (600, 13px): pastillas de estado, "hace N días" teñido según salud, ayudas y errores de campo.
- **Rótulo** (700, 13px, 0.08em, mayúsculas): sólo encabezados de grupo dentro de listas desplegables y de la paleta de comandos, y códigos de referencia cortos. No encabeza secciones de página.
- **Wordmark** (800, mayúsculas, 0.09em): CORRALAP en el logo, escalado con el isotipo (17 / 19 / 26 / 38px).

### Named Rules
**The Lonely Title Rule.** Un título de vista va solo. Nada de subtítulos explicativos ni rótulos encima; el contexto lo dan los datos.

**The Tabular Money Rule.** Todo monto, conteo o cantidad usa cifras tabulares y de caja alta (−0.01em). Los montos en tarjetas se escalan con el contenedor antes de cortarse.

## Layout

**Estructura.** Desde `lg` (1024px) un riel fijo pavonado de 248px a la izquierda; el contenido se centra hasta 1400px con márgenes de 40px y aire superior de 36px. Debajo de `lg`, barra superior pavonada de 56px (logo, buscar, usuario) y barra de pestañas inferior fija de 64px con cinco destinos; el contenido deja 96px más el área segura abajo para no quedar tapado. Márgenes laterales 16px en celular y 24px desde `sm`.

**Ritmo.** Entre bloques de una vista 24px. Paneles con 20px de relleno en celular y 24px desde `sm`. Separaciones internas en pasos de 6, 8, 12 y 16px. Listas con divisores de línea en vez de tarjetas apiladas cuando el contenido es homogéneo.

**Rutas, no paneles.** Detalle, alta y edición son páginas propias con "volver" arriba del título. Los únicos superpuestos son el diálogo de confirmación, los desplegables, el calendario y la paleta ⌘K.

**Cero desborde.** Ninguna vista genera scroll horizontal de página. Las tablas anchas pasan a lista compacta de un renglón por registro debajo de `xl` (1280px); las pastillas de filtro se desplazan de costado en celular y bajan de renglón desde `md`; la columna principal de una tabla ocupa el ancho sobrante y recorta con puntos suspensivos en vez de ensanchar la tabla. Inicio arma en `lg` dos columnas 5:7 (embudo y a quién llamar).

## Elevation & Depth

Híbrido sobrio: superficies claras levemente alzadas sobre el suelo zinc con sombra corta y fría (tintada con el pavonado), y profundidad fuerte sólo para lo que flota. El riel y la banda del pipeline no usan sombra: su profundidad es el contraste del pavonado con grano de acero.

### Shadow Vocabulary
- **Suave** (`box-shadow: 0 1px 2px rgb(22 33 43 / 0.05), 0 4px 14px -6px rgb(22 33 43 / 0.14)`): paneles, tablas, tarjetas en reposo, estados vacíos, segmento activo.
- **Alzada** (`box-shadow: 0 2px 6px rgb(22 33 43 / 0.08), 0 20px 44px -14px rgb(22 33 43 / 0.34)`): diálogos, avisos, desplegables, tooltip del embudo, hover de tarjeta de presupuesto.
- **Anillo de foco de campo** (`box-shadow: 0 0 0 3px rgb(22 33 43 / 0.14)`): campo enfocado, junto con borde tinta.

### Named Rules
**The Only-What-Floats Rule.** La sombra alzada es de lo que está por encima del contenido (diálogo, aviso, desplegable, tarjeta levantada). Una superficie en su lugar lleva sombra suave o ninguna.

**The Steel Grain Rule.** Las superficies pavonadas grandes (riel, barra superior, banda del pipeline) llevan el grano de acero de ruido fractal al 7%. Es textura, no dibujo: nunca se nota a primera vista.

## Shapes

Esquinas parejas y redondeadas, escalonadas por tamaño: 10px para todo lo que se toca (botones, campos, ítems del riel, stepper), 12px para tarjetas de presupuesto, avisos y el contenedor del segmentado, 16px para paneles, tablas, diálogos, estados vacíos y la banda del pipeline; 8px para botones de ícono chicos y segmentos internos; 5px para los ladrillos del embudo; píldora completa para pastillas de estado y de filtro. En celular el diálogo sube desde abajo con sólo las esquinas superiores redondeadas.

La geometría firma es el ladrillo: el isotipo es una C de cinco ladrillos macizos en traba (hilada superior larga + corta, alma del mismo grueso que la hilada, hilada inferior con juntas corridas) sobre una placa de 64 con radio 12, esquinas de ladrillo de 1.5 y curva exterior igual a la altura de una hilada. El embudo de Inicio repite el material: una hilada por etapa, un ladrillo por presupuesto. La punta (el círculo con núcleo) es la otra forma firma: disco plano de salud con punto interior más claro; tilde verde sobre pavonado para ganada, cruz tiza sobre línea para perdida.

## Components

### Buttons
Firmes y táctiles: peso 600–700, esquina de 10px, se hunden al 98% al presionar.
- **Shape:** esquina de 10px; alturas 36 (sm), 44 (md, por defecto) y 48px (lg); cuadrados de 44 y 36px para ícono.
- **Primario:** amarillo vial con texto pavonado en 700 y sombra mínima; hover a amarillo profundo. Uno por vista, arriba a la derecha ("Nuevo presupuesto").
- **Secundario:** chapa con borde línea fuerte y texto tinta; hover a chapa 2 con borde tiza.
- **Fantasma:** sólo texto tiza; hover a tinta sobre chapa 2.
- **Peligro / Éxito:** rojo o verde con texto blanco; éxito sólo para concretar una venta.
- **Claro:** blanco al 10% con borde blanco al 15%, para acciones sobre pavonado.
- **Hover / Focus:** transiciones de 150ms en color, borde y sombra; foco con contorno tinta de 2.5px a 2px de distancia (amarillo sobre pavonado). Deshabilitado al 45% de opacidad.

### Chips
- **Estado:** píldora de 28px, texto 13px/600, fondo velado y punto de 6px del tono. Tonos: verde/ámbar/rojo (salud), fuerte (pavonado, texto blanco), pausa (chapa 2 con punto vacío anillado), neutro (chapa 2, texto tiza).
- **Salud:** "Al día · hace 3 días", o sólo "hace 3 días" en listas compactas.
- **Filtro:** píldora de 36px, borde línea sobre chapa; seleccionada en pavonado con texto blanco y conteo en niebla.

### Cards / Containers
- **Corner Style:** 12px en tarjetas de presupuesto, 16px en paneles.
- **Background:** chapa sobre suelo zinc.
- **Shadow Strategy:** suave en reposo; alzada al pasar el puntero o al arrastrar (ver Elevation & Depth).
- **Border:** línea de 1px; línea fuerte al pasar el puntero.
- **Internal Padding:** 16px en tarjetas, 20–24px en paneles.
- **Tarjeta de presupuesto:** punta de 18px, nombre en 15px/700 hasta dos renglones, cliente en tiza, días teñidos según salud, monto en 800 que se escala con el ancho de la tarjeta. Toda la tarjeta es el enlace; el botón "pasar a la etapa siguiente" queda encima.

### Inputs / Fields
- **Style:** 44px de alto, chapa, borde línea fuerte, esquina 10px, texto 15px, placeholder gris medio. Etiqueta arriba en 14px/600; asterisco rojo si es obligatorio.
- **Focus:** borde tinta y halo pavonado al 14% de 3px; hover a borde tiza.
- **Error / Disabled:** borde rojo y mensaje 13px/600 en rojo tinta; deshabilitado en chapa 2 con texto tiza.
- **Variantes:** con prefijo "$" o sufijo de unidad (cifras tabulares), búsqueda con ícono, stepper − / + de 44px para el dedo. Desplegable y calendario propios con panel en sombra alzada; el día elegido va en pavonado.

### Navigation
- **Riel (desde lg):** 248px de pavonado con grano; logo horizontal arriba, buscador ⌘K de 44px en pavonado 2, ítems de 44px en 15px/600 niebla con ícono de 20px; activo en amarillo vial con texto pavonado 700; hover a pavonado 2 y blanco. Un segundo grupo (Equipo, Usuarios) separado por un divisor pavonado, según rol.
- **Celular:** barra superior pavonada de 56px y barra inferior de 64px con cinco pestañas (ícono + etiqueta de 11px); la activa lleva el ícono dentro de una píldora amarilla de 48×28px.
- **Paleta ⌘K:** buscador global superpuesto con grupos encabezados por rótulo.

### Table / Compact List
Tabla propia sobre TanStack: contenedor de chapa con esquina 16px, borde línea y sombra suave; encabezado en chapa 2 con etiquetas 14px/600 tiza que ordenan al tocarlas; filas de 15px con divisores línea, fila entera navegable con teclado; paginación abajo ("1–10 de 42"). Variante densa de un renglón para listados largos y una columna que absorbe el ancho y recorta. Debajo de `xl` se reemplaza por lista compacta: punta, nombre y cliente · etapa, pastilla de días, monto a la derecha.

### Punta y embudo (signature)
La punta pintada es la unidad de salud del sistema y aparece en tarjetas, listas, "A quién llamar hoy" y el embudo. El embudo de Inicio dibuja una hilada de 24px por etapa, un ladrillo de esquina 5px por presupuesto pintado con la base de su salud (orden: al día, en riesgo, estancado), etapa numerada en círculo pavonado, monto compacto a la derecha y el total por salud abajo en tres columnas.

### Toasts
Abajo a la derecha en escritorio (400px), sobre la barra inferior en celular. Esquina 12px, sombra alzada, entrada deslizando hacia arriba. Cada tipo con su fondo velado y su insignia redonda: éxito verde con tilde, error rojo con cruz, aviso naranja con triángulo, información chapa con insignia pavonada.

### Motion
Salidas con `cubic-bezier(0.16, 1, 0.3, 1)`: aparecer (fundido de 180ms), subir (12px, 260ms) para diálogos y avisos, desplegar (−4px y 98%, 160ms) para menús. Todo cae a 1ms con movimiento reducido.

## Do's and Don'ts

### Do:
- **Do** reservar el amarillo vial para el logo, el único botón primario de la vista y la ubicación actual en la navegación.
- **Do** pintar toda selección del usuario (filtro, segmento, fecha, switch) en pavonado con texto blanco.
- **Do** usar verde / naranja / rojo sólo para salud del seguimiento (≤7 d, 8–14 d, >14 d) y resultado de venta; rojo además para error y peligro.
- **Do** mantener 15px como tamaño de trabajo, 13px como piso, y 44px como objetivo táctil.
- **Do** llevar todo número en cifras tabulares y todo título en Montserrat 800 con −0.025em.
- **Do** resolver detalle, alta y edición como rutas con "volver", y convertir tablas anchas en listas compactas debajo de 1280px.
- **Do** usar el logo sólo en sus versiones horizontal, vertical e isotipo, a color o en monocromo negro sólido / blanco puro calado, con un alto de hilada de área de protección.

### Don't:
- **Don't** usar el amarillo para comunicar estado, salud o selección.
- **Don't** agregar subtítulos, bajadas ni textos explicativos debajo de los títulos de vista.
- **Don't** abrir paneles laterales (drawers) para detalle o edición.
- **Don't** permitir scroll horizontal de página en ningún ancho.
- **Don't** usar el rótulo en mayúsculas como encabezado sobre títulos de sección; queda para grupos de desplegables y referencias cortas.
- **Don't** dar al logo degradés, sombras, 3D, líneas finas, otros colores de placa, ni poner los ladrillos sin placa sobre fondo claro.
- **Don't** volver a la metáfora del óxido ni a paletas de semáforo desaturadas: las tres pinturas son planas.
