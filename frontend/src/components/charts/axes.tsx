'use client';

import React, { useState } from 'react';
import { CHART } from './palette';

/** Margen izquierdo que necesitan las etiquetas del eje Y (12px, ~7px por carácter). */
export function axisWidth(labels: string[]): number {
  return Math.max(24, Math.max(...labels.map((l) => l.length)) * 7 + 10);
}

/** Rejilla horizontal y etiquetas del eje Y: líneas finas y lisas, un tono sobre la chapa. */
export function YGrid({
  ticks,
  y,
  left,
  right,
  format,
}: {
  ticks: number[];
  y: (v: number) => number;
  left: number;
  right: number;
  format: (v: number) => string;
}) {
  return (
    <g aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} stroke={t === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
          <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill={CHART.inkSoft} className="cifra">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Etiquetas del eje X; si no entran todas, se muestra una de cada k, contando desde la más reciente. */
export function XLabels({ labels, x, y, band }: { labels: string[]; x: (i: number) => number; y: number; band: number }) {
  const widest = Math.max(...labels.map((l) => l.length)) * 7 + 10;
  const every = Math.max(1, Math.ceil(widest / Math.max(1, band)));
  const last = labels.length - 1;
  return (
    <g aria-hidden>
      {labels.map((label, i) =>
        (last - i) % every === 0 ? (
          <text key={i} x={x(i)} y={y} textAnchor="middle" fontSize={12} fill={CHART.inkSoft}>
            {label}
          </text>
        ) : null
      )}
    </g>
  );
}

/**
 * Recorrido con teclado de las marcas de un gráfico: flechas, Inicio y Fin mueven la marca activa;
 * Escape la suelta. El puntero usa el mismo estado.
 */
export function useActiveIndex(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (count === 0) return;
    const current = active ?? -1;
    let next: number | null = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(count - 1, current + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, current <= 0 ? 0 : current - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else if (e.key === 'Escape') next = null;
    else return;
    e.preventDefault();
    setActive(next);
  };
  return {
    active,
    setActive,
    focusProps: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => setActive((a) => a ?? count - 1),
      onBlur: () => setActive(null),
    },
  };
}

/** Rectángulo con extremo de datos redondeado (4px) y base recta, hacia arriba o hacia abajo. */
export function barPath(x: number, y: number, w: number, h: number, radius: number, direction: 'up' | 'down' | 'right'): string {
  if (w <= 0 || h <= 0) return '';
  if (direction === 'right') {
    const r = Math.min(radius, w, h / 2);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  const r = Math.min(radius, h, w / 2);
  if (direction === 'up') {
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  return `M${x},${y}H${x + w}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x + r}Q${x},${y + h} ${x},${y + h - r}Z`;
}
