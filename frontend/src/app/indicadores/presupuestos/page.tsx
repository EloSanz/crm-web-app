'use client';

import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { HealthChip } from '@/components/punta/Punta';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { StatTile } from '@/components/charts/StatTile';
import { HEALTH_COLOR } from '@/components/charts/palette';
import { fmtDays, fmtInt, fmtMoney, fmtOne, fmtPct, stageShort } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchQuotesMetrics } from '@/lib/api-metrics';
import { HEALTH_META } from '@/lib/health';
import { formatARS, formatQty } from '@/lib/format';
import type { OpenQuoteRow, QuotesMetrics, RangeBucket } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { useMetricsHref } from '../_components/period';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, plural, RowMain, RowValue } from '../_components/bits';

const col = createColumnHelper<TableSetup, OpenQuoteRow>();
const pctOne = (n: number) => `${fmtOne(n)}%`;

/** Montos cortos sin signo para los rangos: "250 mil", "1 M", "10 M". */
const short = (n: number) => (n >= 1_000_000 ? `${fmtOne(n / 1_000_000)} M` : `${fmtInt(n / 1000)} mil`);
function amountLabel(r: RangeBucket): string {
  if (r.max === null) return `+${short(r.min)}`;
  if (r.min === 0) return `<${short(r.max)}`;
  if (r.min >= 1_000_000) return `${fmtOne(r.min / 1_000_000)}–${short(r.max)}`;
  return `${short(r.min)}–${short(r.max)}`;
}
const ageLabel = (r: RangeBucket) => (r.max === null ? `+${r.min - 1} d` : `${r.min}–${r.max} d`);

export default function PresupuestosPage() {
  const result = useMetrics(fetchQuotesMetrics);
  return (
    <MetricsBody result={result} label="Cargando presupuestos">
      {(d) => <Presupuestos d={d} />}
    </MetricsBody>
  );
}

function Presupuestos({ d }: { d: QuotesMetrics }) {
  const href = useMetricsHref();
  const s = d.summary;

  const columns = col.columns([
    col.accessor('title', { header: 'Presupuesto', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} sub={i.row.original.client} /> }),
    col.accessor('seller', { header: 'Vendedor', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{i.getValue()}</span> }),
    col.accessor('stage_name', { header: 'Etapa', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{stageShort(i.getValue())}</span> }),
    col.accessor('version', { header: 'Versión', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{`v${i.getValue()}`}</Num> }),
    col.accessor('discount_pct', { header: 'Descuento', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{i.getValue() ? pctOne(i.getValue()) : '—'}</Num> }),
    col.accessor((r) => r.days_since_last_activity ?? 999, {
      id: 'seguimiento',
      header: 'Seguimiento',
      sortFn: 'basic',
      sortDescFirst: true,
      cell: (i) => <HealthChip health={i.row.original.health} days={i.row.original.days_since_last_activity} compact />,
    }),
    col.accessor('amount', { header: 'Monto', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{formatARS(i.getValue())}</Num> }),
  ]);

  return (
    <>
      <TileRow label="Resumen de presupuestos">
        <StatTile dark label="Abiertos" value={s.open_amount} format={fmtMoney} caption={plural(s.open_count, 'presupuesto', 'presupuestos')} />
        <StatTile label="Antigüedad promedio" value={s.avg_age_days} format={fmtDays} caption="De los abiertos" />
        <StatTile label="Renegociados" value={s.renegotiated_pct} format={fmtPct} caption={`${fmtInt(s.renegotiated_count)} de ${fmtInt(s.considered_count)}`} />
        <StatTile label="Descuento promedio" value={s.avg_discount_pct} format={pctOne} caption={plural(s.discounted_count, 'con descuento', 'con descuento')} />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Salud de los abiertos"
          hint="En pesos"
          empty={s.open_count === 0}
          emptyText="No hay presupuestos abiertos"
          table={{ head: ['Seguimiento', 'Monto', 'Presupuestos'], rows: d.health.map((h) => [`${HEALTH_META[h.health].label} (${HEALTH_META[h.health].range})`, formatARS(h.amount), fmtInt(h.count)]) }}
        >
          <BarChart
            label="Monto abierto según el seguimiento"
            valueLabel="abierto"
            format={fmtMoney}
            data={d.health.map((h) => ({
              key: h.health,
              label: HEALTH_META[h.health].label,
              sub: `${plural(h.count, 'presupuesto', 'presupuestos')} · ${HEALTH_META[h.health].range}`,
              value: h.amount,
              color: HEALTH_COLOR[h.health],
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Materiales más cotizados"
          hint="En pesos"
          empty={d.top_materials.length === 0}
          emptyText="Sin materiales cotizados en este período"
          table={{ head: ['Material', 'Presupuestos', 'Cantidad', 'Monto'], rows: d.top_materials.map((m) => [m.name, fmtInt(m.quotes), formatQty(m.quantity, m.unit), formatARS(m.amount)]) }}
        >
          <BarChart
            label="Materiales más cotizados"
            valueLabel="cotizado"
            format={fmtMoney}
            data={d.top_materials.slice(0, 5).map((m) => ({
              key: m.product_id ?? m.name,
              label: m.name,
              sub: `${plural(m.quotes, 'presupuesto', 'presupuestos')} · ${formatQty(m.quantity, m.unit)}`,
              value: m.amount,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Por rango de monto"
          empty={d.amount_ranges.every((r) => r.count === 0)}
          table={{ head: ['Rango', 'Presupuestos', 'Monto'], rows: d.amount_ranges.map((r) => [amountLabel(r), fmtInt(r.count), formatARS(r.amount)]) }}
        >
          <BarChart
            orientation="vertical"
            label="Presupuestos por rango de monto"
            valueLabel="presupuestos"
            format={fmtInt}
            data={d.amount_ranges.map((r) => ({ key: r.key, label: amountLabel(r), value: r.count, details: [{ label: 'en total', value: fmtMoney(r.amount) }] }))}
          />
        </ChartCard>
        <ChartCard
          title="Antigüedad de los abiertos"
          hint="Días"
          empty={s.open_count === 0}
          emptyText="No hay presupuestos abiertos"
          table={{ head: ['Antigüedad', 'Presupuestos', 'Monto'], rows: d.age_ranges.map((r) => [ageLabel(r), fmtInt(r.count), formatARS(r.amount)]) }}
        >
          <BarChart
            orientation="vertical"
            label="Presupuestos abiertos por antigüedad"
            valueLabel="presupuestos"
            format={fmtInt}
            data={d.age_ranges.map((r) => ({ key: r.key, label: ageLabel(r), value: r.count, details: [{ label: 'en total', value: fmtMoney(r.amount) }] }))}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Presupuestos abiertos"
        rows={d.open}
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) => `${r.title}, ${formatARS(r.amount)}`}
        href={(r) => href(`/indicadores/presupuestos/${r.id}`)}
        initialSort={[{ id: 'amount', desc: true }]}
        alignRight={['version', 'discount_pct', 'amount']}
        grow="title"
        emptyText="No hay presupuestos abiertos"
        item={(r) => (
          <>
            <RowMain title={r.title} sub={`${r.client} · ${stageShort(r.stage_name)}${r.version > 1 ? ` · v${r.version}` : ''}`} />
            <RowValue value={fmtMoney(r.amount)} sub={<HealthChip health={r.health} days={r.days_since_last_activity} compact />} />
          </>
        )}
      />
    </>
  );
}

