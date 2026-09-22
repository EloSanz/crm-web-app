'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Opportunity, Stage } from '@/types/crm';
import { healthOf, HEALTH_META, type Health } from '@/lib/health';
import { formatARSCompact, sentenceCase } from '@/lib/format';
import { PUNTA_COLORS } from '@/components/punta/Punta';

const ORDER: Health[] = ['healthy', 'warning', 'stale'];
const RANK: Record<Health, number> = { healthy: 0, warning: 1, stale: 2 };
const UNHEALTHY_LABEL: Record<Exclude<Health, 'healthy'>, [string, string]> = {
  warning: ['en riesgo', 'en riesgo'],
  stale: ['estancado', 'estancados'],
};

interface Row {
  stage: Stage;
  amount: number;
  bricks: { opp: Opportunity; health: Health }[];
}

/**
 * Embudo de presupuestos abiertos: una hilada por etapa, un ladrillo por presupuesto,
 * pintado según el seguimiento. El largo de la hilada es la cantidad; el monto va escrito.
 */
export function PipelineFunnel({ opportunities, stages, showAmounts = true }: { opportunities: Opportunity[]; stages: Stage[]; showAmounts?: boolean }) {
  const [hover, setHover] = useState<string | null>(null);

  const { rows, maxCount, totals } = useMemo(() => {
    const open = opportunities.filter((o) => o.status === 'abierta');
    const openStages = stages.filter((s) => !s.is_closed_won && !s.is_closed_lost).sort((a, b) => a.position - b.position);
    const built: Row[] = openStages.map((stage) => {
      const bricks = open
        .filter((o) => o.stage_id === stage.id)
        .map((opp) => ({ opp, health: healthOf(opp) }))
        .sort((a, b) => RANK[a.health] - RANK[b.health] || Number(b.opp.estimated_value) - Number(a.opp.estimated_value));
      return { stage, bricks, amount: bricks.reduce((a, b) => a + Number(b.opp.estimated_value || 0), 0) };
    });
    const counts = ORDER.map((health) => ({ health, count: open.filter((o) => healthOf(o) === health).length }));
    return { rows: built, maxCount: Math.max(1, ...built.map((r) => r.bricks.length)), totals: counts };
  }, [opportunities, stages]);

  if (rows.every((r) => r.bricks.length === 0)) {
    return <p className="py-10 text-center text-[15px] text-tiza">Sin presupuestos abiertos.</p>;
  }

  return (
    <div>
      <ol className="space-y-5">
        {rows.map((row, i) => {
          const hovered = row.bricks.find((b) => b.opp.id === hover);
          const index = hovered ? row.bricks.indexOf(hovered) : -1;
          const tipStart = hovered ? (index / maxCount) * 100 : 0;
          const unhealthy = (['warning', 'stale'] as const)
            .map((h) => ({ h, n: row.bricks.filter((b) => b.health === h).length }))
            .filter((x) => x.n > 0);
          return (
            <li key={row.stage.id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-start gap-2 text-[15px] font-semibold leading-snug">
                  <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pavonado text-[12px] font-bold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    {sentenceCase(row.stage.name)}
                    <span className="cifra whitespace-nowrap font-medium text-tiza"> · {row.bricks.length}</span>
                  </span>
                </p>
                {showAmounts && <p className="cifra shrink-0 whitespace-nowrap font-bold">{row.amount ? formatARSCompact(row.amount) : '—'}</p>}
              </div>

              <div className="relative">
                {row.bricks.length === 0 ? (
                  <div className="h-6 rounded-[5px] border-2 border-dashed border-linea" aria-hidden />
                ) : (
                  <div className="flex h-6 gap-[3px]" style={{ width: `${(row.bricks.length / maxCount) * 100}%` }}>
                    {row.bricks.map(({ opp, health }) => (
                      <Link
                        key={opp.id}
                        href={`/opportunities/${opp.id}`}
                        aria-label={`${opp.title}: ${HEALTH_META[health].label}, ${formatARSCompact(Number(opp.estimated_value || 0))}`}
                        onMouseEnter={() => setHover(opp.id)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(opp.id)}
                        onBlur={() => setHover(null)}
                        className="min-w-[10px] flex-1 rounded-[5px] outline-offset-2 transition-[filter] hover:brightness-110"
                        style={{ background: PUNTA_COLORS[health].base }}
                      />
                    ))}
                  </div>
                )}
                {hovered && (
                  <div
                    role="status"
                    style={tipStart > 45 ? { right: 0 } : { left: `${tipStart}%` }}
                    className="pointer-events-none absolute bottom-full z-10 mb-2 max-w-[280px] rounded-lg bg-pavonado px-3 py-2 text-[13px] text-white shadow-alzada animate-aparecer"
                  >
                    <p className="truncate font-bold">{hovered.opp.title}</p>
                    <p className="text-niebla">
                      {HEALTH_META[hovered.health].label}
                      {showAmounts && (
                        <>
                          {' · '}
                          <span className="cifra font-bold text-white">{formatARSCompact(Number(hovered.opp.estimated_value || 0))}</span>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {unhealthy.length > 0 && (
                <p className="mt-1.5 text-sm text-tiza">
                  {unhealthy.map((x) => `${x.n} ${UNHEALTHY_LABEL[x.h][x.n === 1 ? 0 : 1]}`).join(' · ')}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <dl className="mt-6 grid grid-cols-3 border-t border-linea pt-4">
        {totals.map((t, i) => (
          <div key={t.health} className={i ? 'min-w-0 border-l border-linea pl-3 sm:pl-4' : 'min-w-0'}>
            <dt className="flex items-center gap-1.5 text-[13px] text-tiza sm:text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: PUNTA_COLORS[t.health].base }} aria-hidden />
              {HEALTH_META[t.health].label}
            </dt>
            <dd className="cifra mt-1 text-lg font-extrabold">{t.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
