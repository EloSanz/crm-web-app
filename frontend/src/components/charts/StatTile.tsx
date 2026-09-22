'use client';

import React from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useCountUp } from './hooks';
import { fmtInt, fmtOne } from './format';

export interface StatDelta {
  /** Valor del período anterior. */
  previous: number | null;
  /** pct: variación porcentual · pp: diferencia en puntos (para tasas) · abs: diferencia simple. */
  mode: 'pct' | 'pp' | 'abs';
  format?: (n: number) => string;
}

interface StatTileProps {
  label: string;
  value: number | null;
  format: (n: number) => string;
  delta?: StatDelta;
  /** Aclaración corta debajo de la cifra ("12 presupuestos"). */
  caption?: string;
  /** Serie por período para la mini línea (la última marca es el período actual). */
  trend?: number[];
  dark?: boolean;
}

function deltaText(value: number, d: StatDelta): { dir: 'up' | 'down' | 'flat'; text: string } | null {
  if (d.previous === null || d.previous === undefined) return null;
  if (d.mode === 'pct') {
    if (d.previous === 0) return null;
    const change = (value - d.previous) / Math.abs(d.previous);
    const rounded = Math.round(change * 100);
    return { dir: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat', text: `${fmtInt(Math.abs(rounded))}%` };
  }
  if (d.mode === 'pp') {
    const points = (value - d.previous) * 100;
    const rounded = Math.round(points);
    return { dir: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat', text: `${fmtInt(Math.abs(rounded))} p. p.` };
  }
  const diff = value - d.previous;
  const text = d.format ? d.format(Math.abs(diff)) : fmtOne(Math.abs(diff));
  return { dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat', text };
}

/**
 * Cifra principal de un indicador: etiqueta, número que cuenta hasta su valor, variación contra el
 * período anterior (neutra: flecha + texto, sin semáforo) y, si hay, mini línea de tendencia.
 */
export function StatTile({ label, value, format, delta, caption, trend, dark = false }: StatTileProps) {
  const animated = useCountUp(value ?? 0);
  const change = value !== null && delta ? deltaText(value, delta) : null;
  const Icon = change?.dir === 'up' ? ArrowUpRight : change?.dir === 'down' ? ArrowDownRight : Minus;

  return (
    <div
      className={clsx(
        '@container flex min-w-0 flex-col rounded-2xl p-4 sm:p-5',
        dark ? 'sobre-pavonado grano-pavonado text-white' : 'border border-linea bg-chapa shadow-suave'
      )}
    >
      <p className={clsx('text-sm font-semibold', dark ? 'text-niebla' : 'text-tiza')}>{label}</p>
      <p className="cifra titular mt-1 whitespace-nowrap text-[clamp(22px,15cqi,34px)] leading-none">
        <span aria-hidden>{value === null ? '—' : format(animated)}</span>
        <span className="sr-only">{value === null ? 'sin datos' : format(value)}</span>
      </p>
      {change && (
        <p className={clsx('mt-2 flex min-w-0 items-center gap-1 text-[13px]', dark ? 'text-niebla' : 'text-tiza')}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className={clsx('cifra shrink-0 whitespace-nowrap font-bold', dark ? 'text-white' : 'text-tinta')}>
            <span className="sr-only">{change.dir === 'up' ? 'subió ' : change.dir === 'down' ? 'bajó ' : 'sin cambios, '}</span>
            {change.text}
          </span>
          <span className="sr-only @min-[13rem]:not-sr-only @min-[13rem]:truncate">vs. período anterior</span>
        </p>
      )}
      {caption && <p className={clsx('mt-2 truncate text-[13px]', dark ? 'text-niebla' : 'text-tiza')}>{caption}</p>}
      {trend && trend.length > 1 && <Sparkline values={trend} dark={dark} className="mt-auto pt-3" />}
    </div>
  );
}

/** Mini línea de tendencia: trazo en el tono de fondo y el período actual marcado. Decorativa (el dato está en los gráficos). */
export function Sparkline({ values, dark = false, className }: { values: number[]; dark?: boolean; className?: string }) {
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [values.length === 1 ? 50 : (i / (values.length - 1)) * 100, 26 - ((v - min) / span) * 24] as const);
  const last = pts[pts.length - 1];
  return (
    <div className={className} aria-hidden>
      <div className="relative h-7">
        <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <polyline
            points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={dark ? '#5a7189' : '#bfc7c4'}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="graf-fundido"
          />
        </svg>
        <span
          className="graf-fundido absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${last[0]}%`, top: `${(last[1] / 28) * 100}%`, background: dark ? '#ffffff' : '#16212b', animationDelay: '500ms' }}
        />
      </div>
    </div>
  );
}
