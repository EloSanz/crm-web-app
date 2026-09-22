'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { inkOn, SEQUENTIAL, sequentialColor } from './palette';
import { ChartTooltip, type TooltipState } from './Tooltip';
import { useChartWidth } from './hooks';
import { stagger } from './format';

export interface HeatCell {
  value: number | null;
  count?: number;
}

interface HeatmapProps {
  rows: { key: string; label: string; href?: string }[];
  cols: { key: string; label: string; short: string }[];
  cell: (rowKey: string, colKey: string) => HeatCell;
  /** Texto dentro de la celda (corto). */
  format: (n: number) => string;
  /** Texto del tooltip (largo). */
  formatLong?: (n: number) => string;
  countLabel?: (n: number) => string;
  label: string;
  /** Qué mide la escala ("Días promedio en la etapa"). */
  scaleLabel: string;
}

/**
 * Mapa de calor en grilla (filas × columnas) con una rampa de un solo tono pavonado: más oscuro, más
 * valor. Cada celda lleva su número escrito, así que el color nunca es el único canal.
 */
export function Heatmap({ rows, cols, cell, format, formatLong = format, countLabel, label, scaleLabel }: HeatmapProps) {
  const [ref, width] = useChartWidth();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const values = rows.flatMap((r) => cols.map((c) => cell(r.key, c.key).value)).filter((v): v is number => v !== null);
  const max = Math.max(0, ...values);
  const template = { gridTemplateColumns: `minmax(92px, 1.5fr) repeat(${cols.length}, minmax(0, 1fr))` };

  const show = (el: HTMLElement, rowLabel: string, colLabel: string, c: HeatCell) => {
    setTip({
      title: `${rowLabel} · ${colLabel}`,
      rows:
        c.value === null
          ? [{ label: 'sin presupuestos en la etapa', value: '—' }]
          : [
              { label: 'promedio', value: formatLong(c.value) },
              ...(c.count !== undefined && countLabel ? [{ label: countLabel(c.count), value: String(c.count) }] : []),
            ],
      x: el.offsetLeft + el.offsetWidth / 2,
      y: el.offsetTop,
    });
  };

  return (
    <div>
      <div ref={ref} className="relative" role="table" aria-label={label}>
        <div role="rowgroup">
          <div role="row" className="grid gap-[3px] pb-1.5" style={template}>
            <span role="columnheader">
              <span className="sr-only">Vendedor</span>
            </span>
            {cols.map((c, i) => (
              <span key={c.key} role="columnheader" title={c.label} className="flex min-w-0 items-center justify-center gap-1.5 text-[13px] font-semibold text-tiza">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pavonado text-[12px] font-bold text-white" aria-hidden>
                  {i + 1}
                </span>
                <span className="hidden min-w-0 truncate sm:inline">{c.short}</span>
                <span className="sr-only sm:hidden">{c.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div role="rowgroup" className="space-y-[3px]">
          {rows.map((r, ri) => (
            <div key={r.key} role="row" className="grid items-center gap-[3px]" style={template}>
              <span role="rowheader" className="min-w-0 pr-2">
                {r.href ? (
                  <Link href={r.href} className="block truncate text-[14px] font-semibold hover:underline">
                    {r.label}
                  </Link>
                ) : (
                  <span className="block truncate text-[14px] font-semibold">{r.label}</span>
                )}
              </span>
              {cols.map((c, ci) => {
                const data = cell(r.key, c.key);
                const fill = data.value === null ? undefined : sequentialColor(max ? data.value / max : 0);
                const handlers = {
                  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget, r.label, c.label, data),
                  onMouseLeave: () => setTip(null),
                  onFocus: (e: React.FocusEvent<HTMLElement>) => show(e.currentTarget, r.label, c.label, data),
                  onBlur: () => setTip(null),
                };
                return (
                  <span
                    key={c.key}
                    role="cell"
                    tabIndex={0}
                    aria-label={`${r.label}, ${c.label}: ${data.value === null ? 'sin datos' : formatLong(data.value)}`}
                    className="graf-celda flex h-11 min-w-0 items-center justify-center rounded-[5px] text-[13px] font-bold outline-offset-1 transition-shadow hover:shadow-[inset_0_0_0_2px_#16212b]"
                    style={{
                      background: fill ?? 'var(--color-chapa-2)',
                      color: fill ? inkOn(fill) : 'var(--color-tiza)',
                      animationDelay: stagger(ri + ci, 35, 280),
                    }}
                    {...handlers}
                  >
                    <span className="cifra truncate px-1">{data.value === null ? '—' : format(data.value)}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <ChartTooltip tip={tip} width={width} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-tiza">{scaleLabel}</span>
          <span className="cifra text-[13px] text-tiza">{format(0)}</span>
          <span className="flex h-2.5 overflow-hidden rounded-[3px]" aria-hidden>
            {SEQUENTIAL.slice(1).map((c) => (
              <span key={c} className="h-full w-5" style={{ background: c }} />
            ))}
          </span>
          <span className="cifra text-[13px] text-tiza">{format(max)}</span>
        </div>
        <span className="flex items-center gap-2 text-[13px] text-tiza">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-chapa-2 ring-1 ring-linea" aria-hidden />
          Sin datos
        </span>
      </div>
      <p className="mt-2 text-[13px] text-tiza sm:hidden">{cols.map((c, i) => `${i + 1} ${c.short}`).join(' · ')}</p>
    </div>
  );
}
