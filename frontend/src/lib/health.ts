import type { Opportunity } from '@/types/crm';

export type Health = 'healthy' | 'warning' | 'stale';

export const HEALTH_META: Record<Health, { label: string; long: string; range: string }> = {
  healthy: { label: 'Al día', long: 'Seguimiento al día', range: '≤ 7 días' },
  warning: { label: 'En riesgo', long: 'Se está enfriando', range: '8 a 14 días' },
  stale: { label: 'Estancado', long: 'Sin seguimiento', range: 'más de 14 días' },
};

export function healthOf(opp: Pick<Opportunity, 'health_status' | 'days_since_last_activity'>): Health {
  if (opp.health_status) return opp.health_status;
  const days = opp.days_since_last_activity;
  if (days === null || days === undefined) return 'stale';
  if (days <= 7) return 'healthy';
  if (days <= 14) return 'warning';
  return 'stale';
}

/**
 * La urgencia se lee por peso: cuanto más frío el presupuesto, más gruesa la cifra de días.
 * Devuelve un peso variable de Archivo (400 → 900).
 */
export function urgencyWeight(days: number | null | undefined): number {
  if (days === null || days === undefined) return 900;
  const clamped = Math.max(0, Math.min(days, 21));
  return Math.round(400 + (clamped / 21) * 500);
}

export function isOpen(opp: Pick<Opportunity, 'status'>): boolean {
  return opp.status === 'abierta';
}

export const HEALTH_TONE: Record<Health, 'verde' | 'ambar' | 'rojo'> = {
  healthy: 'verde',
  warning: 'ambar',
  stale: 'rojo',
};
