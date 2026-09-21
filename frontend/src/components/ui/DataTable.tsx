'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
}

/**
 * Tabla del sistema de diseño: se ordena tocando el encabezado de cada columna y se pagina abajo.
 * La fila entera es navegable con el teclado cuando hay onRowClick.
 */
export function DataTable<T extends object>({
  data,
  columns,
  initialSort = [],
  pageSize = 10,
  onRowClick,
  rowLabel,
  caption,
  alignRight = [],
  emptyText = 'Sin resultados',
  dense = false,
  grow,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState(initialSort);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useTable({
    features: tableSetup,
    columns,
    data,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: true,
  });

  const rows = table.getRowModel().rows;
  const total = data.length;
  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
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
      {total > pagination.pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-linea px-4 py-2.5">
          <span className="cifra text-sm text-tiza">
            {from}–{to} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-tinta hover:bg-chapa-2 disabled:opacity-35 cursor-pointer"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="cifra px-2 text-sm font-semibold">
              {pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-tinta hover:bg-chapa-2 disabled:opacity-35 cursor-pointer"
              aria-label="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
