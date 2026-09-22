'use client';

import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { HealthChip } from '@/components/punta/Punta';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { ConversionFunnel, FUNNEL_PARTS } from '@/components/charts/ConversionFunnel';
import { Heatmap } from '@/components/charts/Heatmap';
import { StatTile } from '@/components/charts/StatTile';
import { CHART } from '@/components/charts/palette';
import { fmtDays, fmtDaysShort, fmtInt, fmtMoney, fmtOne, fmtPct, stageShort } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchStagesMetrics } from '@/lib/api-metrics';
import { formatARS } from '@/lib/format';
import type { OpenQuoteRow, StagesMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { useMetricsHref } from '../_components/period';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, orDash, plural, RowMain, RowValue } from '../_components/bits';

const col = createColumnHelper<TableSetup, OpenQuoteRow>();

export default function EtapasPage() {
  const result = useMetrics(fetchStagesMetrics);
  return (
    <MetricsBody result={result} label="Cargando etapas">
      {(d) => <Etapas d={d} />}
    </MetricsBody>
  );
}

function Etapas({ d }: { d: StagesMetrics }) {
  const href = useMetricsHref();
  const s = d.summary;
  const cells = new Map(d.matrix.cells.map((c) => [`${c.user_id}|${c.stage_id}`, c]));
  const hasMacro = d.macro.some((m) => m.count > 0);

  const columns = col.columns([
    col.accessor('title', { header: 'Presupuesto', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} sub={i.row.original.client} /> }),
    col.accessor('seller', { header: 'Vendedor', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{i.getValue()}</span> }),
    col.accessor('stage_name', { header: 'Etapa', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{stageShort(i.getValue())}</span> }),
    col.accessor((r) => r.days_in_stage ?? -1, {
      id: 'en_etapa',
      header: 'En la etapa',
      sortFn: 'basic',
      sortDescFirst: true,
      cell: (i) => <Num strong>{orDash(i.row.original.days_in_stage, fmtDays)}</Num>,
    }),
    col.accessor((r) => r.days_since_last_activity ?? 999, {
      id: 'seguimiento',
      header: 'Seguimiento',
      sortFn: 'basic',
      sortDescFirst: true,
      cell: (i) => <HealthChip health={i.row.original.health} days={i.row.original.days_since_last_activity} compact />,
    }),
    col.accessor('amount', { header: 'Monto', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{formatARS(i.getValue())}</Num> }),
  ]);

  return (
    <>
      <TileRow label="Resumen de etapas">
        <StatTile dark label="Ciclo de venta" value={s.avg_cycle_days} format={fmtDays} caption={plural(d.won_count, 'venta', 'ventas')} />
        <StatTile label="Etapa más lenta" value={s.slowest_stage?.avg_days ?? null} format={fmtDays} caption={s.slowest_stage ? stageShort(s.slowest_stage.name) : undefined} />
        <StatTile label="En la etapa actual" value={s.avg_days_in_current_stage} format={fmtDays} caption={plural(s.open_count, 'abierto', 'abiertos')} />
        <StatTile label="Más de 14 días quietos" value={s.stuck_count} format={fmtInt} caption="En la misma etapa" />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Días por etapa"
          empty={!hasMacro}
          emptyText="Sin movimientos de etapa en este período"
          legend={[
            { label: 'Promedio', color: CHART.soft },
            { label: 'Mediana', color: CHART.ink, shape: 'tick' },
          ]}
          table={{
            head: ['Etapa', 'Promedio', 'Mediana', 'Máximo', 'Pasos', 'En curso'],
            rows: d.macro.map((m) => [m.name, orDash(m.avg_days, fmtDays), orDash(m.median_days, fmtDays), orDash(m.max_days, fmtDays), fmtInt(m.count), fmtInt(m.en_curso)]),
          }}
        >
          <BarChart
            label="Días promedio y mediana por etapa"
            valueLabel="promedio"
            markerLabel="Mediana"
            color={CHART.soft}
            format={fmtDaysShort}
            data={d.macro.map((m) => ({
              key: m.stage_id,
              label: stageShort(m.name),
              value: m.avg_days ?? 0,
              marker: m.median_days,
              details: [
                { label: 'pasos', value: fmtInt(m.count) },
                { label: 'en curso', value: fmtInt(m.en_curso) },
              ],
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Conversión por etapa"
          empty={d.conversion.every((c) => c.entered === 0)}
          emptyText="Sin movimientos de etapa en este período"
          legend={FUNNEL_PARTS.map((p) => ({ label: p.label, color: p.color }))}
          table={{
            head: ['Etapa', 'Pasaron', 'Avanzó', 'En curso', 'Volvió atrás', 'Se perdió', 'Avanza'],
            rows: d.conversion.map((c) => [c.name, fmtInt(c.entered), fmtInt(c.advanced), fmtInt(c.en_curso), fmtInt(c.back), fmtInt(c.lost), orDash(c.advance_rate, fmtPct)]),
          }}
        >
          <ConversionFunnel
            label="Conversión por etapa"
            steps={d.conversion.map((c) => ({
              key: c.stage_id,
              label: stageShort(c.name),
              entered: c.entered,
              advanced: c.advanced,
              enCurso: c.en_curso,
              lost: c.lost,
              back: c.back,
              advanceRate: c.advance_rate,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Vendedor × etapa"
          hint="Días"
          className="xl:col-span-2"
          empty={d.matrix.sellers.length === 0}
          emptyText="Sin movimientos de etapa en este período"
          table={{
            head: ['Vendedor', ...d.matrix.stages.map((st) => stageShort(st.name))],
            rows: d.matrix.sellers.map((sl) => [
              sl.name,
              ...d.matrix.stages.map((st) => {
                const c = cells.get(`${sl.user_id}|${st.stage_id}`);
                return c && c.avg_days !== null ? `${fmtDays(c.avg_days)} (${c.count})` : '—';
              }),
            ]),
          }}
        >
          <Heatmap
            label="Días promedio por vendedor y etapa"
            scaleLabel="Días"
            rows={d.matrix.sellers.map((sl) => ({ key: sl.user_id, label: sl.name, href: href(`/indicadores/vendedores/${sl.user_id}`) }))}
            cols={d.matrix.stages.map((st) => ({ key: st.stage_id, label: st.name, short: stageShort(st.name) }))}
            cell={(row, colKey) => {
              const c = cells.get(`${row}|${colKey}`);
              return { value: c?.avg_days ?? null, count: c?.count };
            }}
            format={(n) => (n >= 10 ? fmtInt(n) : fmtOne(n))}
            formatLong={fmtDays}
            countLabel={(n) => (n === 1 ? 'paso por la etapa' : 'pasos por la etapa')}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Abiertos por antigüedad en la etapa"
        rows={d.open}
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) => `${r.title}: ${orDash(r.days_in_stage, fmtDays)} en ${stageShort(r.stage_name)}`}
        href={(r) => href(`/indicadores/presupuestos/${r.id}`)}
        initialSort={[{ id: 'en_etapa', desc: true }]}
        alignRight={['en_etapa', 'amount']}
        grow="title"
        emptyText="No hay presupuestos abiertos"
        item={(r) => (
          <>
            <RowMain title={r.title} sub={`${stageShort(r.stage_name)} · ${r.seller}`} />
            <RowValue value={orDash(r.days_in_stage, fmtDays)} sub={fmtMoney(r.amount)} />
          </>
        )}
      />
    </>
  );
}
