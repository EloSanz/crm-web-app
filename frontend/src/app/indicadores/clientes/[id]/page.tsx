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
import { fmtInt, fmtMoney, fmtPct, stageShort } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchClientDetailMetrics } from '@/lib/api-metrics';
import { CLIENT_STATUS } from '@/lib/catalogs';
import { formatARS, formatDate, formatQty } from '@/lib/format';
import type { CompanyStatus } from '@/types/crm';
import type { ClientDetailMetrics, MetricsDays } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../../_components/data';
import { PeriodFilter, useMetricsHref } from '../../_components/period';
import { ChartGrid, ListTable, TileRow } from '../../_components/ListTable';
import { QuoteStatus, quoteColumns } from '../../_components/quotes';
import { OutcomeChart, plural, RowMain, RowValue, shortDate } from '../../_components/bits';

type Row = ClientDetailMetrics['quotes'][number];
const col = createColumnHelper<TableSetup, Row>();

export default function ClientDetailPage() {
  return (
    <RequireRole role="admin">
      <ClientDetailData />
    </RequireRole>
  );
}

function ClientDetailData() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback((days: MetricsDays) => fetchClientDetailMetrics(id, days), [id]);
  const result = useMetrics(load);
  return (
    <MetricsBody result={result} label="Cargando cliente">
      {(d) => <ClientDetail d={d} />}
    </MetricsBody>
  );
}

function ClientDetail({ d }: { d: ClientDetailMetrics }) {
  const href = useMetricsHref();
  const c = d.client;
  const s = d.summary;
  const st = CLIENT_STATUS[c.status as CompanyStatus] ?? { label: c.status, tone: 'neutro' as const };

  return (
    <>
      <PageHeader
        back={{ href: href('/indicadores/clientes'), label: 'Clientes' }}
        title={c.name}
        meta={
          <>
            <Chip tone={st.tone}>{st.label}</Chip>
            <span className="text-sm text-tiza">{c.origin}</span>
          </>
        }
        actions={
          <>
            <PeriodFilter />
            <ButtonLink href={`/companies/${c.company_id}`} variant="secundario">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Ficha
            </ButtonLink>
          </>
        }
      />

      <TileRow label={`Resumen de ${c.name}`}>
        <StatTile dark label="Vendido en el período" value={s.won_amount_period} format={fmtMoney} caption={plural(s.won_count_period, 'compra', 'compras')} trend={d.buckets.map((b) => b.won_amount)} />
        <StatTile label="Vendido en total" value={s.won_amount_total} format={fmtMoney} caption={s.last_won_at ? `Última: ${formatDate(s.last_won_at)}` : 'Sin compras todavía'} />
        <StatTile label="Abierto" value={s.open_amount} format={fmtMoney} caption={plural(s.open_count, 'presupuesto', 'presupuestos')} />
        <StatTile label="Tasa de cierre" value={s.close_rate_total} format={fmtPct} caption={`${fmtInt(s.won_count_total)} ganados · ${fmtInt(s.lost_count_total)} perdidos`} />
      </TileRow>

      <ChartGrid>
        <OutcomeChart buckets={d.buckets} granularity={d.granularity} title="Compras y pérdidas" />
        <ChartCard
          title="Materiales que más compra"
          hint="En pesos"
          empty={d.top_materials.length === 0}
          emptyText="Sin materiales cotizados"
          table={{ head: ['Material', 'Presupuestos', 'Cantidad', 'Monto'], rows: d.top_materials.map((m) => [m.name, fmtInt(m.quotes), formatQty(m.quantity, m.unit), formatARS(m.amount)]) }}
        >
          <BarChart
            label="Materiales que más compra"
            valueLabel="monto"
            format={fmtMoney}
            data={d.top_materials.slice(0, 6).map((m) => ({ key: m.product_id ?? m.name, label: m.name, sub: formatQty(m.quantity, m.unit), value: m.amount }))}
          />
        </ChartCard>
        {d.projects.length > 0 && (
          <ChartCard title="Obras" hint="En pesos" table={{ head: ['Obra', 'Presupuestos', 'Monto'], rows: d.projects.map((p) => [p.name, fmtInt(p.quotes), formatARS(p.amount)]) }}>
            <BarChart
              label="Presupuestado por obra"
              valueLabel="presupuestado"
              format={fmtMoney}
              data={d.projects.map((p) => ({ key: p.project_id, label: p.name, sub: plural(p.quotes, 'presupuesto', 'presupuestos'), value: p.amount, href: href(`/indicadores/obras/${p.project_id}`) }))}
            />
          </ChartCard>
        )}
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
        emptyText="Este cliente todavía no tiene presupuestos"
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
