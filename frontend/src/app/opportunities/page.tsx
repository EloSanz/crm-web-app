'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Kanban, List, Plus, Search, Trophy, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { KanbanBoard } from '@/components/opportunities/KanbanBoard';
import { OpportunityList } from '@/components/opportunities/OpportunityList';
import { useStageTransitions } from '@/components/opportunities/useStageTransitions';
import { BoardDnd, DroppableStage } from '@/components/opportunities/BoardDnd';
import type { Opportunity, Stage } from '@/types/crm';
import { PUNTA_COLORS } from '@/components/punta/Punta';
import { fetchOpportunities, fetchStages } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { healthOf, HEALTH_META, type Health } from '@/lib/health';
import { formatARSCompact, sentenceCase } from '@/lib/format';
import { useCurrentUser } from '@/lib/useUser';
import { isManager } from '@/lib/roles';

const load = async () => {
  const [opportunities, stages] = await Promise.all([fetchOpportunities(), fetchStages()]);
  return { opportunities, stages: [...stages].sort((a, b) => a.position - b.position) };
};

type HealthFilter = 'all' | Health;

const EMPTY_OPPS: Opportunity[] = [];
const EMPTY_STAGES: Stage[] = [];

export default function OpportunitiesPage() {
  const { data, error, loading, reload, setData } = useLoad(load);
  const { moveTo, dialogs } = useStageTransitions(reload, (oppId, update) =>
    setData((prev) => {
      if (!prev) return prev;
      const st = prev.stages.find((s) => s.id === update.stage_id);
      return {
        ...prev,
        opportunities: prev.opportunities.map((o) =>
          o.id === oppId
            ? {
                ...o,
                ...update,
                ...(st ? { stage_name: st.name, stage_slug: st.slug, stage_color: st.color } : {}),
              } as Opportunity
            : o
        ),
      };
    })
  );
  const [view, setView] = useState<'tablero' | 'lista'>('tablero');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [health, setHealth] = useState<HealthFilter>('all');
  const manager = isManager(useCurrentUser());

  const summary = useMemo(() => {
    const counts: Record<Health, { n: number; amount: number }> = {
      healthy: { n: 0, amount: 0 },
      warning: { n: 0, amount: 0 },
      stale: { n: 0, amount: 0 },
    };
    let open = 0;
    let openTotal = 0;
    for (const o of data?.opportunities ?? []) {
      if (o.status !== 'abierta') continue;
      open += 1;
      openTotal += Number(o.estimated_value || 0);
      const h = healthOf(o);
      counts[h].n += 1;
      counts[h].amount += Number(o.estimated_value || 0);
    }
    return { counts, open, openTotal };
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.opportunities ?? []).filter((o) => {
      const s = !q || [o.title, o.company_name, o.contact_name, o.project_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      // «Abiertos» muestra sólo lo abierto; los cerrados se ven desde Vendidos / Perdidos o eligiendo su etapa.
      const st = stage === 'all' ? o.status === 'abierta' : o.stage_id === stage;
      const h = health === 'all' || (o.status === 'abierta' && healthOf(o) === health);
      return s && st && h;
    });
  }, [data, search, stage, health]);

  return (
    <AppLayout>
      <BoardDnd opportunities={data?.opportunities ?? EMPTY_OPPS} stages={data?.stages ?? EMPTY_STAGES} onMove={moveTo}>
      <div className="space-y-6">
        <PageHeader
          title="Presupuestos"
          actions={
            <ButtonLink href="/opportunities/nuevo" size="lg">
              <Plus className="w-5 h-5" aria-hidden />
              Nuevo presupuesto
            </ButtonLink>
          }
        />

        {data && (
          <div
            role="group"
            aria-label="Filtros del embudo"
            className="flex gap-1 overflow-x-auto rounded-2xl border border-linea bg-chapa p-1.5 [scrollbar-width:none] sm:grid sm:grid-cols-3 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden"
          >
            <HealthButton
              active={health === 'all' && stage === 'all'}
              onClick={() => {
                setHealth('all');
                setStage('all');
              }}
              label={`Abiertos · ${summary.open}`}
              value={manager ? formatARSCompact(summary.openTotal) : undefined}
            />
            {(['healthy', 'warning', 'stale'] as Health[]).map((h) => (
              <HealthButton
                key={h}
                active={health === h}
                onClick={() => setHealth(health === h ? 'all' : h)}
                label={`${HEALTH_META[h].label} · ${summary.counts[h].n}`}
                value={manager ? formatARSCompact(summary.counts[h].amount) : undefined}
                color={PUNTA_COLORS[h].base}
              />
            ))}
            {data.stages
              .filter((st) => st.is_closed_won || st.is_closed_lost)
              .map((st) => {
                const items = data.opportunities.filter((o) => o.stage_id === st.id);
                const won = st.is_closed_won;
                return (
                  <DroppableStage key={st.id} id={st.id} className="min-w-[128px] shrink-0 sm:min-w-0">
                    {({ isOver, isDragging }) => (
                      <HealthButton
                        active={stage === st.id}
                        dropping={isOver}
                        waiting={isDragging}
                        onClick={() => {
                          setHealth('all');
                          setStage(st.id);
                          setView('lista');
                        }}
                        label={`${won ? 'Vendidos' : 'Perdidos'} · ${items.length}`}
                        value={manager ? formatARSCompact(items.reduce((a, o) => a + Number(o.estimated_value || 0), 0)) : undefined}
                        icon={won ? <Trophy className="w-3 h-3 text-verde" aria-hidden /> : <XCircle className="w-3 h-3 text-tiza" aria-hidden />}
                      />
                    )}
                  </DroppableStage>
                );
              })}
          </div>
        )}

        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <SearchInput
            icon={<Search className="w-4.5 h-4.5" />}
            className="flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar presupuesto, cliente u obra"
            aria-label="Buscar presupuestos"
          />
          <div className="flex gap-2.5">
            <div className="min-w-0 flex-1 md:w-60 md:flex-none">
              <Select
                value={stage}
                onChange={setStage}
                aria-label="Etapa"
                options={[{ value: 'all', label: 'Todas las etapas' }, ...(data?.stages ?? []).map((s) => ({ value: s.id, label: sentenceCase(s.name) }))]}
              />
            </div>
            <Segmented
              label="Vista"
              value={view}
              onChange={setView}
              options={[
                { value: 'tablero', label: <span className="sr-only">Tablero</span>, icon: <Kanban className="w-4.5 h-4.5" aria-hidden /> },
                { value: 'lista', label: <span className="sr-only">Lista</span>, icon: <List className="w-4.5 h-4.5" aria-hidden /> },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Cargando presupuestos" />
        ) : error || !data ? (
          <EmptyState illustration="presupuestos"
            title="No pudimos cargar los presupuestos"
            description={error ?? undefined}
            action={
              <Button variant="secundario" onClick={() => reload()}>
                Reintentar
              </Button>
            }
          />
        ) : data.opportunities.length === 0 ? (
          <EmptyState illustration="presupuestos"
            title="Todavía no hay presupuestos"
            action={
              <ButtonLink href="/opportunities/nuevo">
                <Plus className="w-4 h-4" aria-hidden />
                Nuevo presupuesto
              </ButtonLink>
            }
          />
        ) : view === 'tablero' ? (
          <KanbanBoard stages={data.stages} opportunities={filtered} onMove={moveTo} showTotals={manager} />
        ) : filtered.length === 0 ? (
          <EmptyState illustration="presupuestos" title="Nada con esos filtros" />
        ) : (
          <OpportunityList opportunities={filtered} stages={data.stages} />
        )}
      </div>
      </BoardDnd>
      {dialogs}
    </AppLayout>
  );
}

function HealthButton({
  active,
  dropping,
  waiting,
  onClick,
  label,
  value,
  color,
  icon,
}: {
  active: boolean;
  dropping?: boolean;
  waiting?: boolean;
  onClick: () => void;
  label: string;
  /** Monto del filtro: sólo para admin y responsable comercial (los vendedores no ven indicadores). */
  value?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'h-full w-full min-w-[128px] shrink-0 rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow] cursor-pointer sm:min-w-0',
        active
          ? 'bg-pavonado text-white'
          : dropping
            ? 'bg-[#e3e8ed] shadow-[inset_0_0_0_2px_var(--color-pavonado)]'
            : waiting
              ? 'shadow-[inset_0_0_0_1.5px_var(--color-linea-fuerte)]'
              : 'hover:bg-chapa-2'
      )}
    >
      <span className={clsx('flex items-center gap-1.5 text-[12.5px] font-semibold', active ? 'text-niebla' : 'text-tiza')}>
        {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {value && <span className="cifra block truncate text-[15px] font-extrabold">{value}</span>}
    </button>
  );
}
