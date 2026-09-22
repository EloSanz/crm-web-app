'use client';

import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { StackedBar } from '@/components/charts/StackedBar';
import { StatTile } from '@/components/charts/StatTile';
import { HEALTH_COLOR, HEALTH_ORDER } from '@/components/charts/palette';
import { fmtInt, fmtMoney, fmtPct } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchSellersMetrics } from '@/lib/api-metrics';
import { HEALTH_META } from '@/lib/health';
import { ROLE_LABELS } from '@/lib/catalogs';
import type { SellerRow, SellersMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { useMetricsHref } from '../_components/period';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, orDash, plural, RowMain, RowValue } from '../_components/bits';

const col = createColumnHelper<TableSetup, SellerRow>();

export default function VendedoresPage() {
  const result = useMetrics(fetchSellersMetrics);
  return (
    <MetricsBody result={result} label="Cargando vendedores">
      {(d) => <Vendedores d={d} />}
    </MetricsBody>
  );
}

function Vendedores({ d }: { d: SellersMetrics }) {
  const href = useMetricsHref();
  const s = d.summary;
  const withPipeline = d.sellers.filter((r) => r.pipeline_amount > 0);
  const withSales = [...d.sellers].filter((r) => r.won_amount > 0).sort((a, b) => b.won_amount - a.won_amount);
  const roleOf = (r: SellerRow) => (r.role ? ROLE_LABELS[r.role] ?? r.role : 'Sin usuario activo');

  const columns = col.columns([
    col.accessor('name', { header: 'Responsable', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} sub={roleOf(i.row.original)} /> }),
    col.accessor('open_count', { header: 'Abiertos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor('pipeline_amount', { header: 'Pipeline', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{fmtMoney(i.getValue())}</Num> }),
    col.accessor('stale_count', {
      header: 'Estancados',
      sortFn: 'basic',
      sortDescFirst: true,
      cell: (i) => <span className={i.getValue() ? 'cifra font-bold text-rojo-tinta' : 'cifra text-tiza'}>{fmtInt(i.getValue())}</span>,
    }),
    col.accessor('won_amount', { header: 'Vendido', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{fmtMoney(i.getValue())}</Num> }),
    col.accessor((r) => r.close_rate ?? -1, { id: 'cierre', header: 'Cierre', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{orDash(i.row.original.close_rate, fmtPct)}</Num> }),
    col.accessor('contacts_total', { header: 'Contactos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
  ]);

  return (
    <>
      <TileRow label="Resumen del equipo">
        <StatTile dark label="Pipeline abierto" value={s.pipeline_amount} format={fmtMoney} caption={plural(s.open_count, 'presupuesto', 'presupuestos')} />
        <StatTile label="Al día" value={s.healthy_pct} format={fmtPct} caption="Con contacto en 7 días" />
        <StatTile label="Tasa de cierre" value={s.close_rate} format={fmtPct} delta={{ previous: s.previous.close_rate, mode: 'pp' }} />
        <StatTile label="Vendido" value={s.won_amount} format={fmtMoney} delta={{ previous: s.previous.won_amount, mode: 'pct' }} />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Pipeline por vendedor"
          hint="En pesos"
          empty={withPipeline.length === 0}
          emptyText="Nadie tiene presupuestos abiertos"
          legend={HEALTH_ORDER.map((h) => ({ label: HEALTH_META[h].label, color: HEALTH_COLOR[h] }))}
          table={{
            head: ['Vendedor', ...HEALTH_ORDER.map((h) => HEALTH_META[h].label), 'Total'],
            rows: withPipeline.map((r) => [r.name, ...HEALTH_ORDER.map((h) => `${fmtMoney(r.health[h].amount)} (${r.health[h].count})`), fmtMoney(r.pipeline_amount)]),
          }}
        >
          <StackedBar
            orientation="horizontal"
            label="Pipeline abierto por vendedor, según el seguimiento"
            series={HEALTH_ORDER.map((h) => ({ key: h, label: HEALTH_META[h].label, color: HEALTH_COLOR[h] }))}
            format={fmtMoney}
            data={withPipeline.map((r) => ({
              key: r.user_id,
              label: r.name,
              href: href(`/indicadores/vendedores/${r.user_id}`),
              values: Object.fromEntries(HEALTH_ORDER.map((h) => [h, r.health[h].amount])),
              details: [{ label: 'abiertos', value: fmtInt(r.open_count) }],
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Vendido por vendedor"
          hint="En pesos"
          empty={withSales.length === 0}
          emptyText="Sin ventas concretadas en este período"
          table={{
            head: ['Vendedor', 'Vendido', 'Ventas', 'Cierre', 'Ticket'],
            rows: withSales.map((r) => [r.name, fmtMoney(r.won_amount), fmtInt(r.won_count), orDash(r.close_rate, fmtPct), orDash(r.avg_ticket, fmtMoney)]),
          }}
        >
          <BarChart
            label="Vendido por vendedor"
            valueLabel="vendido"
            format={fmtMoney}
            data={withSales.map((r) => ({
              key: r.user_id,
              label: r.name,
              href: href(`/indicadores/vendedores/${r.user_id}`),
              value: r.won_amount,
              details: [
                { label: 'ventas', value: fmtInt(r.won_count) },
                { label: 'de cierre', value: orDash(r.close_rate, fmtPct) },
              ],
            }))}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Por responsable"
        rows={d.sellers}
        columns={columns}
        rowKey={(r) => r.user_id}
        rowLabel={(r) => `${r.name}: pipeline ${fmtMoney(r.pipeline_amount)}`}
        href={(r) => href(`/indicadores/vendedores/${r.user_id}`)}
        initialSort={[{ id: 'pipeline_amount', desc: true }]}
        alignRight={['open_count', 'pipeline_amount', 'stale_count', 'won_amount', 'cierre', 'contacts_total', 'frecuencia']}
        grow="name"
        emptyText="Todavía no hay vendedores con actividad"
        item={(r) => (
          <>
            <RowMain
              title={r.name}
              sub={
                <>
                  {plural(r.open_count, 'abierto', 'abiertos')}
                  {r.stale_count > 0 && <span className="font-semibold text-rojo-tinta"> · {plural(r.stale_count, 'estancado', 'estancados')}</span>}
                  {' · '}cierre {orDash(r.close_rate, fmtPct)}
                </>
              }
            />
            <RowValue value={fmtMoney(r.pipeline_amount)} sub={r.won_amount ? `${fmtMoney(r.won_amount)} vendido` : undefined} />
          </>
        )}
      />
    </>
  );
}
