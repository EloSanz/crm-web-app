'use client';

import { sentenceCase } from '@/lib/format';
import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { StackedBar } from '@/components/charts/StackedBar';
import { StatTile } from '@/components/charts/StatTile';
import { CHANNELS, CONTACT_TYPE_LABEL } from '@/components/charts/palette';
import { bucketLabel, bucketTitle, fmtDays, fmtHours, fmtInt } from '@/components/charts/format';
import type { TableSetup } from '@/components/ui/DataTable';
import { fetchContactMetrics } from '@/lib/api-metrics';
import type { ContactMetrics } from '@/types/metrics';
import { MetricsBody, useMetrics } from '../_components/data';
import { useMetricsHref } from '../_components/period';
import { ChartGrid, ListTable, TileRow } from '../_components/ListTable';
import { Num, orDash, periodWord, plural, RowMain, RowValue } from '../_components/bits';

type SellerContact = ContactMetrics['by_seller'][number];
const col = createColumnHelper<TableSetup, SellerContact>();
const SERIES = CHANNELS.map((c) => ({ key: c.key, label: c.label, color: c.color }));

export default function ContactoPage() {
  const result = useMetrics(fetchContactMetrics);
  return (
    <MetricsBody result={result} label="Cargando contactos">
      {(d) => <Contacto d={d} />}
    </MetricsBody>
  );
}

function Contacto({ d }: { d: ContactMetrics }) {
  const href = useMetricsHref();
  const s = d.summary;
  const sellers = d.by_seller.filter((r) => r.total > 0);
  const types = d.by_type.filter((t) => t.count > 0).sort((a, b) => b.count - a.count);

  const columns = col.columns([
    col.accessor('name', { header: 'Responsable', sortFn: 'text', cell: (i) => <RowMain title={i.getValue()} /> }),
    col.accessor('total', { header: 'Contactos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num strong>{fmtInt(i.getValue())}</Num> }),
    col.accessor((r) => r.by_channel.llamada, { id: 'llamadas', header: 'Llamadas', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor((r) => r.by_channel.whatsapp, { id: 'whatsapp', header: 'WhatsApp', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor((r) => r.by_channel.email, { id: 'correos', header: 'Correos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <Num>{fmtInt(i.getValue())}</Num> }),
    col.accessor((r) => r.first_response_avg_hours ?? 99999, {
      id: 'respuesta',
      header: 'Primera respuesta',
      sortFn: 'basic',
      cell: (i) => <Num>{orDash(i.row.original.first_response_avg_hours, fmtHours)}</Num>,
    }),
    col.accessor((r) => r.avg_days_between_contacts ?? 99999, {
      id: 'frecuencia',
      header: 'Entre contactos',
      sortFn: 'basic',
      cell: (i) => <Num>{orDash(i.row.original.avg_days_between_contacts, fmtDays)}</Num>,
    }),
  ]);

  return (
    <>
      <TileRow label="Resumen de contactos">
        <StatTile dark label="Contactos" value={s.contacts} format={fmtInt} delta={{ previous: s.contacts_previous, mode: 'pct' }} trend={d.buckets.map((b) => b.total)} />
        <StatTile
          label="Primera respuesta"
          value={s.first_response_avg_hours}
          format={fmtHours}
          caption={s.first_response_median_hours !== null ? `Mediana: ${fmtHours(s.first_response_median_hours)}` : undefined}
        />
        <StatTile label="Días entre contactos" value={s.avg_days_between_contacts} format={fmtDays} />
        <StatTile label="Sin primer contacto" value={s.awaiting_first_contact} format={fmtInt} caption="Presupuestos abiertos" />
      </TileRow>

      <ChartGrid>
        <ChartCard
          title="Contactos por canal"
          hint={sentenceCase(periodWord(d.granularity))}
          className="xl:col-span-2"
          empty={s.contacts === 0}
          emptyText="Sin contactos registrados en este período"
          legend={CHANNELS.map((c) => ({ label: c.label, color: c.color }))}
          table={{
            head: ['Período', ...CHANNELS.map((c) => c.label), 'Total'],
            rows: d.buckets.map((b) => [bucketTitle(b.start, d.granularity), ...CHANNELS.map((c) => fmtInt(b[c.key])), fmtInt(b.total)]),
          }}
        >
          <StackedBar
            label={`Contactos por canal ${periodWord(d.granularity)}`}
            series={SERIES}
            format={fmtInt}
            data={d.buckets.map((b, i) => ({
              key: b.start,
              label: bucketLabel(b.start, d.granularity, i),
              title: bucketTitle(b.start, d.granularity),
              values: Object.fromEntries(CHANNELS.map((c) => [c.key, b[c.key]])),
              details: [{ label: 'en total', value: fmtInt(b.total) }],
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Por vendedor"
          empty={sellers.length === 0}
          emptyText="Sin contactos registrados en este período"
          legend={CHANNELS.map((c) => ({ label: c.label, color: c.color }))}
          table={{
            head: ['Vendedor', ...CHANNELS.map((c) => c.label), 'Total'],
            rows: sellers.map((r) => [r.name, ...CHANNELS.map((c) => fmtInt(r.by_channel[c.key])), fmtInt(r.total)]),
          }}
        >
          <StackedBar
            orientation="horizontal"
            label="Contactos por vendedor y canal"
            series={SERIES}
            format={fmtInt}
            data={sellers.map((r) => ({
              key: r.user_id,
              label: r.name,
              href: href(`/indicadores/vendedores/${r.user_id}`),
              values: { ...r.by_channel },
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Por tipo de contacto"
          empty={types.length === 0}
          emptyText="Sin contactos registrados en este período"
          table={{ head: ['Tipo', 'Contactos'], rows: types.map((t) => [CONTACT_TYPE_LABEL[t.type], fmtInt(t.count)]) }}
        >
          <BarChart label="Contactos por tipo" valueLabel="contactos" format={fmtInt} data={types.map((t) => ({ key: t.type, label: CONTACT_TYPE_LABEL[t.type], value: t.count }))} />
        </ChartCard>
      </ChartGrid>

      <ListTable
        title="Por responsable"
        rows={d.by_seller}
        columns={columns}
        rowKey={(r) => r.user_id}
        rowLabel={(r) => `${r.name}: ${plural(r.total, 'contacto', 'contactos')}`}
        href={(r) => href(`/indicadores/vendedores/${r.user_id}`)}
        initialSort={[{ id: 'total', desc: true }]}
        alignRight={['total', 'llamadas', 'whatsapp', 'correos', 'respuesta', 'frecuencia']}
        grow="name"
        emptyText="Sin contactos registrados en este período"
        item={(r) => (
          <>
            <RowMain title={r.name} sub={`Primera respuesta: ${orDash(r.first_response_avg_hours, fmtHours)}`} />
            <RowValue value={fmtInt(r.total)} sub={r.total === 1 ? 'contacto' : 'contactos'} />
          </>
        )}
      />
    </>
  );
}
