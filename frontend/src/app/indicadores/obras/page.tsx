'use client';

import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { RequireRole } from '@/components/users/RequireRole';
import { ChartCard } from '@/components/charts/ChartCard';
import { StackedBar } from '@/components/charts/StackedBar';
import { StatTile } from '@/components/charts/StatTile';
import { CHART } from '@/components/charts/palette';
import { fmtInt, fmtMoney, fmtPct } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchProjectsMetrics } from '@/lib/api-metrics';
import { PROJECT_STATUS, PROJECT_TYPES } from '@/lib/catalogs';
import { formatARS } from '@/lib/format';
import type { ProjectStatus, ProjectType } from '@/types/crm';
import type { ProjectRow, ProjectsMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { useMetricsHref } from '../_components/period';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, plural, RowMain, RowValue } from '../_components/bits';

const col = createColumnHelper<TableSetup, ProjectRow>();
const typeLabel = (t: string) => PROJECT_TYPES[t as ProjectType] ?? t;
const statusLabel = (s: string) => PROJECT_STATUS[s as ProjectStatus]?.label ?? s;

/** Vendido (resultado de venta, verde) y abierto (pavonado claro, todavía en juego). */
const SERIES = [
  { key: 'won', label: 'Vendido', color: CHART.won },
  { key: 'open', label: 'Abierto', color: CHART.soft },
];
const LEGEND = SERIES.map((s) => ({ label: s.label, color: s.color }));

export default function ObrasPage() {
  return (
    <RequireRole role="admin">
      <ObrasData />
    </RequireRole>
  );
}

function ObrasData() {
  const result = useMetrics(fetchProjectsMetrics);
  return (
    <MetricsBody result={result} label="Cargando obras">
      {(d) => <Obras d={d} />}
    </MetricsBody>
  );
}

function Obras({ d }: { d: ProjectsMetrics }) {
  const href = useMetricsHref();
  const s = d.summary;
  const inPlay = d.projects.filter((p) => p.open_amount + p.won_amount > 0).slice(0, 8);
  const types = d.by_type.filter((g) => g.projects > 0);
  const statuses = d.by_status.filter((g) => g.projects > 0);

  const columns = col.columns([
    col.accessor('name', { header: 'Obra', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} sub={i.row.original.company_name ?? 'Sin cliente'} /> }),
    col.accessor((r) => typeLabel(r.project_type), { id: 'tipo', header: 'Tipo', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{i.getValue()}</span> }),
    col.accessor((r) => statusLabel(r.status), { id: 'estado', header: 'Estado', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{i.getValue()}</span> }),
    col.accessor('quotes', { header: 'Presupuestos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor('open_amount', { header: 'Abierto', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtMoney(i.getValue())}</Num> }),
    col.accessor('won_amount', { header: 'Vendido', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{fmtMoney(i.getValue())}</Num> }),
  ]);

  const groupTable = (rows: { label: string; projects: number; quotes: number; won_amount: number; open_amount: number }[], head: string) => ({
    head: [head, 'Obras', 'Presupuestos', 'Vendido', 'Abierto'],
    rows: rows.map((g) => [g.label, fmtInt(g.projects), fmtInt(g.quotes), formatARS(g.won_amount), formatARS(g.open_amount)]),
  });
  const typeRows = types.map((g) => ({ ...g, label: typeLabel(g.project_type) }));
  const statusRows = statuses.map((g) => ({ ...g, label: statusLabel(g.status) }));

  return (
    <>
      <TileRow label="Resumen de obras">
        <StatTile dark label="Abierto en obras" value={s.open_amount} format={fmtMoney} caption={`${plural(s.projects_with_quotes, 'obra', 'obras')} con presupuestos`} />
        <StatTile label="Vendido en obras" value={s.won_amount} format={fmtMoney} />
        <StatTile label="Cotizado en obras" value={s.quoted_amount} format={fmtMoney} />
        <StatTile label="Presupuestos sin obra" value={s.without_project_pct} format={fmtPct} caption="De los creados en el período" />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Obras con más en juego"
          hint="En pesos"
          className="xl:col-span-2"
          empty={inPlay.length === 0}
          emptyText="Ninguna obra tiene presupuestos abiertos ni ventas en este período"
          legend={LEGEND}
          table={groupTable(
            inPlay.map((p) => ({ label: p.name, projects: 1, quotes: p.quotes, won_amount: p.won_amount, open_amount: p.open_amount })),
            'Obra'
          )}
        >
          <StackedBar
            orientation="horizontal"
            label="Vendido y abierto por obra"
            series={SERIES}
            format={fmtMoney}
            data={inPlay.map((p) => ({
              key: p.project_id,
              label: p.name,
              href: href(`/indicadores/obras/${p.project_id}`),
              values: { won: p.won_amount, open: p.open_amount },
              details: [{ label: 'presupuestos', value: fmtInt(p.quotes) }],
            }))}
          />
        </ChartCard>
        <ChartCard title="Por tipo de obra" hint="En pesos" empty={types.length === 0} legend={LEGEND} table={groupTable(typeRows, 'Tipo')}>
          <StackedBar
            orientation="horizontal"
            label="Vendido y abierto por tipo de obra"
            series={SERIES}
            format={fmtMoney}
            data={typeRows.map((g) => ({
              key: g.project_type,
              label: g.label,
              values: { won: g.won_amount, open: g.open_amount },
              details: [{ label: 'obras', value: fmtInt(g.projects) }],
            }))}
          />
        </ChartCard>
        <ChartCard title="Por estado de obra" hint="En pesos" empty={statuses.length === 0} legend={LEGEND} table={groupTable(statusRows, 'Estado')}>
          <StackedBar
            orientation="horizontal"
            label="Vendido y abierto por estado de obra"
            series={SERIES}
            format={fmtMoney}
            data={statusRows.map((g) => ({
              key: g.status,
              label: g.label,
              values: { won: g.won_amount, open: g.open_amount },
              details: [{ label: 'obras', value: fmtInt(g.projects) }],
            }))}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Obras"
        rows={d.projects}
        columns={columns}
        rowKey={(r) => r.project_id}
        rowLabel={(r) => `${r.name}: abierto ${fmtMoney(r.open_amount)}`}
        href={(r) => href(`/indicadores/obras/${r.project_id}`)}
        initialSort={[{ id: 'open_amount', desc: true }]}
        alignRight={['quotes', 'open_amount', 'won_amount']}
        grow="name"
        emptyText="Todavía no hay obras cargadas"
        item={(r) => (
          <>
            <RowMain title={r.name} sub={`${typeLabel(r.project_type)} · ${statusLabel(r.status)}`} />
            <RowValue value={fmtMoney(r.open_amount)} sub={plural(r.quotes, 'presupuesto', 'presupuestos')} />
          </>
        )}
      />
    </>
  );
}
