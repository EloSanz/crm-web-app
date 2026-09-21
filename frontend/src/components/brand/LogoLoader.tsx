import React from 'react';
import clsx from 'clsx';
import { BRAND, MARK_BRICKS, PLATE_RADIUS } from './Logo';

interface LogoLoaderProps {
  className?: string;
  /** Texto para lectores de pantalla y, si `showLabel`, también visible. */
  label?: string;
  showLabel?: boolean;
}

/**
 * Indicador de carga con la marca: la placa amarilla y los cinco ladrillos de la C que se van
 * rellenando de a uno, en bucle. Con "reducir movimiento" quedan todos llenos y quietos.
 */
export function LogoLoader({ className, label = 'Cargando…', showLabel = false }: LogoLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <svg viewBox="0 0 64 64" className={clsx('h-16 w-16 drop-shadow-sm', className)} aria-hidden>
        <rect width="64" height="64" rx={PLATE_RADIUS} fill={BRAND.amarillo} />
        {MARK_BRICKS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={BRAND.pavonado}
            className="animate-ladrillo motion-reduce:animate-none"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </svg>
      {showLabel ? <p className="text-[15px] font-semibold text-tiza">{label}</p> : <span className="sr-only">{label}</span>}
    </div>
  );
}
