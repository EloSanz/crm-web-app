'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { CHART } from './palette';
import { ChartTooltip, type TooltipRow, type TooltipState } from './Tooltip';
import { axisWidth, barPath, useActiveIndex, XLabels, YGrid } from './axes';
import { useChartWidth } from './hooks';
import { niceTicks, stagger } from './format';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Destino del renglón (drill-down). */
  href?: string;
  /** Texto secundario debajo del nombre. */
  sub?: string;
  /** Marca de referencia sobre la misma escala (mediana, promedio del equipo). */
  marker?: number | null;
  /** Filas extra del tooltip, después del valor. */
  details?: TooltipRow[];
  /** Pinta la barra con el tono suave (p. ej. "en curso"). */
  soft?: boolean;
  /** Color propio, sólo cuando el dato ES salud o resultado (siempre con su etiqueta al lado). */
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  format: (n: number) => string;
  /** Nombre del valor en el tooltip ("Vendido", "Días promedio"). */
  valueLabel: string;
  /** Resumen para lectores de pantalla. */
  label: string;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  markerColor?: string;
  markerLabel?: string;
  /** Vertical: alto del área de dibujo (incluye el eje X). */
  height?: number;
  axisFormat?: (n: number) => string;
  /** Vertical: título del tooltip y de la tabla (por defecto, la etiqueta). */
  titleOf?: (d: BarDatum) => string;
}

/** Barras de una sola serie en pavonado. Horizontal (ranking, HTML) o vertical (tiempo, SVG). */
export function BarChart(props: BarChartProps) {
  return props.orientation === 'vertical' ? <VerticalBars {...props} /> : <HorizontalBars {...props} />;
}

function HorizontalBars({ data, format, valueLabel, label, color = CHART.magnitude, markerColor = CHART.ink, markerLabel }: BarChartProps) {
  const [ref, width] = useChartWidth<HTMLUListElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const max = Math.max(0, ...data.map((d) => Math.max(d.value, d.marker ?? 0)));
  const fillOf = (d: BarDatum) => d.color ?? (d.soft ? CHART.soft : color);

  const show = (d: BarDatum, el: HTMLElement) => {
    const pct = max ? d.value / max : 0;
    const rows: TooltipRow[] = [{ label: valueLabel, value: format(d.value), color: fillOf(d) }];
    if (d.marker != null && markerLabel) rows.push({ label: markerLabel, value: format(d.marker), color: markerColor });
    setTip({ title: d.label, rows: [...rows, ...(d.details ?? [])], x: Math.max(24, pct * width), y: el.offsetTop + el.offsetHeight - 12 });
  };

  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} className="relative space-y-3.5">
        {data.map((d, i) => {
          const pct = max ? (d.value / max) * 100 : 0;
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className={clsx('min-w-0 truncate text-[15px] font-semibold', d.href && 'group-hover:underline')}>{d.label}</span>
                <span className="cifra shrink-0 whitespace-nowrap text-[15px] font-bold">{format(d.value)}</span>
              </span>
              {d.sub && <span className="block truncate text-[13px] text-tiza">{d.sub}</span>}
              <span className="relative mt-1.5 block h-2.5">
                {d.value > 0 && (
                  <span
                    className="graf-barra block h-full rounded-r-[4px] transition-[filter] group-hover:brightness-125"
                    style={{ width: `max(3px, ${pct}%)`, background: fillOf(d), animationDelay: stagger(i) }}
                  />
                )}
                {d.marker != null && max > 0 && (
                  <span
                    aria-hidden
                    className="graf-fundido absolute -top-1 h-[18px] w-[3px] rounded-full"
                    style={{ left: `calc(${(d.marker / max) * 100}% - 1.5px)`, background: markerColor, boxShadow: `0 0 0 2px ${CHART.surface}` }}
                  />
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
          const aria = `${d.label}: ${format(d.value)}${d.marker != null && markerLabel ? `, ${markerLabel.toLowerCase()} ${format(d.marker)}` : ''}`;
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

function VerticalBars({ data, format, valueLabel, label, color = CHART.magnitude, height = 220, axisFormat = format, titleOf = (d) => d.label }: BarChartProps) {
  const [ref, width] = useChartWidth();
  const { active, setActive, focusProps } = useActiveIndex(data.length);
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max, 4, data.every((d) => Number.isInteger(d.value)));
  const top = ticks[ticks.length - 1] || 1;
  const padL = axisWidth(ticks.map(axisFormat));
  const padT = 20;
  const padB = 28;
  const plotW = Math.max(0, width - padL - 8);
  const plotH = height - padT - padB;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, band * 0.62);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const cx = (i: number) => padL + band * i + band / 2;
  const maxIndex = data.findIndex((d) => d.value === max && max > 0);

  const current = active !== null ? data[active] : null;
  const tip: TooltipState | null = current
    ? {
        title: titleOf(current),
        rows: [{ label: valueLabel, value: format(current.value), color }, ...(current.details ?? [])],
        x: cx(active!),
        y: y(current.value),
      }
    : null;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          className="block overflow-visible rounded-lg"
          onMouseLeave={() => setActive(null)}
          {...focusProps}
        >
          <YGrid ticks={ticks} y={y} left={padL} right={width - 4} format={axisFormat} />
          {data.map((d, i) => {
            const h = Math.max(0, y(0) - y(d.value));
            return (
              <g key={d.key}>
                <path
                  d={barPath(cx(i) - barW / 2, y(d.value), barW, h > 0 && h < 2 ? 2 : h, 4, 'up')}
                  fill={active === i ? CHART.magnitudeHover : color}
                  className="graf-col transition-[fill]"
                  style={{ animationDelay: stagger(i) }}
                />
                {i === maxIndex && barW >= 10 && (
                  <text x={cx(i)} y={y(d.value) - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill={CHART.ink} className="cifra graf-fundido">
                    {axisFormat(d.value)}
                  </text>
                )}
                <rect
                  x={padL + band * i}
                  y={padT}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onMouseMove={() => active !== i && setActive(i)}
                />
              </g>
            );
          })}
          <XLabels labels={data.map((d) => d.label)} x={cx} y={height - 8} band={band} />
        </svg>
      )}
      {width === 0 && <div style={{ height }} />}
      <ChartTooltip tip={tip} width={width} />
    </div>
  );
}
