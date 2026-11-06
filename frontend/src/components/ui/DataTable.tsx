'use client';

import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { usePagination } from '@/lib/usePagination';
import { PAGE_SIZE, Pagination } from './Pagination';

/** Funciones de la tabla: orden por columna y paginación. */
export const tableSetup = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type TableSetup = typeof tableSetup;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumns = any[];

interface DataTableProps<T extends object> {
  data: T[];
  columns: AnyColumns;
  /** Orden inicial, ej. [{ id: 'amount', desc: true }]. */
  initialSort?: { id: string; desc: boolean }[];
  /** Registros por página: 10 en todo el CRM; cambiarlo sólo con una razón clara. */
  pageSize?: number;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  caption: string;
  /** Columnas alineadas a la derecha (ids). */
  alignRight?: string[];
  emptyText?: string;
  /** Filas bajas, de un renglón: para listados largos que se recorren con la vista. */
  dense?: boolean;
  /** Columna que ocupa el ancho sobrante y recorta su texto en vez de ensanchar la tabla. */
  grow?: string;
  /** Búsqueda y filtros de la pantalla: al cambiar se vuelve a la primera página (ver usePagination). */
  resetKey?: unknown;
}

/**
 * Tabla del sistema de diseño: se ordena tocando el encabezado de cada columna y se pagina abajo.
 * La fila entera es navegable con el teclado cuando hay onRowClick.
 * La paginación es del lado del cliente (el volumen del TP es chico): `data` trae todo lo filtrado.
 */
export function DataTable<T extends object>({
  data,
  columns,
  initialSort = [],
  pageSize = PAGE_SIZE,
  onRowClick,
  rowLabel,
  caption,
  alignRight = [],
  emptyText = 'Sin resultados',
  dense = false,
  grow,
  resetKey,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState(initialSort);
  // Vuelve a la primera página cuando cambian los datos (otra búsqueda o filtro); ver usePagination.
  const { page: pageIndex, pageCount, total, setPage } = usePagination(data, { pageSize, resetKey });
  const anchorRef = useRef<HTMLDivElement>(null);
  const pagination = { pageIndex, pageSize };

  const table = useTable({
    features: tableSetup,
    columns,
    data,
    state: { sorting, pagination },
    // Ordenar de nuevo vuelve a la primera página.
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(0);
    },
    onPaginationChange: (updater) => setPage((typeof updater === 'function' ? updater(pagination) : updater).pageIndex),
    autoResetPageIndex: false,
  });

  const rows = table.getRowModel().rows;

  return (
    <div ref={anchorRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-linea bg-chapa-2">
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const right = alignRight.includes(header.column.id);
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      className={clsx('px-4 py-2.5 first:pl-5 last:pr-5', right && 'text-right', header.column.id === grow && 'w-full')}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={clsx(
                            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md py-1 text-sm font-semibold transition-colors cursor-pointer',
                            sorted ? 'text-tinta' : 'text-tiza hover:text-tinta',
                            right && 'flex-row-reverse'
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        <span className="whitespace-nowrap text-sm font-semibold text-tiza">
                          <table.FlexRender header={header} />
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-linea">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10 text-center text-[15px] text-tiza">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row.original as T) : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original as T) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter') onRowClick(row.original as T);
                        }
                      : undefined
                  }
                  className={clsx('transition-colors', onRowClick && 'cursor-pointer hover:bg-chapa-2/70 focus-visible:bg-chapa-2')}
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={clsx(
                        'px-4 align-middle text-[15px] first:pl-5 last:pr-5',
                        dense ? 'py-2' : 'py-3',
                        alignRight.includes(cell.column.id) && 'text-right',
                        cell.column.id === grow && 'w-full max-w-0'
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={pageIndex} pageCount={pageCount} total={total} pageSize={pageSize} onChange={setPage} anchorRef={anchorRef} className="border-t border-linea px-4 py-3 sm:px-5" />
    </div>
  );
}

/**
 * Celda de acciones (menú ⋯, enlaces) dentro de una fila clickeable: frena el clic y el Enter para
 * que no abran el detalle. React propaga los eventos del menú (un portal) por este árbol.
 */
export function CellActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
