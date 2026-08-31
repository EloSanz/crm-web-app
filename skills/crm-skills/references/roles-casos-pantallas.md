# Roles, casos de uso y pantallas

## Roles y permisos

El sistema contempla como mínimo tres roles. Los permisos se validan en el
backend (regla 12).

### Administrador

- Crea y modifica usuarios; asigna roles.
- Configura etapas comerciales, tipos de actividad, motivos de pérdida y orígenes.
- Accede a toda la información.
- Asigna y reasigna contactos y oportunidades.

### Vendedor

- Registra empresas y contactos.
- Consulta los clientes **asignados**.
- Crea y actualiza oportunidades; las cambia de etapa.
- Registra actividades.
- Consulta el historial comercial.
- Marca oportunidades como ganadas o perdidas.
- Solo accede a la información permitida por su rol.

### Responsable comercial

- Consulta la información de **todo el equipo**.
- Supervisa las oportunidades abiertas.
- Visualiza el embudo comercial.
- Consulta el historial de cada negociación.
- Asigna y reasigna oportunidades.
- Revisa las oportunidades ganadas y perdidas.

## Casos de uso mínimos (17)

1. Iniciar sesión.
2. Crear y modificar un usuario.
3. Crear y modificar una empresa.
4. Crear y modificar un contacto.
5. Consultar el detalle de una empresa.
6. Consultar el detalle de un contacto.
7. Crear una oportunidad.
8. Asignar una oportunidad a un vendedor.
9. Modificar una oportunidad.
10. Cambiar una oportunidad de etapa.
11. Registrar una actividad.
12. Consultar el historial comercial.
13. Marcar una oportunidad como ganada.
14. Marcar una oportunidad como perdida.
15. Consultar el embudo comercial.
16. Buscar y filtrar empresas, contactos y oportunidades.
17. Utilizar la funcionalidad de IA (opcional).

## Pantallas mínimas

- Inicio de sesión
- Pantalla principal
- Gestión de usuarios
- Listado de empresas / Alta y edición de empresa / Detalle de empresa
- Listado de contactos / Alta y edición de contacto / Detalle de contacto
- Listado de productos o servicios
- Listado de oportunidades / Alta y edición de oportunidad / Detalle de oportunidad
- Tablero de oportunidades por etapa (embudo)
- Registro de actividad
- Historial comercial
- Configuración de etapas
- Configuración de tipos de actividad
- Configuración de orígenes
- Configuración de motivos de pérdida
- Interfaz de la funcionalidad de IA (opcional)

## Visualización del embudo

El sistema debe incluir: vista de lista de oportunidades, vista individual de cada
oportunidad, un tablero con las oportunidades **agrupadas por etapa**, y filtros
por responsable, etapa, estado y origen. El cambio de etapa puede hacerse desde el
detalle de la oportunidad o desde el tablero.

Recordá: búsqueda, filtros y **paginación** están dentro del alcance.
