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
import { ORIGIN_OPTIONS } from '@/lib/catalogs';

const load = async () => {
  const [opportunities, stages] = await Promise.all([fetchOpportunities(), fetchStages()]);
  return { opportunities, stages: [...stages].sort((a, b) => a.position - b.position) };
};

type HealthFilter = 'all' | Health;
type StatusFilter = Opportunity['status'] | 'todos';

const ALL = 'all';
const NO_ORIGIN = '__sin_origen__';
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'abierta', label: 'Abiertos' },
  { value: 'ganada', label: 'Ganados' },
  { value: 'perdida', label: 'Perdidos' },
  { value: 'todos', label: 'Todos los estados' },
];

const stageStatus = (st: Stage): Opportunity['status'] => (st.is_closed_won ? 'ganada' : st.is_closed_lost ? 'perdida' : 'abierta');

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
  const [stage, setStage] = useState(ALL);
  const [health, setHealth] = useState<HealthFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('abierta');
  const [owner, setOwner] = useState(ALL);
  const [origin, setOrigin] = useState(ALL);
  const manager = isManager(useCurrentUser());

  // Responsable y origen recortan todo, también los totales de arriba.
  const scoped = useMemo(
    () =>
      (data?.opportunities ?? []).filter(
        (o) => (owner === ALL || o.assigned_to === owner) && (origin === ALL || (origin === NO_ORIGIN ? !o.origin : o.origin === origin))
      ),
    [data, owner, origin]
  );

  const ownerOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const o of data?.opportunities ?? []) names.set(o.assigned_to, o.assigned_to_name || 'Sin nombre');
    return [...names].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([value, label]) => ({ value, label }));
  }, [data]);

  const originChoices = useMemo(() => {
    const extra = (data?.opportunities ?? []).map((o) => o.origin).filter((o): o is string => Boolean(o) && !ORIGIN_OPTIONS.includes(o as string));
    return [...ORIGIN_OPTIONS, ...[...new Set(extra)].sort()];
  }, [data]);

  /** Elegir un estado deja la etapa y el semáforo coherentes; los cerrados se ven mejor en la lista. */
  const pickStatus = (next: StatusFilter) => {
    setStatus(next);
    if (next !== 'abierta') setHealth('all');
    const st = data?.stages.find((x) => x.id === stage);
    if (st && next !== 'todos' && stageStatus(st) !== next) setStage(ALL);
    if (next === 'ganada' || next === 'perdida') setView('lista');
  };

  const pickStage = (next: string) => {
    setStage(next);
    const st = data?.stages.find((x) => x.id === next);
    if (!st) return;
    const kind = stageStatus(st);
    setStatus(kind);
    if (kind !== 'abierta') {
      setHealth('all');
      setView('lista');
    }
  };

  const filtersOn = stage !== ALL || status !== 'abierta' || owner !== ALL || origin !== ALL || health !== 'all';
  const clearFilters = () => {
    setStage(ALL);
    setStatus('abierta');
    setOwner(ALL);
    setOrigin(ALL);
    setHealth('all');
  };

  const summary = useMemo(() => {
    const counts: Record<Health, { n: number; amount: number }> = {
      healthy: { n: 0, amount: 0 },
      warning: { n: 0, amount: 0 },
      stale: { n: 0, amount: 0 },
    };
    let open = 0;
    let openTotal = 0;
    const closed = { ganada: { n: 0, amount: 0 }, perdida: { n: 0, amount: 0 } };
    for (const o of scoped) {
      if (o.status !== 'abierta') {
        closed[o.status].n += 1;
        closed[o.status].amount += Number(o.estimated_value || 0);
        continue;
      }
      open += 1;
      openTotal += Number(o.estimated_value || 0);
      const h = healthOf(o);
      counts[h].n += 1;
      counts[h].amount += Number(o.estimated_value || 0);
    }
    return { counts, open, openTotal, closed };
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((o) => {
      const s = !q || [o.title, o.company_name, o.contact_name, o.project_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      const est = status === 'todos' || o.status === status;
      const st = stage === ALL || o.stage_id === stage;
      const h = health === 'all' || (o.status === 'abierta' && healthOf(o) === health);
      return s && est && st && h;
    });
  }, [scoped, search, status, stage, health]);

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
              active={status === 'abierta' && health === 'all' && stage === ALL}
              onClick={() => {
                setHealth('all');
                setStage(ALL);
                setStatus('abierta');
              }}
              label={`Abiertos · ${summary.open}`}
              value={manager ? formatARSCompact(summary.openTotal) : undefined}
            />
            {(['healthy', 'warning', 'stale'] as Health[]).map((h) => (
              <HealthButton
                key={h}
                active={health === h}
                onClick={() => {
                  setHealth(health === h ? 'all' : h);
                  setStatus('abierta');
                  if (stage !== ALL && data.stages.find((x) => x.id === stage && stageStatus(x) !== 'abierta')) setStage(ALL);
                }}
                label={`${HEALTH_META[h].label} · ${summary.counts[h].n}`}
                value={manager ? formatARSCompact(summary.counts[h].amount) : undefined}
                color={PUNTA_COLORS[h].base}
              />
            ))}
            {data.stages
              .filter((st) => st.is_closed_won || st.is_closed_lost)
              .map((st) => {
                const won = st.is_closed_won;
                const total = summary.closed[won ? 'ganada' : 'perdida'];
                return (
                  <DroppableStage key={st.id} id={st.id} className="min-w-[128px] shrink-0 sm:min-w-0">
                    {({ isOver, isDragging }) => (
                      <HealthButton
                        active={status === (won ? 'ganada' : 'perdida') && (stage === ALL || stage === st.id)}
                        dropping={isOver}
                        waiting={isDragging}
                        onClick={() => {
                          setStage(ALL);
                          pickStatus(won ? 'ganada' : 'perdida');
                        }}
                        label={`${won ? 'Vendidos' : 'Perdidos'} · ${total.n}`}
                        value={manager ? formatARSCompact(total.amount) : undefined}
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

        <div role="group" aria-label="Filtros" className="grid grid-cols-2 gap-2.5 md:flex md:flex-wrap md:items-center">
          <div className="min-w-0 md:w-52">
            <Select
              size="sm"
              value={stage}
              onChange={pickStage}
              aria-label="Etapa"
              options={[{ value: ALL, label: 'Todas las etapas' }, ...(data?.stages ?? []).map((s) => ({ value: s.id, label: sentenceCase(s.name) }))]}
            />
          </div>
          <div className="min-w-0 md:w-44">
            <Select size="sm" value={status} onChange={(v) => pickStatus(v as StatusFilter)} aria-label="Estado" options={STATUS_OPTIONS} />
          </div>
          <div className="min-w-0 md:w-56">
            <Select
              size="sm"
              value={origin}
              onChange={setOrigin}
              aria-label="Origen"
              options={[{ value: ALL, label: 'Todos los orígenes' }, ...originChoices.map((o) => ({ value: o, label: o })), { value: NO_ORIGIN, label: 'Sin origen' }]}
            />
          </div>
          {manager && (
            <div className="min-w-0 md:w-52">
              <Select size="sm" value={owner} onChange={setOwner} aria-label="Responsable" options={[{ value: ALL, label: 'Todos los responsables' }, ...ownerOptions]} />
            </div>
          )}
          {filtersOn && (
            <Button variant="fantasma" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
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
