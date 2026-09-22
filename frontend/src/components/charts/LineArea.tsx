'use client';

import React from 'react';
import { CHART } from './palette';
import { ChartTooltip, type TooltipState } from './Tooltip';
import { axisWidth, useActiveIndex, XLabels, YGrid } from './axes';
import { useChartWidth } from './hooks';
import { niceTicks } from './format';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

interface LineAreaProps {
  series: LineSeries[];
  /** Etiquetas del eje X (una por punto). */
  labels: string[];
  /** Títulos largos del tooltip (por defecto, las etiquetas). */
  titles?: string[];
  format: (n: number) => string;
  axisFormat?: (n: number) => string;
  label: string;
  height?: number;
  /** Tope fijo del eje (p. ej. 1 para porcentajes). */
  yMax?: number;
  /** Relleno suave bajo la línea (sólo con una serie). */
  area?: boolean;
}

/** Línea (2px) con relleno opcional y mira vertical que salta al punto más cercano. */
export function LineArea({ series, labels, titles, format, axisFormat = format, label, height = 220, yMax, area = true }: LineAreaProps) {
  const [ref, width] = useChartWidth();
  const count = labels.length;
  const { active, setActive, focusProps } = useActiveIndex(count);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const ticks = niceTicks(yMax ?? Math.max(0, ...all));
  const top = yMax ?? (ticks[ticks.length - 1] || 1);
  const shownTicks = yMax ? ticks.filter((t) => t <= yMax + 1e-9) : ticks;

  const padL = axisWidth(shownTicks.map(axisFormat));
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const x = (i: number) => (count <= 1 ? padL + plotW / 2 : padL + (i / (count - 1)) * plotW);
  const y = (v: number) => padT + plotH - (Math.min(v, top) / top) * plotH;
  const band = count > 1 ? plotW / (count - 1) : plotW;

  const pathOf = (values: (number | null)[]) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const single = series.length === 1 ? series[0] : null;
  // Relleno por tramo continuo: donde falta el dato no se inventa superficie.
  const areaPath = (() => {
    if (!single || !area) return '';
    const runs: [number, number][][] = [[]];
    single.values.forEach((v, i) => {
      if (v === null) runs.push([]);
      else runs[runs.length - 1].push([x(i), y(v)]);
    });
    return runs
      .filter((run) => run.length > 1)
      .map((run) => `M${run[0][0]},${y(0)}${run.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join('')}L${run[run.length - 1][0]},${y(0)}Z`)
      .join('');
  })();

  const lastIndex = single ? single.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop() ?? -1 : -1;

  const tip: TooltipState | null =
    active !== null
      ? {
          title: titles?.[active] ?? labels[active],
          rows: series.map((s) => ({ label: s.label, value: s.values[active] === null ? '—' : format(s.values[active] as number), color: s.color })),
          x: x(active),
          y: Math.min(...series.map((s) => (s.values[active] === null ? y(0) : y(s.values[active] as number)))),
        }
      : null;

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left - band / 2;
    const index = count <= 1 ? 0 : Math.round((px / Math.max(1, box.width - band)) * (count - 1));
    const clamped = Math.max(0, Math.min(count - 1, index));
    if (clamped !== active) setActive(clamped);
  };

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible rounded-lg" {...focusProps}>
          <YGrid ticks={shownTicks} y={y} left={padL} right={width - 4} format={axisFormat} />
          {areaPath && <path d={areaPath} fill={single!.color} opacity={0.1} className="graf-fundido" />}
          {series.map((s) => (
            <path
              key={s.key}
              d={pathOf(s.values)}
              pathLength={1}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="graf-linea"
            />
          ))}
          {single && lastIndex >= 0 && (
            <g className="graf-fundido" style={{ animationDelay: '500ms' }}>
              <circle cx={x(lastIndex)} cy={y(single.values[lastIndex] as number)} r={4} fill={single.color} stroke={CHART.surface} strokeWidth={2} />
              {active === null && (
                <text x={x(lastIndex)} y={y(single.values[lastIndex] as number) - 10} textAnchor="end" fontSize={12} fontWeight={700} fill={CHART.ink} className="cifra">
                  {axisFormat(single.values[lastIndex] as number)}
                </text>
              )}
            </g>
          )}
          {active !== null && (
            <g aria-hidden>
              <line x1={x(active)} x2={x(active)} y1={padT} y2={padT + plotH} stroke={CHART.axis} strokeWidth={1} />
              {series.map((s) =>
                s.values[active] === null ? null : (
                  <circle key={s.key} cx={x(active)} cy={y(s.values[active] as number)} r={4.5} fill={s.color} stroke={CHART.surface} strokeWidth={2} />
                )
              )}
            </g>
          )}
          <XLabels labels={labels} x={x} y={height - 8} band={band} />
          <rect
            x={padL - band / 2}
            y={padT}
            width={plotW + band}
            height={plotH}
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}
      {width === 0 && <div style={{ height }} />}
      <ChartTooltip tip={tip} width={width} />
    </div>
  );
}
