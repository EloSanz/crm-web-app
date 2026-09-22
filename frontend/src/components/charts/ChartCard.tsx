'use client';

import React, { useId, useState } from 'react';
import clsx from 'clsx';
import { ChartColumn, Table2 } from 'lucide-react';

export interface LegendItem {
  label: string;
  color: string;
  /** Forma de la muestra: igual a la marca del gráfico (barra, línea o marca de mediana). */
  shape?: 'box' | 'line' | 'tick';
}

export interface ChartTable {
  head: string[];
  rows: (string | number)[][];
  /** Índices de columnas numéricas (alineadas a la derecha). Por defecto, todas menos la primera. */
  numeric?: number[];
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={clsx('flex flex-wrap gap-x-4 gap-y-1.5', className)} aria-label="Referencias">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[13px] font-semibold text-tiza">
          <span
            aria-hidden
            className={clsx(
              'shrink-0',
              item.shape === 'line' ? 'h-[3px] w-4 rounded-full' : item.shape === 'tick' ? 'h-3.5 w-[3px] rounded-full' : 'h-2.5 w-2.5 rounded-[3px]'
            )}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

interface ChartCardProps {
  title: string;
  /** Unidad o aclaración mínima ("en pesos", "días promedio"). Sin bajadas explicativas. */
  hint?: string;
  legend?: LegendItem[];
  table?: ChartTable;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  children: React.ReactNode;
}

/** Contenedor de un gráfico: título, referencias y el botón "Ver tabla" (su gemelo accesible). */
export function ChartCard({ title, hint, legend, table, empty, emptyText = 'Sin datos en este período', className, children }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const showTable = asTable && !!table && !empty;

  return (
    <figure aria-labelledby={titleId} className={clsx('min-w-0 rounded-2xl border border-linea bg-chapa p-4 shadow-suave sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <figcaption className="min-w-0">
          <h3 id={titleId} className="titular text-lg">
            {title}
          </h3>
          {hint && <p className="mt-0.5 text-[13px] text-tiza">{hint}</p>}
        </figcaption>
        {table && !empty && (
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="-mr-1.5 -mt-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-tiza transition-colors hover:bg-chapa-2 hover:text-tinta cursor-pointer"
          >
            {asTable ? <ChartColumn className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
            {asTable ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        )}
      </div>

      {legend && !empty && !showTable && <Legend items={legend} className="mt-3" />}

      <div className="mt-4">
        {empty ? (
          <p className="flex min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-linea px-4 text-center text-[15px] text-tiza">{emptyText}</p>
        ) : showTable ? (
          <DataGrid title={title} table={table} />
        ) : (
          children
        )}
      </div>
    </figure>
  );
}

function DataGrid({ title, table }: { title: string; table: ChartTable }) {
  const numeric = table.numeric ?? table.head.map((_, i) => i).filter((i) => i > 0);
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-linea">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{title}</caption>
        <thead className="sticky top-0 bg-chapa-2">
          <tr>
            {table.head.map((h, i) => (
              <th key={h} scope="col" className={clsx('whitespace-nowrap px-3 py-2 font-semibold text-tiza', numeric.includes(i) && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-3 py-2 font-semibold text-tinta">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className={clsx('px-3 py-2 text-tinta', numeric.includes(i) && 'cifra whitespace-nowrap text-right')}>
                    {cell}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
