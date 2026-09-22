'use client';

import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { HealthChip } from '@/components/punta/Punta';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { LineArea } from '@/components/charts/LineArea';
import { StatTile } from '@/components/charts/StatTile';
import { CHART, CONTACT_TYPE_LABEL } from '@/components/charts/palette';
import { fmtDays, fmtDaysShort, fmtHours, fmtInt, fmtMoney, fmtOne, stageShort } from '@/components/charts/format';
import { fetchQuoteDetailMetrics } from '@/lib/api-metrics';
import { formatARS, formatDate, formatQty } from '@/lib/format';
import type { MetricsDays, QuoteDetailMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../../_components/data';
import { useMetricsHref } from '../../_components/period';
import { ChartGrid, TileRow } from '../../_components/ListTable';
import { orDash, RowMain, RowValue } from '../../_components/bits';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback((days: MetricsDays) => fetchQuoteDetailMetrics(id, days), [id]);
  const result = useMetrics(load);
  return (
    <MetricsBody result={result} label="Cargando presupuesto">
      {(d) => <QuoteDetail d={d} />}
    </MetricsBody>
  );
}

function QuoteDetail({ d }: { d: QuoteDetailMetrics }) {
  const href = useMetricsHref();
  const q = d.quote;
  const visited = d.stage_times.filter((t) => t.visits > 0);
  const channels = d.contacts_by_channel.filter((c) => c.count > 0);
  const status =
    q.status === 'ganada' ? <Chip tone="verde">Venta concretada</Chip> : q.status === 'perdida' ? <Chip tone="neutro">Perdido</Chip> : <HealthChip health={q.health} days={q.days_since_last_activity} />;

  return (
    <>
      <PageHeader
        back={{ href: href('/indicadores/presupuestos'), label: 'Presupuestos' }}
        title={q.title}
        meta={
          <>
            {status}
            <span className="text-sm text-tiza">
              {q.client} · {q.seller}
            </span>
          </>
        }
        actions={
          <ButtonLink href={`/opportunities/${q.id}`} variant="secundario">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Abrir presupuesto
          </ButtonLink>
        }
      />

      <TileRow label="Resumen del presupuesto">
        <StatTile dark label="Monto" value={q.amount} format={fmtMoney} caption={q.status === 'abierta' ? stageShort(q.stage_name) : q.closed_at ? `Cerrado el ${formatDate(q.closed_at)}` : undefined} />
        <StatTile label="Días sin contacto" value={q.days_since_last_activity} format={fmtInt} caption={`${fmtInt(d.contacts_total)} ${d.contacts_total === 1 ? 'contacto' : 'contactos'} en total`} />
        <StatTile label="Primera respuesta" value={d.first_response_hours} format={fmtHours} caption={orDash(d.avg_days_between_contacts, (v) => `${fmtDays(v)} entre contactos`)} />
        <StatTile label="Versión" value={q.version} format={(n) => `v${fmtInt(n)}`} caption={q.discount_pct ? `${fmtOne(q.discount_pct)}% de descuento` : 'Sin descuento'} />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Tiempo en cada etapa"
          hint="Días"
          empty={visited.length === 0}
          emptyText="Sin historial de etapas"
          legend={[
            { label: 'Cumplida', color: CHART.magnitude },
            { label: 'En curso', color: CHART.soft },
          ]}
          table={{
            head: ['Etapa', 'Días', 'Veces', 'Estado'],
            rows: d.stage_times.map((t) => [t.name, t.visits ? fmtDays(t.days) : '—', fmtInt(t.visits), t.en_curso ? 'En curso' : t.visits ? 'Cumplida' : 'Sin pasar']),
          }}
        >
          <BarChart
            label="Días en cada etapa de este presupuesto"
            valueLabel="días"
            format={fmtDaysShort}
            data={d.stage_times.map((t) => ({
              key: t.stage_id,
              label: stageShort(t.name),
              sub: t.en_curso ? 'En curso' : t.visits > 1 ? `${t.visits} veces` : undefined,
              value: t.days,
              soft: t.en_curso,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Contactos por canal"
          empty={channels.length === 0}
          emptyText="Todavía no tiene contactos registrados"
          table={{ head: ['Canal', 'Contactos'], rows: channels.map((c) => [CONTACT_TYPE_LABEL[c.channel], fmtInt(c.count)]) }}
        >
          <BarChart label="Contactos por canal" valueLabel="contactos" format={fmtInt} data={channels.map((c) => ({ key: c.channel, label: CONTACT_TYPE_LABEL[c.channel], value: c.count }))} />
        </ChartCard>
        {d.versions.length > 1 && (
          <ChartCard
            title="Total por versión"
            hint="En pesos"
            table={{ head: ['Versión', 'Total', 'Descuento', 'Fecha'], rows: d.versions.map((v) => [`v${v.version}`, formatARS(v.total), `${fmtOne(v.discount_pct)}%`, formatDate(v.created_at)]) }}
          >
            <LineArea
              label="Total del presupuesto en cada versión"
              labels={d.versions.map((v) => `v${v.version}`)}
              titles={d.versions.map((v) => `Versión ${v.version}${v.created_at ? ` · ${formatDate(v.created_at)}` : ''}`)}
              series={[{ key: 'total', label: 'Total', color: CHART.magnitude, values: d.versions.map((v) => v.total) }]}
              format={fmtMoney}
            />
          </ChartCard>
        )}
      </ChartGrid>

      {d.items.length > 0 && (
        <section aria-labelledby="materiales" className="space-y-3">
          <h2 id="materiales" className="titular text-lg">
            Materiales
          </h2>
          <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
            {d.items.map((it) => (
              <li key={it.name} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <RowMain title={it.name} sub={formatQty(it.quantity, it.unit)} />
                <RowValue value={formatARS(it.amount)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
