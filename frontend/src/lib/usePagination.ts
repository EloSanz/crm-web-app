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
 * La página es base 0, igual que en <Pagination>. La vuelta a la primera página se deriva en el
 * render comparando la clave guardada con la actual (sin efectos ni setState en el render), y si
 * la lista se achica y la página ya no existe, se ajusta a la última.
 */
export function usePagination<T>(items: T[], { pageSize = PAGE_SIZE, resetKey }: Options = {}) {
  const key = resetKey === undefined ? items : resetKey;
  const [state, setState] = useState<{ key: unknown; page: number }>({ key, page: 0 });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Object.is(state.key, key) ? Math.min(state.page, pageCount - 1) : 0;
  return {
    page,
    pageCount,
    pageSize,
    total: items.length,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    setPage: (next: number) => setState({ key, page: next }),
  };
}
