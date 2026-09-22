'use client';

import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Chip } from '@/components/ui/Chip';
import { RequireRole } from '@/components/users/RequireRole';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { StatTile } from '@/components/charts/StatTile';
import { bucketLabel, bucketTitle, fmtInt, fmtMoney, fmtPct } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchClientsMetrics } from '@/lib/api-metrics';
import { CLIENT_STATUS } from '@/lib/catalogs';
import { formatARS, formatDate, sentenceCase } from '@/lib/format';
import type { CompanyStatus } from '@/types/crm';
import type { ClientRow, ClientsMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { useMetricsHref } from '../_components/period';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, periodWord, plural, RowMain, RowValue } from '../_components/bits';

const col = createColumnHelper<TableSetup, ClientRow>();
const statusOf = (s: string) => CLIENT_STATUS[s as CompanyStatus] ?? { label: s, tone: 'neutro' as const };

export default function ClientesPage() {
  return (
    <RequireRole role="admin">
      <ClientesData />
    </RequireRole>
  );
}

function ClientesData() {
  const result = useMetrics(fetchClientsMetrics);
  return (
    <MetricsBody result={result} label="Cargando clientes">
      {(d) => <Clientes d={d} />}
    </MetricsBody>
  );
}

function Clientes({ d }: { d: ClientsMetrics }) {
  const href = useMetricsHref();
  const s = d.summary;
  const statuses = d.by_status.filter((g) => g.count > 0);
  const origins = d.by_origin.filter((g) => g.count > 0);

  const columns = col.columns([
    col.accessor('name', {
      header: 'Cliente',
      sortFn: 'text',
      cell: (i) => <RowMain title={i.getValue()} sub={`${statusOf(i.row.original.status).label} · ${i.row.original.origin}`} />,
    }),
    col.accessor('quotes', { header: 'Presupuestos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor('open_amount', { header: 'Abierto', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtMoney(i.getValue())}</Num> }),
    col.accessor('quoted_amount', { header: 'Cotizado', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtMoney(i.getValue())}</Num> }),
    col.accessor('won_amount', { header: 'Vendido', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{fmtMoney(i.getValue())}</Num> }),
    col.accessor('won_count', { header: 'Compras', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor((r) => r.last_won_at ?? '', { id: 'ultima', header: 'Última compra', sortFn: 'text', sortDescFirst: true, cell: (i) => <Num>{formatDate(i.row.original.last_won_at)}</Num> }),
  ]);

  return (
    <>
      <TileRow label="Resumen de clientes">
        <StatTile dark label="Compraron" value={s.buyers} format={fmtInt} caption={`De ${plural(s.clients, 'cliente', 'clientes')}`} />
        <StatTile label="Recompra" value={s.repeat_pct} format={fmtPct} caption={`${plural(s.repeat_buyers, 'cliente', 'clientes')} con 2 o más compras`} />
        <StatTile label="Clientes nuevos" value={s.new_clients} format={fmtInt} delta={{ previous: s.new_clients_previous, mode: 'abs', format: fmtInt }} trend={d.new_buckets.map((b) => b.count)} />
        <StatTile label="Vendido por cliente" value={s.avg_won_per_buyer} format={fmtMoney} />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Clientes que más compran"
          hint="En pesos"
          empty={d.top.length === 0}
          emptyText="Sin ventas ni presupuestos nuevos en este período"
          table={{ head: ['Cliente', 'Vendido', 'Cotizado', 'Compras'], rows: d.top.map((r) => [r.name, formatARS(r.won_amount), formatARS(r.quoted_amount), fmtInt(r.won_count_period)]) }}
        >
          <BarChart
            label="Clientes que más compran"
            valueLabel="vendido"
            format={fmtMoney}
            data={d.top.slice(0, 6).map((r) => ({
              key: r.company_id,
              label: r.name,
              href: href(`/indicadores/clientes/${r.company_id}`),
              value: r.won_amount,
              details: [
                { label: 'cotizado', value: fmtMoney(r.quoted_amount) },
                { label: 'compras', value: fmtInt(r.won_count_period) },
              ],
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Clientes nuevos"
          hint={sentenceCase(periodWord(d.granularity))}
          empty={s.new_clients === 0}
          emptyText="Sin clientes nuevos en este período"
          table={{ head: ['Período', 'Clientes nuevos'], rows: d.new_buckets.map((b) => [bucketTitle(b.start, d.granularity), fmtInt(b.count)]) }}
        >
          <BarChart
            orientation="vertical"
            label={`Clientes nuevos ${periodWord(d.granularity)}`}
            valueLabel="clientes nuevos"
            format={fmtInt}
            titleOf={(b) => bucketTitle(b.key, d.granularity)}
            data={d.new_buckets.map((b, i) => ({ key: b.start, label: bucketLabel(b.start, d.granularity, i), value: b.count }))}
          />
        </ChartCard>
        <ChartCard
          title="Por origen"
          empty={origins.length === 0}
          table={{ head: ['Origen', 'Clientes', 'Vendido', 'Abierto'], rows: origins.map((g) => [g.origin, fmtInt(g.count), formatARS(g.won_amount), formatARS(g.open_amount)]) }}
        >
          <BarChart
            label="Clientes por origen"
            valueLabel="clientes"
            format={fmtInt}
            data={origins.map((g) => ({ key: g.origin, label: g.origin, value: g.count, details: [{ label: 'vendido', value: fmtMoney(g.won_amount) }] }))}
          />
        </ChartCard>
        <ChartCard
          title="Por estado"
          empty={statuses.length === 0}
          table={{ head: ['Estado', 'Clientes', 'Vendido', 'Abierto'], rows: statuses.map((g) => [statusOf(g.status).label, fmtInt(g.count), formatARS(g.won_amount), formatARS(g.open_amount)]) }}
        >
          <BarChart
            label="Clientes por estado"
            valueLabel="clientes"
            format={fmtInt}
            data={statuses.map((g) => ({ key: g.status, label: statusOf(g.status).label, value: g.count, details: [{ label: 'vendido', value: fmtMoney(g.won_amount) }] }))}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Clientes"
        rows={d.clients}
        columns={columns}
        rowKey={(r) => r.company_id}
        rowLabel={(r) => `${r.name}: vendido ${fmtMoney(r.won_amount)}`}
        href={(r) => href(`/indicadores/clientes/${r.company_id}`)}
        initialSort={[{ id: 'won_amount', desc: true }]}
        alignRight={['quotes', 'open_amount', 'quoted_amount', 'won_amount', 'won_count', 'ultima']}
        grow="name"
        emptyText="Todavía no hay clientes con presupuestos"
        item={(r) => (
          <>
            <RowMain title={r.name} sub={<Chip tone={statusOf(r.status).tone} className="h-6 px-2 text-[12px]">{statusOf(r.status).label}</Chip>} />
            <RowValue value={fmtMoney(r.won_amount)} sub={`${fmtMoney(r.open_amount)} abierto`} />
          </>
        )}
      />
    </>
  );
}
