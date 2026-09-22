'use client';

import React from 'react';
import clsx from 'clsx';
import { ChevronDown, Minus, Plus, RefreshCw } from 'lucide-react';
import type { OpportunityVersion } from '@/types/crm';
import { formatARS, formatDateTime, formatQty } from '@/lib/format';

type Item = OpportunityVersion['items'][number];
type Change = { kind: 'alta' | 'baja' | 'cambio'; text: string };

const keyOf = (it: Item) => it.product_id || it.product_name;

/** Qué cambió entre dos versiones: materiales agregados, quitados, cantidades, precios y descuentos. */
function diff(prev: OpportunityVersion, next: OpportunityVersion): Change[] {
  const before = new Map(prev.items.map((it) => [keyOf(it), it]));
  const after = new Map(next.items.map((it) => [keyOf(it), it]));
  const out: Change[] = [];
  for (const [k, it] of after) {
    const old = before.get(k);
    if (!old) {
      out.push({ kind: 'alta', text: `${it.product_name} · ${formatQty(it.quantity, it.unit)}` });
      continue;
    }
    const parts: string[] = [];
    if (Number(old.quantity) !== Number(it.quantity)) parts.push(`${formatQty(old.quantity, old.unit)} → ${formatQty(it.quantity, it.unit)}`);
    if (Number(old.unit_price) !== Number(it.unit_price)) parts.push(`${formatARS(old.unit_price)} → ${formatARS(it.unit_price)} c/u${it.price_tier === 'mayorista' ? ' (mayorista)' : ''}`);
    if (Number(old.discount_pct ?? 0) !== Number(it.discount_pct ?? 0)) parts.push(`descuento ${Number(old.discount_pct ?? 0)}% → ${Number(it.discount_pct ?? 0)}%`);
    if (parts.length) out.push({ kind: 'cambio', text: `${it.product_name}: ${parts.join(' · ')}` });
  }
  for (const [k, it] of before) if (!after.has(k)) out.push({ kind: 'baja', text: `${it.product_name} · ${formatQty(it.quantity, it.unit)}` });
  if (Number(prev.discount_pct) !== Number(next.discount_pct)) out.push({ kind: 'cambio', text: `Descuento general: ${Number(prev.discount_pct)}% → ${Number(next.discount_pct)}%` });
  return out;
}

const ICON = { alta: Plus, baja: Minus, cambio: RefreshCw };

/** Historial de versiones del presupuesto (cada renegociación de materiales o descuento). */
export function VersionHistory({ versions }: { versions: OpportunityVersion[] }) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  return (
    <section id="versiones" aria-labelledby="versiones-titulo" className="scroll-mt-6 overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
      <h2 id="versiones-titulo" className="titular px-5 pb-3 pt-5 text-lg">
        Versiones
      </h2>
      <ol className="divide-y divide-linea border-t border-linea">
        {sorted.map((v, i) => {
          const prev = sorted[i + 1];
          const changes = prev ? diff(prev, v) : [];
          const delta = prev ? Number(v.total) - Number(prev.total) : null;
          return (
            <li key={v.id}>
              <details className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-chapa-2/60 [&::-webkit-details-marker]:hidden">
                  <span
                    className={clsx(
                      'cifra h-8 min-w-8 shrink-0 inline-flex items-center justify-center rounded-full px-2 text-[13px] font-bold',
                      i === 0 ? 'bg-pavonado text-white' : 'bg-chapa-2 text-tinta'
                    )}
                  >
                    v{v.version}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{i === 0 ? 'Vigente' : v.version === 1 ? 'Versión inicial' : `Versión ${v.version}`}</span>
                    <span className="block truncate text-[13px] text-tiza">
                      {formatDateTime(v.created_at)}
                      {v.created_by_name && ` · ${v.created_by_name}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="cifra block text-[15px] font-bold">{formatARS(v.total)}</span>
                    {delta !== null && delta !== 0 && (
                      <span className="cifra block text-[13px] font-semibold text-tiza">
                        {delta > 0 ? '+' : '−'} {formatARS(Math.abs(delta))}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 text-tiza transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-2 px-5 pb-4 pl-[64px]">
                  {v.note && <p className="text-sm font-medium break-words">“{v.note}”</p>}
                  {prev ? (
                    changes.length ? (
                      <ul className="space-y-1">
                        {changes.map((c, j) => {
                          const Icon = ICON[c.kind];
                          return (
                            <li key={j} className="flex items-start gap-2 text-sm">
                              <Icon className="mt-0.5 w-3.5 h-3.5 shrink-0 text-tiza" aria-label={c.kind === 'alta' ? 'Agregado' : c.kind === 'baja' ? 'Quitado' : 'Cambio'} />
                              <span className="min-w-0 break-words">{c.text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-tiza">Sin cambios en los materiales.</p>
                    )
                  ) : (
                    <p className="text-sm text-tiza">
                      {v.items.length} {v.items.length === 1 ? 'material' : 'materiales'} cotizados.
                    </p>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
