import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Tone } from '@/lib/catalogs';

const tones: Record<Tone, string> = {
  verde: 'bg-verde-velo text-verde-tinta',
  ambar: 'bg-ambar-velo text-ambar-tinta',
  rojo: 'bg-rojo-velo text-rojo-tinta',
  neutro: 'bg-chapa-2 text-tiza',
  tinta: 'bg-[#e3e8ed] text-tinta',
  fuerte: 'bg-pavonado text-white',
  pausa: 'bg-chapa-2 text-tinta',
};

const dots: Record<Tone, string> = {
  verde: 'bg-verde',
  ambar: 'bg-ambar',
  rojo: 'bg-rojo',
  neutro: 'bg-linea-fuerte',
  tinta: 'bg-pavonado',
  fuerte: 'bg-white',
  pausa: 'bg-transparent ring-[1.5px] ring-tiza',
};

interface ChipProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

/** Pastilla de estado: fondo velado, punto de color y texto de 13px. */
export function Chip({ tone = 'neutro', children, className, dot = true }: ChipProps) {
  return (
    <span className={twMerge(clsx('inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap', tones[tone], className))}>
      {dot && <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dots[tone])} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}
