'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { MetricsError } from '@/lib/api-metrics';
import type { MetricsDays } from '@/types/metrics';
import { useDays } from './period';

interface MetricsState<T> {
  days: MetricsDays | null;
  data: T | null;
  error: Error | null;
}

export interface MetricsResult<T> {
  data: T | null;
  error: Error | null;
  /** Primera carga, todavía sin datos. */
  loading: boolean;
  /** Cambió el período y se está trayendo: se muestra lo anterior atenuado, sin saltos. */
  refreshing: boolean;
  /** Período de los datos en pantalla. */
  shownDays: MetricsDays | null;
  retry: () => void;
}

/** Trae un indicador para el período elegido. `load` debe ser estable (fuera del componente o memorizado). */
export function useMetrics<T>(load: (days: MetricsDays) => Promise<T>): MetricsResult<T> {
  const days = useDays();
  const [state, setState] = useState<MetricsState<T>>({ days: null, data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    load(days)
      .then((data) => {
        if (alive) setState({ days, data, error: null });
      })
      .catch((error: unknown) => {
        if (alive) setState((prev) => ({ days: prev.days, data: prev.data, error: error instanceof Error ? error : new Error('No se pudieron cargar los indicadores') }));
      });
    return () => {
      alive = false;
    };
  }, [load, days, attempt]);

  return {
    data: state.data,
    error: state.error,
    loading: state.data === null && state.error === null,
    refreshing: state.data !== null && state.days !== days && state.error === null,
    shownDays: state.days,
    retry: () => setAttempt((a) => a + 1),
  };
}

/** Carga, error y datos de una vista de Indicadores. Al cambiar de período los gráficos se vuelven a dibujar. */
export function MetricsBody<T>({ result, label, children }: { result: MetricsResult<T>; label: string; children: (data: T) => React.ReactNode }) {
  if (result.loading) return <LoadingBlock label={label} />;
  if (!result.data) {
    const status = result.error instanceof MetricsError ? result.error.status : 0;
    if (status === 403 || status === 404) {
      return (
        <EmptyState
          illustration="busqueda"
          title={status === 403 ? 'Estos indicadores no están habilitados para tu rol' : 'No encontramos ese registro'}
          action={
            <ButtonLink href="/indicadores" variant="secundario">
              Volver a Indicadores
            </ButtonLink>
          }
        />
      );
    }
    return (
      <EmptyState
        illustration="presupuestos"
        title="No pudimos cargar los indicadores"
        description={result.error?.message}
        action={
          <Button variant="secundario" onClick={result.retry}>
            Reintentar
          </Button>
        }
      />
    );
  }
  return (
    <div key={result.shownDays ?? 0} aria-busy={result.refreshing} className={clsx('space-y-6 transition-opacity duration-200', result.refreshing && 'opacity-60')}>
      {children(result.data)}
    </div>
  );
}
