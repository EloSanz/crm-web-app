'use client';

import React from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Mueve un id una posición arriba (-1) o abajo (+1) y devuelve el orden nuevo completo. */
export function moved(ids: string[], id: string, delta: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Botones subir/bajar para ordenar una fila. */
export function MoveButtons({
  name,
  first,
  last,
  disabled,
  onMove,
}: {
  name: string;
  first: boolean;
  last: boolean;
  disabled?: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="fantasma" size="icono-sm" aria-label={`Subir ${name}`} title="Subir" disabled={disabled || first} onClick={() => onMove(-1)}>
        <ArrowUp className="w-4 h-4" />
      </Button>
      <Button variant="fantasma" size="icono-sm" aria-label={`Bajar ${name}`} title="Bajar" disabled={disabled || last} onClick={() => onMove(1)}>
        <ArrowDown className="w-4 h-4" />
      </Button>
    </div>
  );
}

/** Contenedor de lista con filas separadas, como el resto de las tablas en móvil. */
export function ConfigRows({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ol aria-label={label} className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
      {children}
    </ol>
  );
}

export function ConfigRow({ inactive, children }: { inactive?: boolean; children: React.ReactNode }) {
  return <li className={clsx('flex flex-wrap items-center gap-3 px-4 py-3', inactive && 'bg-chapa-2')}>{children}</li>;
}

export function Position({ n }: { n: number }) {
  return <span className="cifra w-6 shrink-0 text-center text-sm font-semibold text-tiza">{n}</span>;
}
