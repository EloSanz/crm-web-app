'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { createColumnHelper } from '@tanstack/react-table';
import { ChartLine } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { FilterChips } from '@/components/ui/FilterChips';
import { DataTable, type TableSetup } from '@/components/ui/DataTable';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { RequireRole } from '@/components/users/RequireRole';
import { Punta, HealthChip } from '@/components/punta/Punta';
import type { CrmUser, Opportunity } from '@/types/crm';
import { fetchOpportunities, fetchUsers, updateOpportunity } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { healthOf } from '@/lib/health';
import { ROLE_LABELS } from '@/lib/catalogs';
import { formatARS } from '@/lib/format';

const load = async () => {
  const [opportunities, users] = await Promise.all([fetchOpportunities(), fetchUsers()]);
  return { opportunities, users };
};

const assignHelper = createColumnHelper<TableSetup, Opportunity>();

export default function TeamPage() {
  return (
    <AppLayout>
      <RequireRole role="manager">
        <Team />
      </RequireRole>
    </AppLayout>
  );
}

function Team() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(load);
  const [scope, setScope] = useState<'todos' | 'frios'>('frios');

  const open = useMemo(() => (data ? data.opportunities.filter((o) => o.status === 'abierta') : []), [data]);

  const reassign = async (opp: Opportunity, userId: string) => {
    if (userId === opp.assigned_to) return;
    try {
      await updateOpportunity(opp.id, { assigned_to: userId });
      toast.success('Presupuesto reasignado', opp.title);
      await reload();
    } catch (err) {
      toast.error('No se pudo reasignar', err instanceof Error ? err.message : undefined);
    }
  };

  if (loading) return <LoadingBlock label="Cargando el equipo" rows={4} />;
  if (error || !data)
    return <EmptyState illustration="presupuestos" title="No pudimos cargar el equipo" description={error ?? undefined} action={<Button variant="secundario" onClick={() => reload()}>Reintentar</Button>} />;

  const activeUsers: CrmUser[] = data.users.filter((u) => u.is_active);

  const assignList = open.filter((o) => scope === 'todos' || healthOf(o) !== 'healthy');
  const assignColumns = assignHelper.columns([
    assignHelper.accessor('title', {
      header: 'Presupuesto',
      sortFn: 'text',
      cell: (info) => {
        const o = info.row.original;
        return (
          <div className="flex min-w-0 items-start gap-3">
            <Punta health={healthOf(o)} size={16} className="mt-1" />
            <div className="min-w-0">
              <Link href={`/opportunities/${o.id}`} className="line-clamp-2 font-bold leading-snug hover:underline">
                {o.title}
              </Link>
              <p className="truncate text-sm text-tiza">{o.company_name || o.contact_name || 'Sin cliente'}</p>
            </div>
          </div>
        );
      },
    }),
    assignHelper.accessor((o) => o.days_since_last_activity ?? 999, {
      id: 'seguimiento',
      header: 'Seguimiento',
      sortFn: 'basic',
      sortDescFirst: true,
      cell: (i) => <HealthChip health={healthOf(i.row.original)} days={i.row.original.days_since_last_activity} compact />,
    }),
    assignHelper.accessor((o) => Number(o.estimated_value || 0), { id: 'monto', header: 'Monto', sortFn: 'basic', sortDescFirst: true, cell: (i) => <span className="cifra whitespace-nowrap font-bold">{formatARS(i.getValue())}</span> }),
    assignHelper.accessor((o) => o.assigned_to_name ?? '', {
      id: 'responsable',
      header: 'Responsable',
      sortFn: 'text',
      cell: (i) => (
        <div className="w-56">
          <Select
            size="sm"
            aria-label={`Responsable de ${i.row.original.title}`}
            value={i.row.original.assigned_to}
            onChange={(v) => reassign(i.row.original, v)}
            options={activeUsers.map((u) => ({ value: u.id, label: u.full_name, hint: ROLE_LABELS[u.role] }))}
          />
        </div>
      ),
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipo"
        actions={
          <ButtonLink href="/indicadores/vendedores" variant="secundario">
            <ChartLine className="w-4 h-4" aria-hidden />
            Indicadores del equipo
          </ButtonLink>
        }
      />

      <section aria-labelledby="asignaciones" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="asignaciones" className="titular text-lg">
            Asignaciones
          </h2>
          <FilterChips
            label="Qué presupuestos mostrar"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'frios', label: 'Por enfriarse', count: open.filter((o) => healthOf(o) !== 'healthy').length },
              { value: 'todos', label: 'Todos los abiertos', count: open.length },
            ]}
          />
        </div>
        <div className="hidden xl:block">
          <DataTable data={assignList} columns={assignColumns} caption="Reasignar presupuestos abiertos" initialSort={[{ id: 'seguimiento', desc: true }]} alignRight={['monto']} pageSize={8} emptyText="Ningún presupuesto se está enfriando." />
        </div>
        {assignList.length === 0 ? (
          <p className="rounded-2xl border border-linea bg-chapa px-5 py-8 text-center text-[15px] text-tiza xl:hidden">Ningún presupuesto se está enfriando.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden" aria-label="Reasignar presupuestos abiertos">
            {[...assignList]
              .sort((a, b) => (b.days_since_last_activity ?? 999) - (a.days_since_last_activity ?? 999))
              .map((o) => (
                <li key={o.id} className="rounded-2xl border border-linea bg-chapa p-4 shadow-suave">
                  <div className="flex items-start gap-3">
                    <Punta health={healthOf(o)} size={18} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/opportunities/${o.id}`} className="line-clamp-2 font-bold leading-snug hover:underline">
                        {o.title}
                      </Link>
                      <p className="truncate text-sm text-tiza">{o.company_name || o.contact_name || 'Sin cliente'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 pl-[30px]">
                    <HealthChip health={healthOf(o)} days={o.days_since_last_activity} compact />
                    <span className="cifra whitespace-nowrap font-bold">{formatARS(Number(o.estimated_value || 0))}</span>
                  </div>
                  <div className="mt-3">
                    <Select
                      aria-label={`Responsable de ${o.title}`}
                      value={o.assigned_to}
                      onChange={(v) => reassign(o, v)}
                      options={activeUsers.map((u) => ({ value: u.id, label: u.full_name, hint: ROLE_LABELS[u.role] }))}
                    />
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
