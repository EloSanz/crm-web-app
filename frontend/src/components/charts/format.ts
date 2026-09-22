import { formatARSCompact } from '@/lib/format';

const one = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export const fmtInt = (n: number) => int.format(n);
export const fmtOne = (n: number) => one.format(n);
export const fmtMoney = (n: number) => formatARSCompact(n);

/** 0,42 → "42%". */
export const fmtPct = (ratio: number) => `${int.format(ratio * 100)}%`;

/** Días con un decimal: "4,5 días", "1 día", "menos de 1 día". */
export function fmtDays(days: number): string {
  if (days < 1) return days <= 0 ? '0 días' : 'menos de 1 día';
  const value = one.format(days);
  return value === '1' ? '1 día' : `${value} días`;
}

/** Versión corta para ejes y celdas: "4,5 d". */
export const fmtDaysShort = (days: number) => `${one.format(days)} d`;

/** Horas si es en el día, días si pasa de 24 h. */
export function fmtHours(hours: number): string {
  if (hours < 1) return 'menos de 1 h';
  if (hours < 24) return `${int.format(hours)} h`;
  return fmtDays(hours / 24);
}

/** Ticks redondos para un eje que arranca en 0: pasos de 1, 2, 2,5 o 5 × 10ⁿ (sin 2,5 ni fracciones si son cantidades). */
export function niceTicks(max: number, count = 4, integer = false): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const factors = integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const found = factors.map((m) => m * power).find((s) => s >= raw) ?? raw;
  const step = integer ? Math.max(1, Math.round(found)) : found;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001 || ticks.length < 2; v += step) ticks.push(Number(v.toFixed(10)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

const shortMonth = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' }).replace('.', '');

/** Etiqueta de eje para el inicio de una semana o un mes ("22 jun", "sept", "ene 26"). */
export function bucketLabel(start: string, granularity: 'week' | 'month', index: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  if (granularity === 'week') return `${d.getUTCDate()} ${shortMonth(d)}`;
  const withYear = index === 0 || d.getUTCMonth() === 0;
  return withYear ? `${shortMonth(d)} ${String(d.getUTCFullYear()).slice(2)}` : shortMonth(d);
}

/** Título largo para tooltip y tabla ("Semana del 22 de junio", "Junio de 2026"). */
export function bucketTitle(start: string, granularity: 'week' | 'month'): string {
  const d = new Date(`${start}T00:00:00Z`);
  if (granularity === 'week') {
    return `Semana del ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
  }
  const text = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return text.charAt(0).toLocaleUpperCase('es-AR') + text.slice(1);
}

/** "Presupuesto en Preparación" → "Preparación"; nombre corto de etapa para ejes y columnas. */
export function stageShort(name: string): string {
  const n = name.toLocaleLowerCase('es-AR');
  if (n.includes('consulta')) return 'Consulta';
  if (n.includes('prepar')) return 'Preparación';
  if (n.includes('enviado')) return 'Enviado';
  if (n.includes('negoci')) return 'Negociación';
  const text = name.replace(/^presupuesto\s+/i, '');
  return text.charAt(0).toLocaleUpperCase('es-AR') + text.slice(1).toLocaleLowerCase('es-AR');
}

/** Retraso escalonado de entrada: 40 ms por marca, con techo para no pasar de ~700 ms en total. */
export const stagger = (index: number, step = 40, cap = 220) => `${Math.min(index * step, cap)}ms`;
