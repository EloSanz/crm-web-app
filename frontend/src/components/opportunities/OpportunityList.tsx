'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import type { Opportunity, Stage } from '@/types/crm';
import { Punta, HealthChip } from '@/components/punta/Punta';
import { Chip } from '@/components/ui/Chip';
import { DataTable, type TableSetup } from '@/components/ui/DataTable';
import { healthOf } from '@/lib/health';
import { formatARS, sentenceCase } from '@/lib/format';

const helper = createColumnHelper<TableSetup, Opportunity>();

/** Días sin contacto para ordenar: los cerrados van al final. */
const followUpKey = (o: Opportunity) => (o.status === 'abierta' ? (o.days_since_last_activity ?? 999) : -1);

/** Vista lista: tabla ordenable por columna en escritorio, filas compactas en el celular. */
export function OpportunityList({ opportunities, stages }: { opportunities: Opportunity[]; stages: Stage[] }) {
  const router = useRouter();
  const stageName = useMemo(() => new Map(stages.map((s) => [s.id, sentenceCase(s.name)])), [stages]);
  // Mismo orden que la tabla por defecto: el más frío arriba, los cerrados al final.
  const sorted = useMemo(
    () => [...opportunities].sort((a, b) => followUpKey(b) - followUpKey(a) || Number(b.estimated_value) - Number(a.estimated_value)),
    [opportunities]
  );

  const columns = useMemo(() => {
    const position = new Map(stages.map((s) => [s.id, s.position]));
    const name = new Map(stages.map((s) => [s.id, sentenceCase(s.name)]));
    return helper.columns([
      helper.accessor('title', {
        header: 'Presupuesto',
        sortFn: 'text',
        cell: (info) => {
          const o = info.row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <Punta health={healthOf(o)} status={o.status} size={16} />
              <p className="min-w-0 truncate leading-tight">
                <span className="font-bold">{o.title}</span>
                <span className="text-sm text-tiza"> · {o.company_name || o.contact_name || 'Sin cliente'}</span>
              </p>
            </div>
          );
        },
      }),
      helper.accessor((o) => position.get(o.stage_id) ?? 0, {
        id: 'etapa',
        header: 'Etapa',
        sortFn: 'basic',
        cell: (info) => <span className="whitespace-nowrap text-sm font-medium">{name.get(info.row.original.stage_id) ?? '—'}</span>,
      }),
      helper.accessor(followUpKey, {
        id: 'seguimiento',
        header: 'Seguimiento',
        sortFn: 'basic',
        cell: (info) => {
          const o = info.row.original;
          return o.status === 'abierta' ? (
            <HealthChip health={healthOf(o)} days={o.days_since_last_activity} compact />
          ) : (
            <Chip tone={o.status === 'ganada' ? 'verde' : 'neutro'}>{o.status === 'ganada' ? 'Vendido' : 'Perdido'}</Chip>
          );
        },
      }),
      helper.accessor((o) => o.assigned_to_name ?? '', {
        id: 'responsable',
        header: 'Responsable',
        sortFn: 'text',
        cell: (info) => <span className="whitespace-nowrap text-sm">{info.getValue() || '—'}</span>,
      }),
      helper.accessor((o) => Number(o.estimated_value || 0), {
        id: 'monto',
        header: 'Monto',
        sortFn: 'basic',
        sortDescFirst: true,
        cell: (info) => <span className="cifra whitespace-nowrap font-extrabold">{formatARS(info.getValue())}</span>,
      }),
    ]);
  }, [stages]);

  return (
    <>
      <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave xl:hidden">
        {sorted.map((o) => (
          <li key={o.id} className="relative flex items-center gap-3 px-4 py-2.5">
            <Punta health={healthOf(o)} status={o.status} size={16} />
            <div className="min-w-0 flex-1">
              <Link href={`/opportunities/${o.id}`} className="block truncate text-[15px] font-bold leading-tight after:absolute after:inset-0">
                {o.title}
              </Link>
              <p className="truncate text-[13px] leading-tight text-tiza">
                {o.company_name || o.contact_name || 'Sin cliente'}
                <span className="hidden md:inline"> · {stageName.get(o.stage_id) ?? '—'}</span>
              </p>
            </div>
            <span className="hidden w-32 shrink-0 md:block">
              {o.status === 'abierta' ? (
                <HealthChip health={healthOf(o)} days={o.days_since_last_activity} compact />
              ) : (
                <Chip tone={o.status === 'ganada' ? 'verde' : 'neutro'}>{o.status === 'ganada' ? 'Vendido' : 'Perdido'}</Chip>
              )}
            </span>
            <span className="cifra shrink-0 text-right text-[15px] font-extrabold md:w-32">{formatARS(o.estimated_value)}</span>
          </li>
        ))}
      </ul>
      <div className="hidden xl:block">
        <DataTable
          data={opportunities}
          columns={columns}
          initialSort={[{ id: 'seguimiento', desc: true }]}
          dense
          grow="title"
          pageSize={15}
          caption="Presupuestos"
          alignRight={['monto']}
          onRowClick={(o) => router.push(`/opportunities/${o.id}`)}
          rowLabel={(o) => `Abrir ${o.title}`}
        />
      </div>
    </>
  );
}
