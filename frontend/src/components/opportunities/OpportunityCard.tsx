'use client';

import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { Opportunity, Stage } from '@/types/crm';
import { Punta } from '@/components/punta/Punta';
import { healthOf, HEALTH_TONE } from '@/lib/health';
import { formatARS, formatDaysAgo, sentenceCase } from '@/lib/format';

interface OpportunityCardProps {
  opp: Opportunity;
  nextStage?: Stage | null;
  onAdvance?: (opp: Opportunity, stage: Stage) => void;
  /** Versión levantada que sigue al puntero mientras se arrastra. */
  lifted?: boolean;
}

const dayTone = { verde: 'text-verde-tinta', ambar: 'text-ambar-tinta', rojo: 'text-rojo-tinta' } as const;

/** Tarjeta de presupuesto: lo justo para decidir. Todo lo demás está en su vista. */
export function OpportunityCard({ opp, nextStage, onAdvance, lifted = false }: OpportunityCardProps) {
  const health = healthOf(opp);
  const open = opp.status === 'abierta';
  const client = opp.company_name || opp.contact_name || 'Sin cliente';

  return (
    <article
      className={clsx(
        '@container group relative min-w-0 rounded-xl border bg-chapa p-4 transition-[box-shadow,border-color] duration-150',
        lifted
          ? 'border-pavonado/20 shadow-[0_24px_48px_-12px_rgb(22_33_43/0.45),0_4px_10px_rgb(22_33_43/0.12)]'
          : 'border-linea shadow-suave hover:border-linea-fuerte hover:shadow-alzada'
      )}
    >
      <div className="flex items-start gap-2.5">
        <Punta health={health} status={opp.status} size={18} className="mt-0.5" />
        <h3 className="min-w-0 flex-1 pr-5 text-[15px] font-bold leading-snug">
          <Link
            href={`/opportunities/${opp.id}`}
            className="line-clamp-2 break-words after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {opp.title}
          </Link>
        </h3>
      </div>
      <div className="mt-1 pl-[28px]">
        <p className="line-clamp-2 break-words text-sm leading-snug text-tiza">{client}</p>
        {open ? (
          <p className={clsx('mt-1 text-[13px] font-semibold', dayTone[HEALTH_TONE[health]])}>{formatDaysAgo(opp.days_since_last_activity)}</p>
        ) : (
          <p className="mt-1 text-[13px] font-semibold text-tiza">{opp.status === 'ganada' ? 'Vendido' : 'Perdido'}</p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 pl-[28px]">
        <span className="cifra min-w-0 flex-1 whitespace-nowrap text-[clamp(13px,8cqi,16px)] font-extrabold">{formatARS(opp.estimated_value)}</span>
        {open && nextStage && onAdvance && !lifted && (
          <button
            type="button"
            onClick={() => onAdvance(opp, nextStage)}
            className="relative z-[1] -mr-1.5 h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-tiza hover:bg-chapa-2 hover:text-tinta cursor-pointer"
            aria-label={`Pasar a ${sentenceCase(nextStage.name)}`}
            title={`Pasar a ${sentenceCase(nextStage.name)}`}
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        )}
      </div>
    </article>
  );
}
