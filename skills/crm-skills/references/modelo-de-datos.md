# Modelo de datos

Entidades principales del CRM, con sus atributos mínimos, estados y relaciones.
"Si corresponde" significa opcional. Podés agregar atributos si aportan, pero no
omitas los mínimos.

## Índice

- [Usuario](#usuario)
- [Empresa](#empresa)
- [Contacto](#contacto)
- [Producto o servicio](#producto-o-servicio)
- [Oportunidad](#oportunidad)
- [Etapa comercial](#etapa-comercial)
- [Historial de etapas](#historial-de-etapas)
- [Actividad](#actividad)
- [Motivo de pérdida](#motivo-de-pérdida)
- [Origen comercial](#origen-comercial)
- [Relaciones resumidas](#relaciones-resumidas)

## Usuario

Persona que ingresa al sistema y opera según su rol. El grupo define qué datos se
necesitan para **identificarlo, autenticarlo, conocer su estado y controlar sus
permisos**.

- Roles posibles: Administrador, Vendedor, Responsable comercial.
- Contraseña almacenada con hash seguro (nunca texto plano).
- Debe tener un estado (p. ej. activo / inactivo) para habilitar o deshabilitar el
  acceso sin borrar el usuario.

## Empresa

Organización o cliente corporativo con el que existe o podría existir relación
comercial. Datos mínimos:

- Razón social o nombre comercial
- CUIT (si corresponde)
- Industria o actividad
- Correo electrónico
- Teléfono
- Dirección
- Sitio web (si corresponde)
- Estado
- Responsable comercial
- Origen
- Observaciones

## Contacto

Persona con la que la organización mantiene relación comercial. Puede pertenecer a
una empresa o actuar como **cliente individual** (sin empresa). Datos mínimos:

- Nombre
- Apellido
- Documento (si corresponde)
- Cargo
- Correo electrónico
- Teléfono
- Empresa relacionada (si corresponde)
- Responsable comercial
- Estado
- Origen
- Observaciones

### Estados de empresa y contacto

Como mínimo: **Potencial, Cliente, Inactivo, No contactar**. La baja se hace
cambiando el estado (baja lógica), nunca eliminando el registro.

## Producto o servicio

Aquello que la organización ofrece comercialmente (un sistema, un seguro, una
propiedad, una capacitación, un tratamiento, un servicio profesional…). Un mismo
producto/servicio puede aparecer en varias oportunidades.

- En la primera entrega pueden estar **precargados**.
- En un CRM genérico, su gestión debe ser configurable.

## Oportunidad

Posibilidad concreta de venta o contratación. Es la entidad central del proceso
comercial. Datos mínimos:

- Título
- Empresa o contacto relacionado (al menos uno)
- Responsable comercial
- Producto o servicio
- Valor estimado (si corresponde)
- Etapa actual
- Probabilidad de cierre (si el grupo decide usarla)
- Fecha estimada de cierre
- Fecha real de cierre
- Origen
- Estado
- Observaciones
- Motivo de pérdida (si corresponde)

### Estados de una oportunidad

**Abierta, Ganada, Perdida.** El estado debe ser coherente con la etapa (ver
`reglas-de-negocio.md`).

## Etapa comercial

Uno de los pasos del proceso de venta (el "embudo"). Cada grupo define las etapas
y su **orden** según el tipo de CRM.

Ejemplo de embudo genérico: Nuevo contacto → Contactado → Necesidad relevada →
Propuesta enviada → Negociación → Ganada / Perdida.

En un CRM genérico las etapas se **configuran** desde el sistema; en uno
especializado reflejan el proceso real de la industria (ver `especializacion.md`).

## Historial de etapas

Registra **cada** cambio de etapa de una oportunidad como registro independiente
(no se sobrescribe). Cada registro incluye:

- Oportunidad
- Etapa anterior
- Nueva etapa
- Fecha y hora
- Usuario que realizó el cambio
- Observación (si corresponde)

Debe permitir responder: en qué etapa comenzó, qué etapas atravesó, cuándo ocurrió
cada cambio, quién lo hizo y cuándo/cómo finalizó. **No alcanza con guardar solo la
etapa actual.**

## Actividad

Interacción comercial que **ya ocurrió** (hecho histórico, no acción pendiente).
Tipos mínimos: Llamada, Correo electrónico, Mensaje, Reunión presencial, Reunión
virtual, Demostración, Envío de propuesta, Nota interna, Otro tipo configurable.

Datos mínimos:

- Tipo
- Fecha y hora
- Usuario que la registró
- Empresa o contacto relacionado
- Oportunidad relacionada (si corresponde)
- Descripción
- Resultado

Las actividades se muestran **ordenadas cronológicamente** en el detalle del
contacto, de la empresa y de la oportunidad, para reconstruir la relación comercial.

## Motivo de pérdida

Razón por la que una oportunidad no se concretó. Ejemplos: Precio, Falta de
presupuesto, Elección de un competidor, Producto inadecuado, Falta de respuesta,
Decisión postergada. En un CRM genérico son configurables; el grupo define los
adecuados a su caso.

## Origen comercial

Medio por el cual llegó una empresa, contacto u oportunidad. Ejemplos: Sitio web,
Redes sociales, Publicidad, Recomendación, Evento, Prospección comercial, Cliente
existente. Varían según la industria.

## Relaciones resumidas

- Una **empresa** tiene varios **contactos**.
- Un **contacto** puede existir sin empresa (cliente individual).
- Una **empresa o contacto** puede tener **varias oportunidades** en el tiempo.
- Una **oportunidad** pertenece a una empresa o contacto, tiene un responsable
  (usuario), un producto/servicio, una etapa actual y un historial de etapas.
- Una **actividad** se relaciona con una empresa, un contacto o una oportunidad.
- Una **oportunidad** tiene muchos registros en el **historial de etapas**.
