import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Marca Corralap: una C levantada con cinco ladrillos en traba, sobre una placa amarillo vial.
 * Formas macizas, sin líneas finas ni degradés: se lee igual en un camión, un casco o un favicon.
 * La geometría vive acá y la usan el favicon, los íconos de la PWA y el manual de marca.
 */
export const BRAND = {
  amarillo: '#FFC20E',
  pavonado: '#16212B',
  negro: '#111111',
  blanco: '#FFFFFF',
} as const;

// Grilla de 64: placa completa, ladrillos entre 10 y 54 (el margen de 10 es el área de protección mínima).
const LO = 10;
const HI = 54;
const GAP = 3;
const H = (HI - LO - 2 * GAP) / 3;
const Y = [LO, LO + H + GAP, LO + 2 * (H + GAP)];
const R = 1.5;
// La curva exterior ocupa toda la hilada y el alma tiene el mismo grueso que las hiladas: trazo parejo, se lee C y no E.
const CURVE = H;

function brick(x: number, y: number, w: number, h: number, tl = R, tr = R, br = R, bl = R) {
  return (
    `M${x + tl},${y}H${x + w - tr}A${tr},${tr} 0 0 1 ${x + w},${y + tr}V${y + h - br}` +
    `A${br},${br} 0 0 1 ${x + w - br},${y + h}H${x + bl}A${bl},${bl} 0 0 1 ${x},${y + h - bl}` +
    `V${y + tl}A${tl},${tl} 0 0 1 ${x + tl},${y}Z`
  );
}

/** Hilada de arriba (largo + corto), alma de la C, hilada de abajo (juntas corridas respecto de la de arriba). */
export const MARK_PATH = [
  brick(LO, Y[0], 38 - LO, H, CURVE, R, R, 0),
  brick(38 + GAP, Y[0], HI - 38 - GAP, H),
  brick(LO, Y[1], H, H),
  brick(LO, Y[2], 30 - LO, H, 0, R, R, CURVE),
  brick(30 + GAP, Y[2], HI - 30 - GAP, H),
].join('');

export const PLATE_RADIUS = 12;

/** Placa con los ladrillos calados: la versión monocroma para sellos, facturas, bordados y grabados. */
const PLATE_PATH = `M${PLATE_RADIUS},0H${64 - PLATE_RADIUS}A${PLATE_RADIUS},${PLATE_RADIUS} 0 0 1 64,${PLATE_RADIUS}V${64 - PLATE_RADIUS}A${PLATE_RADIUS},${PLATE_RADIUS} 0 0 1 ${64 - PLATE_RADIUS},64H${PLATE_RADIUS}A${PLATE_RADIUS},${PLATE_RADIUS} 0 0 1 0,${64 - PLATE_RADIUS}V${PLATE_RADIUS}A${PLATE_RADIUS},${PLATE_RADIUS} 0 0 1 ${PLATE_RADIUS},0Z`;

export type MarkTone = 'color' | 'negro' | 'blanco';

interface MarkProps {
  className?: string;
  tone?: MarkTone;
  title?: string;
}

export function LogoMark({ className, tone = 'color', title }: MarkProps) {
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const };
  return (
    <svg viewBox="0 0 64 64" className={className} {...a11y}>
      {tone === 'color' ? (
        <>
          <rect width="64" height="64" rx={PLATE_RADIUS} fill={BRAND.amarillo} />
          <path d={MARK_PATH} fill={BRAND.pavonado} />
        </>
      ) : (
        <path d={PLATE_PATH + MARK_PATH} fillRule="evenodd" fill={tone === 'negro' ? BRAND.negro : BRAND.blanco} />
      )}
    </svg>
  );
}

/** Sobre qué fondo va: "oscuro" y "claro" son a color; "negro" y "blanco", los monocromos. */
export type LogoTone = 'oscuro' | 'claro' | 'negro' | 'blanco';

interface LogoProps {
  className?: string;
  tone?: LogoTone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Horizontal para cabeceras y barras; vertical para piezas cuadradas y la pantalla de ingreso. */
  layout?: 'horizontal' | 'vertical';
}

const MARK_SIZE = { sm: 'w-8 h-8', md: 'w-9 h-9', lg: 'w-12 h-12', xl: 'w-20 h-20' };
const WORD_SIZE = { sm: 'text-[17px]', md: 'text-[19px]', lg: 'text-[26px]', xl: 'text-[38px]' };
const WORD_INK: Record<LogoTone, string> = { oscuro: 'text-white', claro: 'text-pavonado', negro: 'text-[#111111]', blanco: 'text-white' };

export function Logo({ className, tone = 'oscuro', size = 'md', layout = 'horizontal' }: LogoProps) {
  const markTone: MarkTone = tone === 'negro' || tone === 'blanco' ? tone : 'color';
  return (
    <span className={twMerge(clsx('inline-flex items-center', layout === 'vertical' ? 'flex-col gap-[0.55em]' : 'gap-[0.5em]', WORD_SIZE[size]), className)}>
      <LogoMark className={clsx(MARK_SIZE[size], 'shrink-0')} tone={markTone} />
      <span className={clsx(WORD_INK[tone], 'font-extrabold uppercase leading-none tracking-[0.09em] [margin-right:-0.09em]')}>Corralap</span>
    </span>
  );
}
