"""Límites de los listados.

La paginación de los listados (empresas, contactos, materiales, obras y presupuestos) es del lado del
cliente, a 10 registros por vista, porque el volumen del TP es chico: el frontend pide hasta
LIST_MAX_LIMIT de una vez para que la búsqueda y los filtros trabajen sobre el total y nada quede
cortado en silencio. Si el volumen creciera, habría que paginar en el servidor con limit/offset.
"""

# Tope de `limit` que aceptan los GET de listados (el frontend pide exactamente este valor).
LIST_MAX_LIMIT = 1000
# Valor por defecto para quien consuma la API sin indicar `limit`.
LIST_DEFAULT_LIMIT = 100
