'use client';

import React from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  /** Color de la serie: se dibuja como un trazo corto delante del valor, nunca tiñe el texto. */
  color?: string;
}

export interface TooltipState {
  title: string;
  rows: TooltipRow[];
  /** Posición del ancla dentro del contenedor del gráfico, en píxeles. */
  x: number;
  y: number;
}

/**
 * Globo pavonado del gráfico (mismo lenguaje que el tooltip del embudo). El valor manda y la etiqueta
 * lo sigue. Es un agregado: todo lo que muestra también está en "Ver tabla".
 */
export function ChartTooltip({ tip, width }: { tip: TooltipState | null; width: number }) {
  if (!tip) return null;
  const ratio = width ? tip.x / width : 0.5;
  const shift = ratio > 0.62 ? '-100%' : ratio < 0.38 ? '0%' : '-50%';
  const nudge = ratio > 0.62 ? 12 : ratio < 0.38 ? -12 : 0;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 w-max max-w-[260px] rounded-lg bg-pavonado px-3 py-2 text-[13px] leading-snug text-white shadow-alzada animate-aparecer"
      style={{ left: tip.x + nudge, top: tip.y, transform: `translate(${shift}, calc(-100% - 10px))` }}
    >
      <p className="font-bold">{tip.title}</p>
      {tip.rows.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {tip.rows.map((row) => (
            <li key={row.label} className="flex items-center gap-2">
              {row.color && <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden />}
              <span className="cifra font-bold">{row.value}</span>
              <span className="min-w-0 truncate text-niebla">{row.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
