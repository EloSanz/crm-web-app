# Convenciones de desarrollo

El TP **no exige** un stack ni una arquitectura determinada. Estas son buenas
prácticas independientes de la tecnología: adaptalas al lenguaje y framework que
use el grupo (Java/Spring, .NET, Node, etc.). El objetivo es que las **reglas
invariantes queden implementadas de verdad**, no solo en la interfaz.

## Arquitectura en capas

Separá responsabilidades, aunque sea de forma simple:

- **Presentación / UI**: pantallas y validaciones de conveniencia (no de
  seguridad).
- **API / controladores**: reciben la petición y delegan.
- **Servicios / lógica de negocio**: acá viven las reglas (transiciones de etapa,
  cierres, permisos, escritura de historial).
- **Acceso a datos / repositorios**: consultas y persistencia.
- **Modelo / entidades**: las entidades de `modelo-de-datos.md`.

Regla práctica: si una validación protege una regla de negocio, va en el backend
(servicio), no en el frontend.

## Autenticación y permisos

- Contraseñas con **hash + salt** usando un algoritmo pensado para eso (p. ej.
  bcrypt/argon2/PBKDF2 según el stack). Nunca texto plano ni hash simple sin salt.
- Autorización verificada en el servidor en **cada** endpoint sensible, según el
  rol. Ocultar botones en la UI no es seguridad.
- El vendedor solo ve/opera sobre lo permitido por su rol (p. ej. sus clientes
  asignados).

## Baja lógica

- No borres registros con historial comercial. Usá un campo de **estado** (o
  `activo`/`eliminado` con marca de tiempo y usuario si preferís).
- En los listados por defecto, filtrá los dados de baja; permití verlos si hace
  falta.

## Historial (etapas y actividades)

- El historial de etapas es **append-only**: cada cambio inserta un registro
  nuevo; nunca se actualiza el anterior.
- Escribí el registro de historial **dentro de la misma transacción** que cambia la
  etapa actual, para no dejar estados inconsistentes.
- Las actividades también son inmutables como hecho histórico; si hay que
  corregir, se hace de forma trazable.

## Trazabilidad y auditoría

- Guardá **usuario + fecha/hora** en creación y en cambios importantes.
- Para oportunidades cerradas, cualquier modificación debe requerir autorización y
  quedar registrada.

## Integridad y validaciones clave (recordatorio)

- Oportunidad: responsable obligatorio, al menos empresa o contacto, etapa actual
  válida.
- Coherencia estado↔etapa en cada transición.
- Ganada → fecha real de cierre (y valor final si aplica).
- Perdida → fecha real de cierre + motivo de pérdida.

## Búsqueda, filtros y paginación

Están **dentro del alcance**. Implementá paginación del lado del servidor para
listados grandes (empresas, contactos, oportunidades) y filtros por responsable,
etapa, estado y origen en el embudo.

## Sobre la funcionalidad de IA (opcional, al final)

Si el grupo la hace, debe: resolver una necesidad real, estar relacionada
directamente con el CRM, usar información **ya registrada** en el sistema,
integrarse en un flujo existente, producir un resultado útil para algún usuario,
justificar por qué requiere IA y **permitir que el usuario revise el resultado**
antes de aplicarlo. No la empieces antes de tener lo principal completo y probado.
