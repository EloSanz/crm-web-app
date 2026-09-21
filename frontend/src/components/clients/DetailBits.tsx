import React from 'react';
import Link from 'next/link';
import type { Opportunity } from '@/types/crm';
import { Punta } from '@/components/punta/Punta';
import { healthOf } from '@/lib/health';
import { formatARS, sentenceCase } from '@/lib/format';

export function DetailSection({ title, count, action, children }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <h2 className="titular text-lg">{title}</h2>
        {count !== undefined && <span className="cifra rounded-full bg-chapa-2 px-2 py-0.5 text-[13px] font-bold text-tiza">{count}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  );
}

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-5 py-3">
      <dt className="w-24 shrink-0 pt-px text-[13px] font-semibold text-tiza">{label}</dt>
      <dd className="min-w-0 flex-1 text-[15px] break-words">{children}</dd>
    </div>
  );
}

export function OpportunityMiniList({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) return <p className="px-5 pb-5 text-[15px] text-tiza">Sin presupuestos.</p>;
  return (
    <ul className="divide-y divide-linea">
      {opportunities.map((o) => (
        <li key={o.id} className="relative flex items-center gap-3 px-5 py-3 hover:bg-chapa-2/70">
          <Punta health={healthOf(o)} status={o.status} size={16} />
          <div className="min-w-0 flex-1">
            <Link href={`/opportunities/${o.id}`} className="line-clamp-2 font-semibold leading-snug after:absolute after:inset-0">
              {o.title}
            </Link>
            <p className="truncate text-sm text-tiza">{o.status === 'ganada' ? 'Vendido' : o.status === 'perdida' ? 'Perdido' : sentenceCase(o.stage_name) || 'Abierto'}</p>
          </div>
          <span className="cifra shrink-0 text-[15px] font-bold">{formatARS(o.estimated_value)}</span>
        </li>
      ))}
    </ul>
  );
}
