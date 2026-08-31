# Entregas

Dos entregas. Usalas como columna vertebral de la planificación.

## Primera entrega — 24/9

**Objetivo:** primera versión funcional que permita registrar clientes y gestionar
oportunidades de forma básica.

### Requerido

- **Acceso:** inicio de sesión funcional con al menos un usuario habilitado. No es
  obligatorio implementar todavía todos los roles y permisos.
- **Empresas y contactos:** crear/modificar empresas y contactos, consultar
  listados y detalles, relacionar contactos con empresas. Se pueden usar solo los
  datos indispensables.
- **Productos o servicios:** pueden estar **precargados**; no hace falta su gestión
  completa.
- **Oportunidades:** crear/modificar, relacionar con empresa o contacto, asignar
  responsable, seleccionar producto/servicio, consultar listado y detalle.
- **Embudo comercial:** ver oportunidades agrupadas por etapa, cambiar de etapa,
  persistir los cambios en la base. Las etapas pueden estar precargadas.

### Demostración esperada

1. Iniciar sesión.
2. Registrar una empresa y un contacto.
3. Crear una oportunidad.
4. Visualizarla en el embudo.
5. Cambiarla de etapa.
6. Comprobar que la información quedó guardada.

### NO se requiere todavía

Roles y permisos completos; actividades e historial comercial; historial de
cambios de etapa; configuraciones generales; cierre completo de oportunidades; IA.

## Entrega final — 12/11

**Objetivo:** el CRM completo según la consigna general.

### Requerido

- Gestión de usuarios; roles (administrador, vendedor, responsable comercial) y
  **permisos según rol**.
- Gestión completa de empresas y contactos.
- Gestión de productos o servicios.
- Asignación de responsables comerciales.
- Gestión completa de oportunidades.
- Embudo comercial **configurable**.
- Cambio de etapas **con historial**.
- Registro de **actividades** realizadas.
- **Historial comercial** de empresas, contactos y oportunidades.
- Cierre de oportunidades ganadas o perdidas + **registro de motivos de pérdida**.
- Gestión de etapas, tipos de actividad, orígenes y motivos de pérdida.
- Búsqueda, filtros y **paginación**.
- **Adaptación real** al tipo de CRM / industria elegida.
- IA: **opcional**, solo después de completar lo principal.

### Notas de evaluación

No se exige documentación adicional ni una arquitectura tecnológica determinada.
Se evalúa el **funcionamiento integral** del producto y el cumplimiento de la
consigna.
