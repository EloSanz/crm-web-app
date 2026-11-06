'use client';

import { useState } from 'react';
import { PAGE_SIZE } from '@/components/ui/Pagination';

interface Options {
  pageSize?: number;
  /**
   * Qué hace volver a la primera página: por defecto, un cambio de referencia de `items`. Conviene
   * pasar la búsqueda y los filtros (ej. `${search}|${filter}`) para que recargar los datos tras
   * editar o dar de baja no te saque de la página en la que estabas.
   */
  resetKey?: unknown;
}

/**
 * Pagina en el cliente una lista ya filtrada: el volumen del TP es chico y el backend manda todo.
 * La página es base 0, igual que en <Pagination>. Cuando cambia la clave se vuelve a la primera
 * página y se guarda la clave nueva (ajuste de estado en el render, el patrón que recomienda React
 * para estado derivado): así, volver a la búsqueda anterior no reabre la página vieja. Si la lista
 * se achica y la página ya no existe, se ajusta a la última.
 */
export function usePagination<T>(items: T[], { pageSize = PAGE_SIZE, resetKey }: Options = {}) {
  const key = resetKey === undefined ? items : resetKey;
  const [state, setState] = useState<{ key: unknown; page: number }>({ key, page: 0 });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const changed = !Object.is(state.key, key);
  if (changed) setState({ key, page: 0 });
  const page = changed ? 0 : Math.min(state.page, pageCount - 1);
  return {
    page,
    pageCount,
    pageSize,
    total: items.length,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    setPage: (next: number) => setState({ key, page: next }),
  };
}
