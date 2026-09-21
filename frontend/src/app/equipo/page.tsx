'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { createColumnHelper } from '@tanstack/react-table';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
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
import { formatARS, formatARSCompact } from '@/lib/format';

const load = async () => {
  const [opportunities, users] = await Promise.all([fetchOpportunities(), fetchUsers()]);
  return { opportunities, users };
};

interface SellerRow {
  id: string;
  name: string;
  role: string;
  open: number;
  pipeline: number;
  stale: number;
  won: number;
  wonAmount: number;
  lost: number;
  closeRate: number | null;
}

const sellerHelper = createColumnHelper<TableSetup, SellerRow>();
const assignHelper = createColumnHelper<TableSetup, Opportunity>();
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

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

  const view = useMemo(() => {
    if (!data) return null;
    const opps = data.opportunities;
    const open = opps.filter((o) => o.status === 'abierta');
    const won = opps.filter((o) => o.status === 'ganada');
    const lost = opps.filter((o) => o.status === 'perdida');
    const sum = (list: Opportunity[]) => list.reduce((a, o) => a + Number(o.estimated_value || 0), 0);
    const healthy = open.filter((o) => healthOf(o) === 'healthy');
    const rows: SellerRow[] = data.users
      .filter((u) => u.is_active || opps.some((o) => o.assigned_to === u.id))
      .map((u) => {
        const mine = opps.filter((o) => o.assigned_to === u.id);
        const mOpen = mine.filter((o) => o.status === 'abierta');
        const mWon = mine.filter((o) => o.status === 'ganada');
        const mLost = mine.filter((o) => o.status === 'perdida');
        return {
          id: u.id,
          name: u.full_name,
          role: u.role,
          open: mOpen.length,
          pipeline: sum(mOpen),
          stale: mOpen.filter((o) => healthOf(o) === 'stale').length,
          won: mWon.length,
          wonAmount: sum(mWon),
          lost: mLost.length,
          closeRate: mWon.length + mLost.length ? mWon.length / (mWon.length + mLost.length) : null,
        };
      });
    return {
      rows,
      open,
      openTotal: sum(open),
      healthyPct: open.length ? healthy.length / open.length : 0,
      wonTotal: sum(won),
      wonCount: won.length,
      closeRate: won.length + lost.length ? won.length / (won.length + lost.length) : null,
      avgTicket: won.length ? sum(won) / won.length : 0,
      maxPipeline: Math.max(1, ...rows.map((r) => r.pipeline)),
    };
  }, [data]);

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

  if (loading) return <LoadingBlock label="Cargando el tablero del equipo" rows={4} />;
  if (error || !data || !view)
    return <EmptyState illustration="presupuestos" title="No pudimos cargar el equipo" description={error ?? undefined} action={<Button variant="secundario" onClick={() => reload()}>Reintentar</Button>} />;

  const activeUsers: CrmUser[] = data.users.filter((u) => u.is_active);
  const maxPipeline = view.maxPipeline;

  const sellerColumns = sellerHelper.columns([
    sellerHelper.accessor('name', {
      header: 'Responsable',
      sortFn: 'text',
      cell: (info) => (
        <div className="min-w-0">
          <p className="truncate font-bold">{info.getValue()}</p>
          <p className="truncate text-sm text-tiza">{ROLE_LABELS[info.row.original.role] ?? info.row.original.role}</p>
        </div>
      ),
    }),
    sellerHelper.accessor('open', { header: 'Abiertos', sortFn: 'basic', sortDescFirst: true, cell: (i) => <span className="cifra font-semibold">{i.getValue()}</span> }),
    sellerHelper.accessor('pipeline', {
      header: 'Pipeline',
      sortFn: 'basic',
      sortDescFirst: true,
      cell: (i) => (
        <div className="flex min-w-[150px] items-center gap-3">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-chapa-2">
            <span className="block h-full rounded-full bg-pavonado" style={{ width: `${(i.getValue() / maxPipeline) * 100}%` }} />
          </span>
          <span className="cifra w-20 shrink-0 text-right font-bold">{formatARSCompact(i.getValue())}</span>
        </div>
      ),
    }),
    sellerHelper.accessor('stale', {
      header: 'Estancados',
      sortFn: 'basic',
      sortDescFirst: true,
      cell: (i) => <span className={i.getValue() ? 'cifra font-bold text-rojo-tinta' : 'cifra text-tiza'}>{i.getValue()}</span>,
    }),
    sellerHelper.accessor('wonAmount', { header: 'Vendido', sortFn: 'basic', sortDescFirst: true, cell: (i) => <span className="cifra font-bold">{formatARSCompact(i.getValue())}</span> }),
    sellerHelper.accessor((r) => r.closeRate ?? -1, { id: 'cierre', header: 'Cierre', sortFn: 'basic', sortDescFirst: true, cell: (i) => <span className="cifra font-semibold">{pct(i.row.original.closeRate)}</span> }),
  ]);

  const assignList = view.open.filter((o) => scope === 'todos' || healthOf(o) !== 'healthy');
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
      <PageHeader title="Equipo" />

      <section aria-label="Indicadores del equipo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pipeline abierto" value={formatARSCompact(view.openTotal)} sub={`${view.open.length} presupuestos`} dark />
        <Kpi label="Al día" value={pct(view.healthyPct)} sub="con contacto en 7 días" />
        <Kpi label="Tasa de cierre" value={pct(view.closeRate)} sub={view.wonCount === 1 ? '1 venta concretada' : `${view.wonCount} ventas concretadas`} />
        <Kpi label="Vendido" value={view.wonTotal ? formatARSCompact(view.wonTotal) : '—'} sub={view.wonCount > 1 ? `${formatARSCompact(view.avgTicket)} por venta` : undefined} />
      </section>

      <section aria-labelledby="por-responsable" className="space-y-3">
        <h2 id="por-responsable" className="titular text-lg">
          Por responsable
        </h2>
        <div className="hidden xl:block">
          <DataTable data={view.rows} columns={sellerColumns} caption="Rendimiento por responsable" initialSort={[{ id: 'pipeline', desc: true }]} alignRight={['open', 'stale', 'wonAmount', 'cierre']} />
        </div>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden" aria-label="Rendimiento por responsable">
          {[...view.rows]
            .sort((a, b) => b.pipeline - a.pipeline)
            .map((r) => (
              <li key={r.id} className="rounded-2xl border border-linea bg-chapa p-4 shadow-suave">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{r.name}</p>
                    <p className="truncate text-sm text-tiza">{ROLE_LABELS[r.role] ?? r.role}</p>
                  </div>
                  <p className="cifra shrink-0 whitespace-nowrap text-lg font-extrabold">{formatARSCompact(r.pipeline)}</p>
                </div>
                <span className="mt-3 block h-2 overflow-hidden rounded-full bg-chapa-2">
                  <span className="block h-full rounded-full bg-pavonado" style={{ width: `${(r.pipeline / maxPipeline) * 100}%` }} />
                </span>
                <p className="mt-3 text-sm text-tiza">
                  <span className="cifra font-semibold text-tinta">{r.open}</span> {r.open === 1 ? 'abierto' : 'abiertos'}
                  {r.stale > 0 && (
                    <>
                      {' · '}
                      <span className="cifra font-bold text-rojo-tinta">{r.stale}</span> {r.stale === 1 ? 'estancado' : 'estancados'}
                    </>
                  )}
                  {' · '}Cierre <span className="cifra font-semibold text-tinta">{pct(r.closeRate)}</span>
                </p>
              </li>
            ))}
        </ul>
      </section>

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
              { value: 'frios', label: 'Por enfriarse', count: view.open.filter((o) => healthOf(o) !== 'healthy').length },
              { value: 'todos', label: 'Todos los abiertos', count: view.open.length },
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

function Kpi({ label, value, sub, dark = false }: { label: string; value: string; sub?: string; dark?: boolean }) {
  return (
    <div className={dark ? '@container sobre-pavonado grano-pavonado rounded-2xl p-4 text-white sm:p-5' : '@container rounded-2xl border border-linea bg-chapa p-4 shadow-suave sm:p-5'}>
      <p className={dark ? 'text-sm text-niebla' : 'text-sm font-semibold text-tiza'}>{label}</p>
      <p className="cifra titular mt-1 whitespace-nowrap text-[clamp(20px,16cqi,34px)] leading-none">{value}</p>
      {sub && <p className={dark ? 'mt-2 text-sm text-niebla' : 'mt-2 text-sm text-tiza'}>{sub}</p>}
    </div>
  );
}
