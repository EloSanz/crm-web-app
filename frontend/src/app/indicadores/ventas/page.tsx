'use client';

import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { LineArea } from '@/components/charts/LineArea';
import { StatTile } from '@/components/charts/StatTile';
import { CHART } from '@/components/charts/palette';
import { bucketLabel, bucketTitle, fmtDays, fmtInt, fmtMoney, fmtPct } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchSalesMetrics } from '@/lib/api-metrics';
import { formatARS, formatDate, sentenceCase } from '@/lib/format';
import type { SalesMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { useMetricsHref } from '../_components/period';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, orDash, OutcomeChart, periodWord, plural, RowMain, RowValue, shortDate } from '../_components/bits';

type Sale = SalesMetrics['sales'][number];
const col = createColumnHelper<TableSetup, Sale>();

export default function VentasPage() {
  const result = useMetrics(fetchSalesMetrics);
  return (
    <MetricsBody result={result} label="Cargando ventas">
      {(d) => <Ventas d={d} />}
    </MetricsBody>
  );
}

function Ventas({ d }: { d: SalesMetrics }) {
  const href = useMetricsHref();
  const s = d.summary;
  const p = d.previous;
  const closes = s.won_count + s.lost_count;
  const hasRate = d.buckets.some((b) => b.close_rate !== null);

  const columns = col.columns([
    col.accessor('title', {
      header: 'Presupuesto',
      sortFn: 'text',
      cell: (i) => <RowMain title={i.getValue()} sub={i.row.original.client} />,
    }),
    col.accessor('seller', { header: 'Vendedor', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{i.getValue()}</span> }),
    col.accessor((r) => r.closed_at ?? '', { id: 'cierre', header: 'Cerrado', sortFn: 'text', sortDescFirst: true, cell: (i) => <Num>{formatDate(i.row.original.closed_at)}</Num> }),
    col.accessor((r) => r.cycle_days ?? -1, { id: 'ciclo', header: 'Ciclo', sortFn: 'basic', cell: (i) => <Num>{orDash(i.row.original.cycle_days, fmtDays)}</Num> }),
    col.accessor('amount', { header: 'Monto', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{formatARS(i.getValue())}</Num> }),
  ]);

  return (
    <>
      <TileRow label="Resumen de ventas">
        <StatTile dark label="Vendido" value={s.won_amount} format={fmtMoney} delta={{ previous: p.won_amount, mode: 'pct' }} trend={d.buckets.map((b) => b.won_amount)} />
        <StatTile label="Tasa de cierre" value={s.close_rate} format={fmtPct} delta={{ previous: p.close_rate, mode: 'pp' }} caption={closes ? `${fmtInt(s.won_count)} de ${plural(closes, 'cerrado', 'cerrados')}` : undefined} />
        <StatTile label="Ticket promedio" value={s.avg_ticket} format={fmtMoney} delta={{ previous: p.avg_ticket, mode: 'pct' }} />
        <StatTile label="Ciclo de venta" value={s.avg_cycle_days} format={fmtDays} delta={{ previous: p.avg_cycle_days, mode: 'abs', format: fmtDays }} />
      </TileRow>

      <ChartGrid>
        <OutcomeChart buckets={d.buckets} granularity={d.granularity} className="xl:col-span-2" />
        <ChartCard
          title="Tasa de cierre"
          hint={sentenceCase(periodWord(d.granularity))}
          empty={!hasRate}
          emptyText="Todavía no hay presupuestos cerrados en este período"
          table={{
            head: ['Período', 'Cierre', 'Ganados', 'Perdidos'],
            rows: d.buckets.map((b) => [bucketTitle(b.start, d.granularity), orDash(b.close_rate, fmtPct), fmtInt(b.won_count), fmtInt(b.lost_count)]),
          }}
        >
          <LineArea
            label="Tasa de cierre por período"
            labels={d.buckets.map((b, i) => bucketLabel(b.start, d.granularity, i))}
            titles={d.buckets.map((b) => bucketTitle(b.start, d.granularity))}
            series={[{ key: 'cierre', label: 'Cierre', color: CHART.magnitude, values: d.buckets.map((b) => b.close_rate) }]}
            format={fmtPct}
            yMax={1}
          />
        </ChartCard>
        <ChartCard
          title="Motivos de pérdida"
          empty={d.loss_reasons.length === 0}
          emptyText="Sin pérdidas en este período"
          table={{ head: ['Motivo', 'Perdidos', 'Monto'], rows: d.loss_reasons.map((r) => [r.reason, fmtInt(r.count), formatARS(r.amount)]) }}
        >
          <BarChart
            label="Motivos de pérdida"
            valueLabel="perdidos"
            format={fmtInt}
            data={d.loss_reasons.map((r) => ({ key: r.reason, label: r.reason, value: r.count, details: [{ label: 'en juego', value: fmtMoney(r.amount) }] }))}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Ventas concretadas"
        rows={d.sales}
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) => `${r.title}, ${formatARS(r.amount)}`}
        href={(r) => href(`/indicadores/presupuestos/${r.id}`)}
        initialSort={[{ id: 'amount', desc: true }]}
        alignRight={['ciclo', 'amount']}
        grow="title"
        emptyText="Sin ventas concretadas en este período"
        item={(r) => (
          <>
            <RowMain title={r.title} sub={`${r.client} · ${r.seller}`} />
            <RowValue value={fmtMoney(r.amount)} sub={shortDate(r.closed_at)} />
          </>
        )}
      />
    </>
  );
}
