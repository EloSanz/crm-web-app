'use client';

import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip } from '@/components/ui/Chip';
import { HealthChip } from '@/components/punta/Punta';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { StatTile } from '@/components/charts/StatTile';
import { CHANNELS, CHART } from '@/components/charts/palette';
import { fmtDays, fmtDaysShort, fmtInt, fmtMoney, fmtPct, stageShort } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchSellerDetailMetrics } from '@/lib/api-metrics';
import { ROLE_LABELS } from '@/lib/catalogs';
import { formatARS } from '@/lib/format';
import type { MetricsDays, OpenQuoteRow, SellerDetailMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../../_components/data';
import { PeriodFilter, useMetricsHref } from '../../_components/period';
import { ChartGrid, ListTable, TileRow } from '../../_components/ListTable';
import { Num, orDash, OutcomeChart, plural, RowMain, RowValue } from '../../_components/bits';

const col = createColumnHelper<TableSetup, OpenQuoteRow>();

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback((days: MetricsDays) => fetchSellerDetailMetrics(id, days), [id]);
  const result = useMetrics(load);
  return (
    <MetricsBody result={result} label="Cargando vendedor">
      {(d) => <SellerDetail d={d} />}
    </MetricsBody>
  );
}

function SellerDetail({ d }: { d: SellerDetailMetrics }) {
  const href = useMetricsHref();
  const s = d.seller;
  const stageRows = d.stage_times.filter((t) => t.avg_days !== null || t.team_avg_days !== null);
  const mix = CHANNELS.map((c) => ({ ...c, count: d.activity_mix.find((m) => m.channel === c.key)?.count ?? 0 }));

  const columns = col.columns([
    col.accessor('title', { header: 'Presupuesto', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} sub={i.row.original.client} /> }),
    col.accessor('stage_name', { header: 'Etapa', sortFn: 'text', cell: (i) => <span className="whitespace-nowrap">{stageShort(i.getValue())}</span> }),
    col.accessor((r) => r.days_in_stage ?? -1, { id: 'en_etapa', header: 'En la etapa', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{orDash(i.row.original.days_in_stage, fmtDays)}</Num> }),
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
      <PageHeader
        back={{ href: href('/indicadores/vendedores'), label: 'Vendedores' }}
        title={s.name}
        meta={<Chip tone={s.is_active ? 'fuerte' : 'neutro'}>{s.role ? ROLE_LABELS[s.role] ?? s.role : 'Sin usuario activo'}</Chip>}
        actions={<PeriodFilter />}
      />

      <TileRow label={`Resumen de ${s.name}`}>
        <StatTile dark label="Pipeline abierto" value={s.pipeline_amount} format={fmtMoney} caption={plural(s.open_count, 'presupuesto', 'presupuestos')} />
        <StatTile label="Vendido" value={s.won_amount} format={fmtMoney} caption={plural(s.won_count, 'venta', 'ventas')} trend={d.buckets.map((b) => b.won_amount)} />
        <StatTile label="Tasa de cierre" value={s.close_rate} format={fmtPct} caption={d.team.close_rate !== null ? `Equipo: ${fmtPct(d.team.close_rate)}` : undefined} />
        <StatTile
          label="Días entre contactos"
          value={s.avg_days_between_contacts}
          format={fmtDays}
          caption={d.team.avg_days_between_contacts !== null ? `Equipo: ${fmtDays(d.team.avg_days_between_contacts)}` : undefined}
        />
      </TileRow>

      <ChartGrid>
        <OutcomeChart buckets={d.buckets} granularity={d.granularity} className="xl:col-span-2" />
        <ChartCard
          title="Días por etapa"
          hint="Días"
          empty={stageRows.length === 0}
          emptyText="Sin movimientos de etapa en este período"
          legend={[
            { label: s.name, color: CHART.magnitude },
            { label: 'Equipo', color: CHART.ink, shape: 'tick' },
          ]}
          table={{
            head: ['Etapa', s.name, 'Equipo', 'Pasos'],
            rows: d.stage_times.map((t) => [t.name, orDash(t.avg_days, fmtDays), orDash(t.team_avg_days, fmtDays), fmtInt(t.count)]),
          }}
        >
          <BarChart
            label={`Días promedio por etapa de ${s.name} frente al equipo`}
            valueLabel={s.name}
            markerLabel="Equipo"
            format={fmtDaysShort}
            data={d.stage_times.map((t) => ({
              key: t.stage_id,
              label: stageShort(t.name),
              value: t.avg_days ?? 0,
              marker: t.team_avg_days,
              details: [{ label: 'pasos por la etapa', value: fmtInt(t.count) }],
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Contactos por canal"
          empty={s.contacts_total === 0}
          emptyText="Sin contactos registrados en este período"
          table={{ head: ['Canal', 'Contactos'], rows: mix.map((m) => [m.label, fmtInt(m.count)]) }}
        >
          <BarChart label="Contactos por canal" valueLabel="contactos" format={fmtInt} data={mix.map((m) => ({ key: m.key, label: m.label, value: m.count }))} />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Presupuestos abiertos"
        rows={d.open}
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) => `${r.title}, ${formatARS(r.amount)}`}
        href={(r) => href(`/indicadores/presupuestos/${r.id}`)}
        initialSort={[{ id: 'seguimiento', desc: true }]}
        alignRight={['en_etapa', 'amount']}
        grow="title"
        emptyText="No tiene presupuestos abiertos"
        item={(r) => (
          <>
            <RowMain title={r.title} sub={`${r.client} · ${stageShort(r.stage_name)}`} />
            <RowValue value={fmtMoney(r.amount)} sub={<HealthChip health={r.health} days={r.days_since_last_activity} compact />} />
          </>
        )}
      />
    </>
  );
}
