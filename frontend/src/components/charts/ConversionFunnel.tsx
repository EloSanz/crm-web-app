'use client';

import React, { useState } from 'react';
import { CHART } from './palette';
import { ChartTooltip, type TooltipState } from './Tooltip';
import { useChartWidth } from './hooks';
import { fmtInt, fmtPct, stagger } from './format';

export interface FunnelStep {
  key: string;
  label: string;
  entered: number;
  advanced: number;
  enCurso: number;
  lost: number;
  back: number;
  advanceRate: number | null;
}

/** Qué pasó en cada etapa: avanzó (pavonado), sigue en curso (pavonado claro), volvió atrás (trama) o se perdió (rojo, resultado de venta). */
export const FUNNEL_PARTS = [
  { key: 'advanced', label: 'Avanzó', color: CHART.magnitude },
  { key: 'enCurso', label: 'En curso', color: CHART.soft },
  { key: 'back', label: 'Volvió atrás', color: CHART.hatch },
  { key: 'lost', label: 'Se perdió', color: CHART.lost },
] as const;

/**
 * Embudo de conversión por etapa: el largo de cada hilada es cuántos presupuestos pasaron por la etapa;
 * los tramos dicen cómo salieron. A la derecha, el % que avanzó de los que ya salieron.
 */
export function ConversionFunnel({ steps, label }: { steps: FunnelStep[]; label: string }) {
  const [ref, width] = useChartWidth<HTMLOListElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const max = Math.max(1, ...steps.map((s) => s.entered));

  const show = (s: FunnelStep, el: HTMLElement) => {
    setTip({
      title: s.label,
      rows: [
        { label: 'pasaron por la etapa', value: fmtInt(s.entered) },
        ...FUNNEL_PARTS.map((p) => ({ label: p.label.toLowerCase(), value: fmtInt(s[p.key]), color: p.color })),
      ],
      x: Math.max(24, (s.entered / max) * width * 0.8),
      y: el.offsetTop + el.offsetHeight - 12,
    });
  };

  return (
    <div className="relative">
      <ol ref={ref} aria-label={label} className="relative space-y-4">
        {steps.map((s, i) => {
          const parts = FUNNEL_PARTS.filter((p) => s[p.key] > 0);
          const aria = `${s.label}: ${s.entered} presupuestos; ${FUNNEL_PARTS.map((p) => `${p.label.toLowerCase()} ${s[p.key]}`).join(', ')}${
            s.advanceRate !== null ? `; avanza el ${fmtPct(s.advanceRate)}` : ''
          }`;
          return (
            <li
              key={s.key}
              tabIndex={0}
              aria-label={aria}
              className="rounded-lg outline-offset-4"
              onMouseEnter={(e) => show(s, e.currentTarget)}
              onMouseLeave={() => setTip(null)}
              onFocus={(e) => show(s, e.currentTarget)}
              onBlur={() => setTip(null)}
            >
              <div className="mb-1.5 flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-start gap-2 text-[15px] font-semibold leading-snug">
                  <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pavonado text-[12px] font-bold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    {s.label}
                    <span className="cifra whitespace-nowrap font-medium text-tiza"> · {fmtInt(s.entered)}</span>
                  </span>
                </p>
                <p className="shrink-0 whitespace-nowrap text-right">
                  <span className="cifra font-bold">{s.advanceRate === null ? '—' : fmtPct(s.advanceRate)}</span>
                  <span className="text-[13px] text-tiza"> avanza</span>
                </p>
              </div>
              <div className="h-6">
                {s.entered === 0 ? (
                  <div className="h-full rounded-[5px] border-2 border-dashed border-linea" aria-hidden />
                ) : (
                  <div className="graf-barra flex h-full gap-[2px]" style={{ width: `${(s.entered / max) * 100}%`, animationDelay: stagger(i, 60) }}>
                    {parts.map((p) => (
                      <span key={p.key} className="h-full min-w-[3px] rounded-[5px]" style={{ flexGrow: s[p.key], flexBasis: 0, background: p.color }} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <ChartTooltip tip={tip} width={width} />
    </div>
  );
}
