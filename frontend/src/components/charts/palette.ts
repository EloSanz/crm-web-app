import { PUNTA_COLORS } from '@/components/punta/Punta';
import type { ChannelGroup, ContactType, HealthKey } from '@/types/metrics';

/**
 * Colores de los gráficos de Corralap. Cada color hace un solo trabajo:
 * - Magnitud (una serie): pavonado. Es la tinta de la marca, no un estado.
 * - Identidad (varias series): SERIES, en orden fijo y nunca ciclado. Validado con
 *   dataviz/validate_palette.js sobre chapa (#FFFFFF): ΔE CVD adyacente 14,9, ΔE normal 24,7, todas
 *   ≥ 3:1. Igual todo gráfico lleva leyenda y "Ver tabla".
 * - Salud (al día / en riesgo / estancado) y resultado (vendido / perdido): el semáforo, sólo cuando
 *   el dato ES salud o resultado, siempre con etiqueta.
 * - Magnitud en grilla (mapa de calor): rampa secuencial de un solo tono pavonado, claro → oscuro.
 * El amarillo nunca aparece: es marca, acción principal y ubicación.
 */
export const CHART = {
  magnitude: '#2c3f51',
  magnitudeHover: '#16212b',
  soft: '#96aabe',
  ink: '#16212b',
  inkSoft: '#5a666f',
  grid: '#dce1df',
  axis: '#bfc7c4',
  muted: '#8b979f',
  track: '#f4f6f5',
  surface: '#ffffff',
  /** Trama para un tramo que tiene que distinguirse de otro gris sin sumar un color (ej. «volvió atrás»). */
  hatch: 'repeating-linear-gradient(135deg, #5a666f 0 2px, #dce1df 2px 6px)',
  won: PUNTA_COLORS.healthy.base,
  lost: PUNTA_COLORS.stale.base,
} as const;

/** Paleta categórica en orden fijo: acero, vino, agua, violeta, rosa (validada: todo pasa, contraste ≥ 3:1). */
export const SERIES = ['#3d78b2', '#901a57', '#1d97a3', '#5c389f', '#d0639f'] as const;

/** Rampa secuencial pavonada (paso 0 = casi nada, paso 6 = pavonado). */
export const SEQUENTIAL = ['#e3ebf3', '#bbcdde', '#96aabe', '#72899f', '#506981', '#2f4a64', '#16212b'] as const;

export const HEALTH_COLOR: Record<HealthKey, string> = {
  healthy: PUNTA_COLORS.healthy.base,
  warning: PUNTA_COLORS.warning.base,
  stale: PUNTA_COLORS.stale.base,
};

export const HEALTH_ORDER: HealthKey[] = ['healthy', 'warning', 'stale'];

/** Canales de contacto agrupados, con su color de serie. */
export const CHANNELS: { key: ChannelGroup; label: string; color: string }[] = [
  { key: 'llamada', label: 'Llamada', color: SERIES[0] },
  { key: 'whatsapp', label: 'WhatsApp', color: SERIES[1] },
  { key: 'email', label: 'Correo', color: SERIES[2] },
  { key: 'presencial', label: 'En persona', color: SERIES[3] },
  { key: 'presupuesto', label: 'Envío de presupuesto', color: SERIES[4] },
];

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Correo',
  visita_obra: 'Visita a la obra',
  mostrador: 'En el local',
  reunion: 'Reunión',
  presupuesto: 'Envío de presupuesto',
};

/** Paso de la rampa para un valor entre 0 y 1 (los valores > 0 arrancan en el paso 1). */
export function sequentialColor(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return SEQUENTIAL[1];
  const index = 1 + Math.min(SEQUENTIAL.length - 2, Math.floor(t * (SEQUENTIAL.length - 1)));
  return SEQUENTIAL[index];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto blanco o tinta sobre un relleno, el que tenga más contraste. */
export function inkOn(fill: string): string {
  const l = luminance(fill);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(CHART.ink) + 0.05);
  return onWhite >= onInk ? '#ffffff' : CHART.ink;
}
