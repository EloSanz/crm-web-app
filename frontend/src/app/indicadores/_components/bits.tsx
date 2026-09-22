'use client';

import React from 'react';
import { ChartCard } from '@/components/charts/ChartCard';
import { StackedBar } from '@/components/charts/StackedBar';
import { CHART } from '@/components/charts/palette';
import { bucketLabel, bucketTitle, fmtDays, fmtInt, fmtMoney, fmtPct } from '@/components/charts/format';
import { formatARS } from '@/lib/format';
import type { Granularity, OutcomeBucket } from '@/types/metrics';

export const dash = '—';
export const orDash = <T,>(value: T | null | undefined, fmt: (v: T) => string) => (value === null || value === undefined ? dash : fmt(value));
export const plural = (n: number, one: string, many: string) => `${fmtInt(n)} ${n === 1 ? one : many}`;
/** Fecha corta para listas compactas: "14 jul". */
export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '') : dash;
export const periodWord = (g: Granularity) => (g === 'week' ? 'por semana' : 'por mes');

/** Nombre principal y dato secundario de un renglón (lista compacta o celda de tabla). */
export function RowMain({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-bold leading-snug">{title}</p>
      {sub && <p className="truncate text-[13px] text-tiza">{sub}</p>}
    </div>
  );
}

/** Cifra a la derecha de un renglón, con un dato chico debajo. */
export function RowValue({ value, sub }: { value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="shrink-0 text-right">
      <p className="cifra whitespace-nowrap text-[15px] font-bold">{value}</p>
      {sub && <p className="cifra whitespace-nowrap text-[13px] text-tiza">{sub}</p>}
    </div>
  );
}

export const Num = ({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) => (
  <span className={strong ? 'cifra whitespace-nowrap font-bold' : 'cifra whitespace-nowrap'}>{children}</span>
);

/** Vendido (hacia arriba, verde) y perdido (hacia abajo, rojo) por período: el resultado de venta. */
export function OutcomeChart({
  buckets,
  granularity,
  title = 'Vendido y perdido',
  className,
}: {
  buckets: OutcomeBucket[];
  granularity: Granularity;
  title?: string;
  className?: string;
}) {
  const empty = buckets.every((b) => b.won_count === 0 && b.lost_count === 0);
  return (
    <ChartCard
      title={title}
      className={className}
      hint={`En pesos, ${periodWord(granularity)}`}
      empty={empty}
      emptyText="Sin ventas ni pérdidas en este período"
      legend={[
        { label: 'Vendido', color: CHART.won },
        { label: 'Perdido', color: CHART.lost },
      ]}
      table={{
        head: ['Período', 'Vendido', 'Ventas', 'Perdido', 'Perdidos', 'Cierre'],
        rows: buckets.map((b) => [
          bucketTitle(b.start, granularity),
          formatARS(b.won_amount),
          fmtInt(b.won_count),
          formatARS(b.lost_amount),
          fmtInt(b.lost_count),
          orDash(b.close_rate, fmtPct),
        ]),
      }}
    >
      <StackedBar
        label={`${title} ${periodWord(granularity)}`}
        series={[
          { key: 'won', label: 'Vendido', color: CHART.won },
          { key: 'lost', label: 'Perdido', color: CHART.lost, negative: true },
        ]}
        data={buckets.map((b, i) => ({
          key: b.start,
          label: bucketLabel(b.start, granularity, i),
          title: bucketTitle(b.start, granularity),
          values: { won: b.won_amount, lost: b.lost_amount },
          details: [
            { label: 'ventas', value: fmtInt(b.won_count) },
            { label: 'perdidos', value: fmtInt(b.lost_count) },
          ],
        }))}
        format={fmtMoney}
      />
    </ChartCard>
  );
}

export { fmtDays, fmtInt, fmtMoney, fmtPct };
