import React from 'react';
import { BRAND, MARK_PATH } from './Logo';

/** Gráfica de marca: la C de ladrillos en grande, sin placa, en amarillo vial. Para fondos pavonados. */
export function BrandArt({ className }: { className?: string }) {
  return (
    <svg viewBox="10 10 44 44" className={className} aria-hidden>
      <path d={MARK_PATH} fill={BRAND.amarillo} />
    </svg>
  );
}
