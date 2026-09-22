'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';

interface ListTableProps<T extends object> {
  title: string;
  rows: T[];
  /** Columnas de la tabla de escritorio (createColumnHelper<TableSetup, T>). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[];
  rowKey: (row: T) => string;
  rowLabel: (row: T) => string;
  href?: (row: T) => string;
  /** Contenido de un renglón de la lista compacta (celular y tablet). */
  item: (row: T) => React.ReactNode;
  initialSort?: { id: string; desc: boolean }[];
  alignRight?: string[];
  grow?: string;
  emptyText: string;
  pageSize?: number;
  /** Acciones a la derecha del título (enlace "ver todos"). */
  action?: React.ReactNode;
}

/**
 * Ranking de la pestaña: tabla ordenable desde 1280px y lista compacta de un renglón por registro
 * debajo; cada fila lleva a su detalle.
 */
export function ListTable<T extends object>({
  title,
  rows,
  columns,
  rowKey,
  rowLabel,
  href,
  item,
  initialSort,
  alignRight,
  grow,
  emptyText,
  pageSize = 10,
  action,
}: ListTableProps<T>) {
  const router = useRouter();
  const headingId = useId();
  const [all, setAll] = useState(false);
  const visible = all ? rows : rows.slice(0, 8);

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="titular text-lg">
          {title}
        </h2>
        {action}
      </div>
      <div className="hidden xl:block">
        <DataTable
          data={rows}
          columns={columns}
          caption={title}
          initialSort={initialSort}
          alignRight={alignRight}
          grow={grow}
          dense
          pageSize={pageSize}
          emptyText={emptyText}
          onRowClick={href ? (row: T) => router.push(href(row)) : undefined}
          rowLabel={rowLabel}
        />
      </div>
      <div className="xl:hidden">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-linea bg-chapa px-5 py-8 text-center text-[15px] text-tiza">{emptyText}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
            <ul className="divide-y divide-linea" aria-label={title}>
              {visible.map((row) => (
                <li key={rowKey(row)}>
                  {href ? (
                    <Link href={href(row)} aria-label={rowLabel(row)} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-chapa-2">
                      <div className="flex min-w-0 flex-1 items-center gap-3">{item(row)}</div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-tiza" aria-hidden />
                    </Link>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-4 py-3">{item(row)}</div>
                  )}
                </li>
              ))}
            </ul>
            {rows.length > 8 && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="flex h-11 w-full items-center justify-center border-t border-linea text-sm font-semibold text-tiza transition-colors hover:bg-chapa-2 hover:text-tinta cursor-pointer"
              >
                {all ? 'Mostrar menos' : `Mostrar los ${rows.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Fila de cifras principales: 2 columnas en celular, 4 desde 1024px. */
export function TileRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {children}
    </section>
  );
}

/** Grilla de gráficos: apilados hasta 1280px, de a dos desde ahí. */
export function ChartGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>;
}
