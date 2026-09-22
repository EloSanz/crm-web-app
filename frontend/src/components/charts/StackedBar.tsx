'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChartTooltip, type TooltipRow, type TooltipState } from './Tooltip';
import { axisWidth, barPath, useActiveIndex, XLabels, YGrid } from './axes';
import { useChartWidth } from './hooks';
import { niceTicks, stagger } from './format';

export interface StackSeries {
  key: string;
  label: string;
  color: string;
  /** Vertical: la serie crece hacia abajo desde la línea de cero (p. ej. "perdido" frente a "vendido"). */
  negative?: boolean;
}

export interface StackDatum {
  key: string;
  label: string;
  values: Record<string, number>;
  href?: string;
  /** Título del tooltip (por defecto, la etiqueta). */
  title?: string;
  /** Filas extra del tooltip, después de las series. */
  details?: TooltipRow[];
}

interface StackedBarProps {
  data: StackDatum[];
  series: StackSeries[];
  format: (n: number) => string;
  label: string;
  orientation?: 'vertical' | 'horizontal';
  height?: number;
  axisFormat?: (n: number) => string;
  /** Horizontal: qué mostrar a la derecha de cada renglón (por defecto, el total). */
  totalOf?: (d: StackDatum) => string;
}

const GAP = 2;

/**
 * Barras apiladas por serie, con 2px de chapa entre segmentos. Vertical en SVG (por período, admite
 * series negativas para vendido/perdido) u horizontal en HTML (por vendedor, por obra).
 */
export function StackedBar(props: StackedBarProps) {
  return props.orientation === 'horizontal' ? <HorizontalStack {...props} /> : <VerticalStack {...props} />;
}

function rowsFor(d: StackDatum, series: StackSeries[], format: (n: number) => string): TooltipRow[] {
  return [...series.map((s) => ({ label: s.label, value: format(d.values[s.key] ?? 0), color: s.color })), ...(d.details ?? [])];
}

function VerticalStack({ data, series, format, label, height = 240, axisFormat = format }: StackedBarProps) {
  const [ref, width] = useChartWidth();
  const { active, setActive, focusProps } = useActiveIndex(data.length);
  const up = series.filter((s) => !s.negative);
  const down = series.filter((s) => s.negative);
  const sum = (d: StackDatum, list: StackSeries[]) => list.reduce((a, s) => a + Math.max(0, d.values[s.key] ?? 0), 0);
  const maxUp = Math.max(0, ...data.map((d) => sum(d, up)));
  const maxDown = Math.max(0, ...data.map((d) => sum(d, down)));

  const integer = data.every((d) => series.every((s) => Number.isInteger(d.values[s.key] ?? 0)));
  // La mitad negativa sólo aparece si hay datos de ese lado; si no, el eje arranca en cero.
  const hasDown = down.length > 0 && maxDown > 0;
  const upTicks = niceTicks(maxUp || (hasDown ? 0 : 1), hasDown ? 2 : 4, integer);
  const downTicks = hasDown ? niceTicks(maxDown, 2, integer) : [0];
  const topV = maxUp || !hasDown ? upTicks[upTicks.length - 1] : 0;
  const botV = hasDown ? downTicks[downTicks.length - 1] : 0;
  const ticks = [...downTicks.slice(1).map((t) => -t).reverse(), ...(maxUp || !hasDown ? upTicks : [0])];
  const tickLabel = (v: number) => (v < 0 ? axisFormat(-v) : axisFormat(v));

  const padL = axisWidth(ticks.map(tickLabel));
  const padT = 16;
  const padB = 28;
  const plotW = Math.max(0, width - padL - 8);
  const plotH = height - padT - padB;
  const span = topV + botV || 1;
  const y = (v: number) => padT + ((topV - v) / span) * plotH;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, band * 0.62);
  const cx = (i: number) => padL + band * i + band / 2;

  const current = active !== null ? data[active] : null;
  const tip: TooltipState | null = current
    ? { title: current.title ?? current.label, rows: rowsFor(current, series, format), x: cx(active!), y: y(sum(current, up)) }
    : null;

  const segments = (d: StackDatum, list: StackSeries[], dir: 'up' | 'down') => {
    let acc = 0;
    const present = list.filter((s) => (d.values[s.key] ?? 0) > 0);
    return present.map((s, idx) => {
      const v = d.values[s.key] ?? 0;
      const from = acc;
      acc += v;
      const outer = idx === present.length - 1;
      const y1 = dir === 'up' ? y(acc) : y(-from);
      const y2 = dir === 'up' ? y(from) : y(-acc);
      // 2px de chapa entre segmentos y 1px sobre la línea de cero para que se vea la base.
      const inset = idx > 0 ? GAP : 1;
      const h = Math.max(1.5, y2 - y1 - inset);
      const yy = dir === 'up' ? y1 : y1 + inset;
      return { key: s.key, color: s.color, path: outer ? barPath(0, yy, barW, h, 4, dir) : `M0,${yy}h${barW}v${h}h${-barW}Z` };
    });
  };

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible rounded-lg" onMouseLeave={() => setActive(null)} {...focusProps}>
          <YGrid ticks={ticks} y={y} left={padL} right={width - 4} format={tickLabel} />
          {data.map((d, i) => (
            <g key={d.key} transform={`translate(${cx(i) - barW / 2},0)`} opacity={active === null || active === i ? 1 : 0.55} className="transition-opacity">
              <g className="graf-col" style={{ animationDelay: stagger(i) }}>
                {segments(d, up, 'up').map((s) => (
                  <path key={s.key} d={s.path} fill={s.color} />
                ))}
              </g>
              {down.length > 0 && (
                <g className="graf-col graf-col-abajo" style={{ animationDelay: stagger(i) }}>
                  {segments(d, down, 'down').map((s) => (
                    <path key={s.key} d={s.path} fill={s.color} />
                  ))}
                </g>
              )}
            </g>
          ))}
          {data.map((d, i) => (
            <rect key={d.key} x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} onMouseMove={() => active !== i && setActive(i)} />
          ))}
          <XLabels labels={data.map((d) => d.label)} x={cx} y={height - 8} band={band} />
        </svg>
      )}
      {width === 0 && <div style={{ height }} />}
      <ChartTooltip tip={tip} width={width} />
    </div>
  );
}

function HorizontalStack({ data, series, format, label, totalOf }: StackedBarProps) {
  const [ref, width] = useChartWidth<HTMLUListElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const total = (d: StackDatum) => series.reduce((a, s) => a + Math.max(0, d.values[s.key] ?? 0), 0);
  const max = Math.max(0, ...data.map(total));

  const show = (d: StackDatum, el: HTMLElement) => {
    setTip({ title: d.title ?? d.label, rows: rowsFor(d, series, format), x: Math.max(24, (max ? total(d) / max : 0) * width), y: el.offsetTop + el.offsetHeight - 12 });
  };

  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} className="relative space-y-3.5">
        {data.map((d, i) => {
          const t = total(d);
          const present = series.filter((s) => (d.values[s.key] ?? 0) > 0);
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-semibold group-hover:underline">{d.label}</span>
                <span className="cifra shrink-0 whitespace-nowrap text-[15px] font-bold">{totalOf ? totalOf(d) : format(t)}</span>
              </span>
              <span className="mt-1.5 block h-2.5">
                {t > 0 && (
                  <span className="graf-barra flex h-full gap-[2px]" style={{ width: `max(3px, ${(t / (max || 1)) * 100}%)`, animationDelay: stagger(i) }}>
                    {present.map((s, idx) => (
                      <span
                        key={s.key}
                        className={idx === present.length - 1 ? 'h-full rounded-r-[4px]' : 'h-full'}
                        style={{ flexGrow: d.values[s.key], flexBasis: 0, minWidth: 2, background: s.color }}
                      />
                    ))}
                  </span>
                )}
              </span>
            </>
          );
          const handlers = {
            onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(d, e.currentTarget),
            onMouseLeave: () => setTip(null),
            onFocus: (e: React.FocusEvent<HTMLElement>) => show(d, e.currentTarget),
            onBlur: () => setTip(null),
          };
          const aria = `${d.label}: ${series.map((s) => `${s.label} ${format(d.values[s.key] ?? 0)}`).join(', ')}`;
          return (
            <li key={d.key}>
              {d.href ? (
                <Link href={d.href} aria-label={aria} className="group block rounded-lg outline-offset-4" {...handlers}>
                  {body}
                </Link>
              ) : (
                <div tabIndex={0} aria-label={aria} className="group block rounded-lg outline-offset-4" {...handlers}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ChartTooltip tip={tip} width={width} />
    </div>
  );
}

