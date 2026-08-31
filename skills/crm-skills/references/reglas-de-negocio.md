# Reglas de negocio

Validá todo esto en el **backend**, no solo en la interfaz.

## Reglas generales (las 15 de la consigna)

1. Toda oportunidad debe tener un **responsable**.
2. Toda oportunidad debe estar asociada, como mínimo, a una **empresa o un
   contacto**.
3. Toda oportunidad debe tener una **etapa actual**.
4. Una oportunidad **abierta** debe estar en una **etapa abierta**.
5. Una oportunidad **ganada** debe registrar **fecha de cierre** y **valor final**
   (si el negocio usa valores monetarios).
6. Una oportunidad **perdida** debe registrar **fecha de cierre** y **motivo de
   pérdida**.
7. Cada **cambio de etapa** se conserva en el historial.
8. Cada **actividad** registra el usuario y la fecha.
9. Las actividades se relacionan con una empresa, contacto u oportunidad.
10. Los registros con historial comercial **no se eliminan físicamente** (baja
    lógica vía estado).
11. Los vendedores solo acceden a la información permitida por su rol.
12. Los permisos se validan en el **backend**, no solo en el frontend.
13. Las contraseñas se almacenan con un **mecanismo seguro** (hash).
14. Una oportunidad **cerrada** no se modifica **sin autorización**.
15. Los **cambios importantes** deben permitir identificar al usuario que los
    realizó.

## Reglas para el cambio de etapa

- Cada oportunidad tiene una **única etapa actual**.
- La etapa debe ser **compatible con el estado** de la oportunidad.
- Una oportunidad **abierta no puede** estar en una etapa ganada o perdida.
- Una oportunidad **ganada** debe registrar la **fecha real de cierre**.
- Una oportunidad **perdida** debe registrar la **fecha real de cierre** y el
  **motivo de pérdida**.
- Cada cambio se **conserva en el historial**.
- Una oportunidad **cerrada no vuelve** a una etapa abierta **sin autorización**.
- Si se modifica una oportunidad cerrada, el cambio **queda registrado**.

Los grupos pueden agregar reglas propias de su industria.

## Cómo aplicarlas (guía práctica)

- **Al crear una oportunidad**: exigí responsable, al menos una asociación
  (empresa/contacto) y una etapa inicial válida (abierta).
- **Al cambiar de etapa**: verificá compatibilidad estado↔etapa, escribí el
  registro de historial (etapa anterior, nueva, fecha/hora, usuario, observación)
  y recién después actualizá la etapa actual.
- **Al ganar**: setear estado Ganada, fecha real de cierre y, si aplica, valor
  final.
- **Al perder**: setear estado Perdida, fecha real de cierre y motivo de pérdida
  (obligatorio).
- **Al "eliminar"** cualquier registro con historial: cambiá el estado en vez de
  borrar.
- **En cada operación sensible**: guardá quién y cuándo.
