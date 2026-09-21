import React from 'react';
import clsx from 'clsx';
import type { Health } from '@/lib/health';
import { HEALTH_META, HEALTH_TONE } from '@/lib/health';
import { Chip } from '@/components/ui/Chip';
import { formatDaysAgo } from '@/lib/format';

export const PUNTA_COLORS: Record<Health, { base: string; core: string }> = {
  healthy: { base: '#1b8049', core: '#3dbe74' },
  warning: { base: '#e8830c', core: '#f7b25e' },
  stale: { base: '#cf3a2c', core: '#f07a6d' },
};

interface PuntaProps {
  health?: Health;
  status?: 'abierta' | 'ganada' | 'perdida';
  size?: number;
  className?: string;
  label?: string;
}

/** La punta de una barra de hierro, pintada según el seguimiento del presupuesto. */
export function Punta({ health = 'healthy', status = 'abierta', size = 16, className, label }: PuntaProps) {
  const aria = label ?? (status === 'ganada' ? 'Venta concretada' : status === 'perdida' ? 'Perdido' : HEALTH_META[health].label);
  const common = { width: size, height: size, viewBox: '0 0 20 20', role: 'img' as const, 'aria-label': aria, className: clsx('shrink-0', className) };

  if (status === 'ganada') {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="10" fill="#16212b" />
        <path d="M6 10.4l2.6 2.6L14 7.6" fill="none" stroke="#3dbe74" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'perdida') {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="10" fill="#dce1df" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="#5a666f" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  const c = PUNTA_COLORS[health];
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="10" fill={c.base} />
      <circle cx="10" cy="10" r="3.8" fill={c.core} />
    </svg>
  );
}

/** Pastilla de salud: "Al día · hace 3 días". */
export function HealthChip({ health, days, compact = false }: { health: Health; days?: number | null; compact?: boolean }) {
  return (
    <Chip tone={HEALTH_TONE[health]}>
      {compact ? formatDaysAgo(days) : `${HEALTH_META[health].label} · ${formatDaysAgo(days)}`}
    </Chip>
  );
}
