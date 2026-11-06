'use client';

import React from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Registros por vista en todos los listados del CRM. */
export const PAGE_SIZE = 10;

type PageItem = number | 'gap-izq' | 'gap-der';

/**
 * Páginas a mostrar (base 0): siempre la primera y la última, la actual con `siblings` vecinas a
 * cada lado y elipsis en los huecos. Si un hueco taparía una sola página, se muestra esa página.
 */
export function pageItems(page: number, pageCount: number, siblings: number): PageItem[] {
  const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
  const slots = siblings * 2 + 5; // primera, última, actual y dos elipsis
  if (pageCount <= slots) return range(0, pageCount);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount - 2);
  const leftGap = left > 2;
  const rightGap = right < pageCount - 3;
  if (!leftGap) return [...range(0, slots - 2), 'gap-der', pageCount - 1];
  if (!rightGap) return [0, 'gap-izq', ...range(pageCount - (slots - 2), pageCount)];
  return [0, 'gap-izq', ...range(left, right + 1), 'gap-der', pageCount - 1];
}

interface PaginationProps {
  /** Página actual en base 0 (la misma convención que `pageIndex` de TanStack Table). */
  page: number;
  pageCount: number;
  /** Cantidad total de registros (ya filtrados). */
  total: number;
  pageSize: number;
  /** Recibe la página nueva en base 0. */
  onChange: (page: number) => void;
  /** Bloque que se trae a la vista al cambiar de página si quedó arriba de la pantalla. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

const control =
  'h-10 min-w-10 inline-flex items-center justify-center rounded-[10px] px-2 text-sm font-semibold transition-colors cursor-pointer ' +
  'disabled:opacity-35 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pavonado';

/**
 * Paginador del sistema de diseño: "Mostrando 11–20 de 57", anterior/siguiente, páginas numeradas
 * con elipsis y "Página X de N". No se muestra si todo entra en una página.
 * En celular muestra menos números (sólo la página actual entre la primera y la última).
 */
export function Pagination({ page, pageCount, total, pageSize, onChange, anchorRef, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const from = current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);

  const go = (next: number) => {
    if (next < 0 || next >= pageCount || next === current) return;
    onChange(next);
    const el = anchorRef?.current;
    if (el && el.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  const numbers = (siblings: number, visibility: string) => (
    <ul className={clsx('items-center gap-1', visibility)}>
      {pageItems(current, pageCount, siblings).map((item) =>
        typeof item === 'number' ? (
          <li key={item}>
            <button
              type="button"
              onClick={() => go(item)}
              aria-label={`Página ${item + 1}`}
              aria-current={item === current ? 'page' : undefined}
              className={clsx(control, 'cifra', item === current ? 'bg-pavonado text-white' : 'text-tinta hover:bg-chapa-2')}
            >
              {item + 1}
            </button>
          </li>
        ) : (
          <li key={item} aria-hidden className="w-5 text-center text-sm text-tiza select-none">
            …
          </li>
        )
      )}
    </ul>
  );

  return (
    <nav aria-label="Paginación" className={clsx('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}>
      <p className="cifra order-1 text-sm text-tiza" aria-live="polite">
        Mostrando <span className="font-semibold text-tinta">{from}–{to}</span> de <span className="font-semibold text-tinta">{total}</span>
      </p>
      <p className="cifra order-2 text-sm font-semibold sm:order-3">
        Página {current + 1} de {pageCount}
      </p>
      <div className="order-3 flex w-full items-center justify-center gap-1 sm:order-2 sm:w-auto">
        <button type="button" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Página anterior" className={clsx(control, 'text-tinta hover:bg-chapa-2 disabled:hover:bg-transparent')}>
          <ChevronLeft className="w-4.5 h-4.5" aria-hidden />
        </button>
        {numbers(0, 'flex sm:hidden')}
        {numbers(1, 'hidden sm:flex')}
        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={current === pageCount - 1}
          aria-label="Página siguiente"
          className={clsx(control, 'text-tinta hover:bg-chapa-2 disabled:hover:bg-transparent')}
        >
          <ChevronRight className="w-4.5 h-4.5" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
