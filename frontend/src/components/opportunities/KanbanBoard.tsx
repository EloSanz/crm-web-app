'use client';

import React from 'react';
import clsx from 'clsx';
import type { Opportunity, Stage } from '@/types/crm';
import { OpportunityCard } from './OpportunityCard';
import { DraggableCard, DroppableStage } from './BoardDnd';
import { formatARSCompact, sentenceCase } from '@/lib/format';

interface KanbanBoardProps {
  stages: Stage[];
  opportunities: Opportunity[];
  onMove: (opp: Opportunity, stage: Stage) => void;
  /** Total en pesos por columna: sólo admin y responsable comercial (los vendedores no ven indicadores). */
  showTotals?: boolean;
}

/**
 * El embudo: las cuatro etapas abiertas entran enteras en escritorio y se deslizan en el celular.
 * Va dentro de <BoardDnd>, que maneja el arrastre y los destinos Vendidos / Perdidos.
 */
export function KanbanBoard({ stages, opportunities, onMove, showTotals = true }: KanbanBoardProps) {
  const openStages = stages.filter((s) => !s.is_closed_won && !s.is_closed_lost);

  return (
    <div className="-mx-4 snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 xl:mx-0 xl:snap-none xl:overflow-visible xl:px-0 [&::-webkit-scrollbar]:hidden">
      <ol className="flex w-max items-start gap-3 xl:grid xl:w-full xl:grid-cols-4" aria-label="Embudo por etapa">
        {openStages.map((stage, idx) => {
          const items = opportunities.filter((o) => o.stage_id === stage.id);
          const total = items.reduce((a, o) => a + Number(o.estimated_value || 0), 0);
          const next = openStages[idx + 1] ?? null;
          return (
            <li key={stage.id} className="w-[84vw] shrink-0 snap-start sm:w-[300px] xl:w-auto xl:min-w-0">
              <DroppableStage id={stage.id}>
                {({ isOver, isDragging }) => (
                  <div
                    className={clsx(
                      'flex flex-col rounded-2xl transition-[background-color,box-shadow] duration-200',
                      isOver
                        ? 'bg-[#e3e8ed] shadow-[inset_0_0_0_2px_var(--color-pavonado)]'
                        : isDragging
                          ? 'bg-[#e2e6e4] shadow-[inset_0_0_0_1.5px_var(--color-linea-fuerte)]'
                          : 'bg-[#e2e6e4]/70'
                    )}
                  >
                    <header className="flex items-start gap-2 px-3.5 pb-1 pt-3.5">
                      <span className="cifra mt-px h-5 w-5 shrink-0 rounded-full bg-pavonado text-center text-[12px] font-bold leading-5 text-white" aria-hidden>
                        {idx + 1}
                      </span>
                      <h2 className="min-w-0 flex-1 text-[15px] font-bold leading-snug">{sentenceCase(stage.name)}</h2>
                      <span className="cifra shrink-0 rounded-full bg-chapa px-2 py-0.5 text-[13px] font-bold" aria-label={`${items.length} presupuestos`}>
                        {items.length}
                      </span>
                    </header>
                    {showTotals ? <p className="cifra px-3.5 pb-3 pl-[42px] text-sm font-semibold text-tiza">{formatARSCompact(total)}</p> : <div className="pb-2" />}
                    <div className="flex min-h-[120px] flex-col gap-2 px-2 pb-2 lg:max-h-[calc(100dvh-340px)] lg:overflow-y-auto">
                      {items.length === 0 ? (
                        <p
                          className={clsx(
                            'm-1 flex min-h-[96px] items-center justify-center rounded-xl border border-dashed px-3 text-center text-sm transition-colors',
                            isOver ? 'border-pavonado text-tinta' : 'border-linea-fuerte text-tiza'
                          )}
                        >
                          {isDragging ? 'Soltá acá' : 'Vacío'}
                        </p>
                      ) : (
                        items.map((opp) => (
                          <DraggableCard key={opp.id} opp={opp}>
                            <OpportunityCard opp={opp} nextStage={next} onAdvance={onMove} />
                          </DraggableCard>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </DroppableStage>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
