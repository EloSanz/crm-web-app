'use client';

import React from 'react';
import type { createColumnHelper } from '@tanstack/react-table';
import { Chip } from '@/components/ui/Chip';
import { HealthChip } from '@/components/punta/Punta';
import { stageShort } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { formatARS, formatDate } from '@/lib/format';
import type { QuoteHistoryRow } from '@/types/metrics';
import { Num, RowMain } from './bits';

/** Estado de un presupuesto en listas: salud si está abierto; resultado de venta si cerró. */
export function QuoteStatus({ row }: { row: QuoteHistoryRow }) {
  if (row.status === 'ganada') return <Chip tone="verde">Vendido</Chip>;
  if (row.status === 'perdida') return <Chip tone="neutro">Perdido</Chip>;
  return <HealthChip health={row.health} days={row.days_since_last_activity} compact />;
}

const ORDER = { abierta: 0, ganada: 1, perdida: 2 } as const;

/** Columnas del historial de presupuestos de un cliente o una obra. */
export function quoteColumns(col: ReturnType<typeof createColumnHelper<TableSetup, QuoteHistoryRow>>) {
  return col.columns([
    col.accessor('title', { header: 'Presupuesto', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} sub={i.row.original.seller} /> }),
    col.accessor('stage_name', { header: 'Etapa', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{stageShort(i.getValue())}</span> }),
    col.accessor((r) => ORDER[r.status], { id: 'estado', header: 'Estado', sortFn: 'basic', cell: (i) => <QuoteStatus row={i.row.original} /> }),
    col.accessor((r) => r.created_at ?? '', { id: 'creado', header: 'Creado', sortFn: 'text', sortDescFirst: true, cell: (i) => <Num>{formatDate(i.row.original.created_at)}</Num> }),
    col.accessor('amount', { header: 'Monto', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{formatARS(i.getValue())}</Num> }),
  ]);
}
