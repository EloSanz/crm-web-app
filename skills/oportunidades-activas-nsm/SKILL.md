---
name: crm-oportunidades-activas-nsm
description: >-
  Especificación y guía de desarrollo para la North Star Metric (NSM): tracking
  de oportunidades abiertas de venta con actividad registrada en los últimos N días
  e historial comprobable en la UI. Define reglas de cálculo, semáforo de salud,
  consultas de backend y diseño de componentes para el corralón.
---

# Feature NSM: Oportunidades Abiertas con Actividad Reciente

Esta skill define la especificación conceptual, funcional y técnica de la **North Star Metric (NSM)** del CRM para corralones: el seguimiento de **oportunidades abiertas vivas con actividad comercial reciente**.

---

## 🌟 1. Fundamento de Negocio y Definición de la NSM

### El problema en el corralón
En la venta de materiales a contratistas, el mayor cuello de botella no es emitir presupuestos, sino la **falta de seguimiento**:
- Un presupuesto emitido que no recibe contacto en 7 a 10 días suele ser una venta perdida (el contratista cotizó en otro corralón o frenó la obra).
- Medir solo *"Monto total en embudo"* genera una **falsa ilusión de ingresos futuros**, porque acumula cotizaciones viejas o abandonadas ("leads podridos").

### La North Star Metric (NSM)
> **Monto total ($) y cantidad (#) de Oportunidades Abiertas con Actividad Comercial Registrada en los últimos $N$ días.**

Esta métrica representa el **Pipeline Activo Real**: el flujo de dinero que efectivamente tiene probabilidades de convertirse en ventas concretadas a corto plazo, permitiendo prever ingresos futuros y capacidad operativa con base fidedigna.

---

## 🚦 2. Estados de Salud y Semáforo Comercial

Para que la métrica sea intuitiva y accionable por los vendedores y el responsable comercial, cada oportunidad abierta se clasifica dinámicamente según la antigüedad de su **última actividad registrada**:

| Estado | Ventana de Tiempo | Indicador Visual | Significado para el Negocio |
| :--- | :--- | :---: | :--- |
| **🟢 Activa / Al día** | $\le 7$ días | Badge verde (`hace X días`) | Cotización caliente, negociación en curso. |
| **🟡 En riesgo / Por enfriarse** | $8$ a $14$ días | Badge amarillo (`hace X días`) | Requiere contacto urgente del vendedor para no perder la venta. |
| **🔴 Estancada / Fría** | $> 14$ días (o sin actividad) | Badge rojo (`inactiva`) | Presupuesto abandonado; candidato a cierre por pérdida o reactivación. |

> **Parámetro $N$**: Por defecto $N = 7$ días (configurable a nivel vista o filtro en $7$, $15$ o $30$ días).

---

## 📐 3. Modelo de Datos y Cálculo en Backend

La feature aprovecha las entidades ya establecidas en el modelo (`opportunities`, `activities`, `contacts`, `companies`) **sin violar el alcance del TP**:

### 1. Actividades que califican
Una interacción registrada en la tabla `activities` asociada a la oportunidad o al cliente (contratista):
- **Llamada telefónica**
- **WhatsApp / Mensaje** (registro manual de haber hablado, no integración API)
- **Visita a la obra**
- **Atención en el local / mostrador**
- **Envío / actualización de presupuesto**
- **Nota interna de avance comercial**

### 2. Atributos calculados en la API
Al consultar las oportunidades (`GET /api/opportunities`), el backend calcula y adjunta:
- `last_activity_at` (timestamp ISO o `null`): fecha/hora de la interacción más reciente.
- `days_since_last_activity` (integer): días transcurridos desde `last_activity_at` hasta hoy.
- `health_status` (`"healthy" | "warning" | "stale"`): clasificación según el semáforo.

### 3. Endpoint de resumen de la NSM
Para el encabezado del CRM o tablero de control:
```http
GET /api/metrics/active-pipeline?days=7
```
**Respuesta:**
```json
{
  "window_days": 7,
  "total_open_opportunities": 24,
  "active_opportunities_count": 16,
  "active_opportunities_amount": 42500000.00,
  "pipeline_health_ratio": 0.6667,
  "stale_opportunities_count": 8,
  "stale_opportunities_amount": 11200000.00
}
```

---

## 🖥️ 4. Experiencia de Usuario (UI / UX)

La métrica debe ser **fácilmente comprobable y visible** en la interfaz:

### A. En el Tablero Kanban (Embudo de Ventas)
1. **Header del Embudo (Widget NSM)**:
   - Indicador destacado en la parte superior:
     - 💼 **Pipeline Activo**: `$ 42.500.000` *(16 presupuestos con seguimiento al día)*.
     - 📈 **Salud del Embudo**: `67% al día` | `8 presupuestos sin seguimiento`.
2. **Tarjeta de la Oportunidad (Card)**:
   - En el pie de la tarjeta, un chip sutil con icono:
     - 🟢 `Contacto hace 2 días`
     - 🟡 `Sin contacto hace 9 días`
     - 🔴 `Sin actividad > 15 días`
3. **Filtro rápido en el Kanban**:
   - Botón toggle: `Todas` | `Solo activas (≤ 7d)` | `Requieren atención (> 7d)`.

### B. Línea de Tiempo Comprobable (Detalle / Drawer)
Al hacer clic en cualquier oportunidad o contratista:
- **Timeline cronológico inverso**: Muestra cada llamada, mensaje, visita o actualización con:
  - Tipo de actividad con icono correspondiente.
  - Fecha y hora exacta.
  - Usuario / vendedor que la registró.
  - Descripción y resultado de la interacción.
- De esta manera, el dueño del corralón o el responsable comercial puede auditar con un solo clic el respaldo de la métrica.

---

## 🛡️ 5. Cumplimiento de Invariantes del TP

- **Invariante 1 (Historial inmutable)**: Las actividades son hechos históricos pasados que nunca se editan ni se sobreescriben.
- **Invariante 3 (Permisos en backend)**: El cálculo del pipeline activo respeta la visibilidad del usuario (el vendedor solo computa sus oportunidades activas; el administrador/responsable comercial ve el total del equipo).
- **Fuera de alcance respetado**: **No** incluye agendas futuras, **no** incluye notificaciones push ni bots de WhatsApp automáticos. Es puramente analítica de seguimiento sobre hechos reales registrados.
