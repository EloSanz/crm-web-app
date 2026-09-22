'use client';

import React, { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { Segmented } from '@/components/ui/Segmented';
import type { MetricsDays } from '@/types/metrics';

export const PERIODS: MetricsDays[] = [30, 90, 180, 365];
export const DEFAULT_DAYS: MetricsDays = 90;

export function parseDays(raw: string | null | undefined): MetricsDays {
  const n = Number(raw);
  return (PERIODS as number[]).includes(n) ? (n as MetricsDays) : DEFAULT_DAYS;
}

export const DaysContext = createContext<MetricsDays>(DEFAULT_DAYS);

/** Período elegido (?dias=) para todas las pestañas de Indicadores. */
export function useDays(): MetricsDays {
  return useContext(DaysContext);
}

/** Enlace dentro de Indicadores que conserva el período. */
export function useMetricsHref() {
  const days = useDays();
  return (path: string) => `${path}?dias=${days}`;
}

/** Filtro de período (30 / 90 / 180 / 365 días): una sola fila arriba de todo lo que filtra. */
export function PeriodFilter() {
  const days = useDays();
  const pathname = usePathname() || '/indicadores';
  return (
    <div className="flex items-center gap-2">
      <Segmented
        label="Período en días"
        value={String(days)}
        options={PERIODS.map((d) => ({ value: String(d), label: <span className="cifra">{d}</span>, href: `${pathname}?dias=${d}` }))}
      />
      <span className="text-sm font-semibold text-tiza">días</span>
    </div>
  );
}
