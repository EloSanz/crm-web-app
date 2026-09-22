'use client';

import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { RequireRole } from '@/components/users/RequireRole';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { StatTile } from '@/components/charts/StatTile';
import { CHART } from '@/components/charts/palette';
import { fmtInt, fmtMoney, fmtPct, stageShort } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchProjectDetailMetrics } from '@/lib/api-metrics';
import { PROJECT_STATUS, PROJECT_TYPES } from '@/lib/catalogs';
import { formatARS, formatQty } from '@/lib/format';
import type { ProjectStatus, ProjectType } from '@/types/crm';
import type { MetricsDays, ProjectDetailMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../../_components/data';
import { PeriodFilter, useMetricsHref } from '../../_components/period';
import { ChartGrid, ListTable, TileRow } from '../../_components/ListTable';
import { QuoteStatus, quoteColumns } from '../../_components/quotes';
import { plural, RowMain, RowValue, shortDate } from '../../_components/bits';

type Row = ProjectDetailMetrics['quotes'][number];
const col = createColumnHelper<TableSetup, Row>();

export default function ProjectDetailPage() {
  return (
    <RequireRole role="admin">
      <ProjectDetailData />
    </RequireRole>
  );
}

function ProjectDetailData() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback((days: MetricsDays) => fetchProjectDetailMetrics(id, days), [id]);
  const result = useMetrics(load);
  return (
    <MetricsBody result={result} label="Cargando obra">
      {(d) => <ProjectDetail d={d} />}
    </MetricsBody>
  );
}

function ProjectDetail({ d }: { d: ProjectDetailMetrics }) {
  const href = useMetricsHref();
  const p = d.project;
  const st = PROJECT_STATUS[p.status as ProjectStatus] ?? { label: p.status, tone: 'neutro' as const };
  const closes = p.won_count + p.lost_count;
  const stages = d.by_stage.filter((s) => s.count > 0);

  return (
    <>
      <PageHeader
        back={{ href: href('/indicadores/obras'), label: 'Obras' }}
        title={p.name}
        meta={
          <>
            <Chip tone={st.tone}>{st.label}</Chip>
            <span className="text-sm text-tiza">
              {PROJECT_TYPES[p.project_type as ProjectType] ?? p.project_type}
              {p.company_name ? ` · ${p.company_name}` : ''}
            </span>
          </>
        }
        actions={
          <>
            <PeriodFilter />
            <ButtonLink href={`/projects/${p.project_id}`} variant="secundario">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Ficha
            </ButtonLink>
          </>
        }
      />

      <TileRow label={`Resumen de ${p.name}`}>
        <StatTile dark label="Abierto" value={p.open_amount} format={fmtMoney} caption={plural(p.open_count, 'presupuesto', 'presupuestos')} />
        <StatTile label="Vendido en el período" value={p.won_amount} format={fmtMoney} />
        <StatTile label="Presupuestos" value={p.quotes} format={fmtInt} caption={`${fmtInt(p.won_count)} vendidos · ${fmtInt(p.lost_count)} perdidos`} />
        <StatTile label="Tasa de cierre" value={closes ? p.won_count / closes : null} format={fmtPct} />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Presupuestos por etapa"
          hint="En pesos"
          empty={stages.length === 0}
          emptyText="La obra todavía no tiene presupuestos"
          table={{ head: ['Etapa', 'Presupuestos', 'Monto'], rows: stages.map((s) => [s.name, fmtInt(s.count), formatARS(s.amount)]) }}
        >
          <BarChart
            label="Monto por etapa"
            valueLabel="monto"
            format={fmtMoney}
            data={stages.map((s) => ({
              key: s.stage_id,
              label: stageShort(s.name),
              sub: plural(s.count, 'presupuesto', 'presupuestos'),
              value: s.amount,
              color: s.is_closed_won ? CHART.won : s.is_closed_lost ? CHART.lost : undefined,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Materiales de la obra"
          hint="En pesos"
          empty={d.top_materials.length === 0}
          emptyText="Sin materiales cotizados"
          table={{ head: ['Material', 'Presupuestos', 'Cantidad', 'Monto'], rows: d.top_materials.map((m) => [m.name, fmtInt(m.quotes), formatQty(m.quantity, m.unit), formatARS(m.amount)]) }}
        >
          <BarChart
            label="Materiales cotizados para la obra"
            valueLabel="monto"
            format={fmtMoney}
            data={d.top_materials.slice(0, 6).map((m) => ({ key: m.product_id ?? m.name, label: m.name, sub: formatQty(m.quantity, m.unit), value: m.amount }))}
          />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Presupuestos"
        rows={d.quotes}
        columns={quoteColumns(col)}
        rowKey={(r) => r.id}
        rowLabel={(r) => `${r.title}, ${formatARS(r.amount)}`}
        href={(r) => href(`/indicadores/presupuestos/${r.id}`)}
        initialSort={[{ id: 'creado', desc: true }]}
        alignRight={['amount']}
        grow="title"
        emptyText="La obra todavía no tiene presupuestos"
        item={(r) => (
          <>
            <RowMain title={r.title} sub={`${stageShort(r.stage_name)} · ${shortDate(r.created_at)}`} />
            <RowValue value={fmtMoney(r.amount)} sub={<QuoteStatus row={r} />} />
          </>
        )}
      />
    </>
  );
}
