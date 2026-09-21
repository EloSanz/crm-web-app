'use client';

import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { popoverStyle, usePopover } from './usePopover';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const monthFmt = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat('es-AR', { month: 'short' });
/** "21 sept 2026": corto para que entre en campos angostos. */
const shortDate = (d: Date) => `${d.getDate()} ${monthShortFmt.format(d).replace('.', '')} ${d.getFullYear()}`;
const dayLabelFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function buildMonth(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  clearable?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
}

/** Selector de fecha propio: calendario en castellano, semana que arranca el lunes y teclado completo. */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'Elegí una fecha',
  min,
  max,
  clearable = true,
  invalid,
  ...aria
}: DatePickerProps) {
  const { triggerRef, panelRef, open, setOpen, close, pos } = usePopover<HTMLButtonElement>({ minWidth: 312, maxHeight: 420 });
  const selected = fromISODate(value);
  const minD = fromISODate(min);
  const maxD = fromISODate(max);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? new Date());
  const gridRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => buildMonth(view), [view]);

  const disabledDay = (d: Date) => (minD && d < minD) || (maxD && d > maxD) || false;

  const focusCell = (d: Date) => {
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-day="${toISODate(d)}"]`)?.focus());
  };

  const openCal = () => {
    const base = selected ?? new Date();
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    setFocusDay(base);
    setOpen(true);
    focusCell(base);
  };

  const pick = (d: Date) => {
    if (disabledDay(d)) return;
    onChange(toISODate(d));
    close();
  };

  const shift = (days: number, months = 0) => {
    const d = new Date(focusDay);
    if (months) d.setMonth(d.getMonth() + months);
    d.setDate(d.getDate() + days);
    setFocusDay(d);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
      setView(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    focusCell(d);
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowRight: () => shift(1),
      ArrowLeft: () => shift(-1),
      ArrowDown: () => shift(7),
      ArrowUp: () => shift(-7),
      PageDown: () => shift(0, 1),
      PageUp: () => shift(0, -1),
      Enter: () => pick(focusDay),
      ' ': () => pick(focusDay),
      Escape: () => close(),
    };
    if (map[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      map[e.key]();
    }
  };

  const monthLabel = monthFmt.format(view);

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={aria['aria-describedby']}
          onClick={() => (open ? close() : openCal())}
          className={clsx(
            'flex h-11 w-full min-w-0 items-center gap-2.5 rounded-[10px] border bg-chapa pl-3.5 pr-10 text-left text-[15px] transition-[border-color,box-shadow] cursor-pointer',
            'hover:border-tiza focus-visible:outline-none focus-visible:border-tinta focus-visible:shadow-[0_0_0_3px_rgb(22_33_43/0.14)]',
            open ? 'border-tinta shadow-[0_0_0_3px_rgb(22_33_43/0.14)]' : invalid ? 'border-rojo' : 'border-linea-fuerte'
          )}
        >
          <CalendarDays className="w-4.5 h-4.5 shrink-0 text-tiza" aria-hidden />
          <span className={clsx('min-w-0 flex-1 truncate', selected ? 'font-medium text-tinta' : 'text-[#7d8a92]')}>
            {selected ? shortDate(selected) : placeholder}
          </span>
        </button>
        {clearable && selected && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-tiza hover:text-tinta hover:bg-chapa-2 cursor-pointer"
            aria-label="Borrar fecha"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Elegir fecha"
            style={popoverStyle(pos)}
            className="z-[80] w-[312px] overflow-auto rounded-xl border border-linea bg-chapa p-3 shadow-alzada animate-desplegar"
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <button
                type="button"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-tinta hover:bg-chapa-2 cursor-pointer"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <p className="text-[15px] font-bold first-letter:uppercase" aria-live="polite">
                {monthLabel}
              </p>
              <button
                type="button"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-tinta hover:bg-chapa-2 cursor-pointer"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 pb-1" aria-hidden>
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="h-8 inline-flex items-center justify-center text-[13px] font-bold text-tiza">
                  {w}
                </span>
              ))}
            </div>
            <div ref={gridRef} role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKey}>
              {days.map((d) => {
                const outside = d.getMonth() !== view.getMonth();
                const isSel = sameDay(d, selected);
                const isToday = sameDay(d, today);
                const off = disabledDay(d);
                const isFocus = sameDay(d, focusDay);
                return (
                  <button
                    key={toISODate(d)}
                    type="button"
                    role="gridcell"
                    data-day={toISODate(d)}
                    tabIndex={isFocus ? 0 : -1}
                    disabled={off}
                    aria-selected={isSel}
                    aria-label={dayLabelFmt.format(d)}
                    onClick={() => pick(d)}
                    className={clsx(
                      'cifra relative h-10 rounded-lg text-[15px] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30',
                      isSel ? 'bg-pavonado text-white' : outside ? 'text-tiza/60 hover:bg-chapa-2' : 'text-tinta hover:bg-chapa-2',
                      isToday && !isSel && 'font-bold shadow-[inset_0_0_0_1.5px_var(--color-pavonado)]'
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-linea pt-2">
              <button
                type="button"
                onClick={() => pick(new Date())}
                disabled={disabledDay(today)}
                className="h-9 px-3 rounded-lg text-sm font-semibold text-tinta hover:bg-chapa-2 cursor-pointer disabled:opacity-40"
              >
                Hoy
              </button>
              {clearable && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    close();
                  }}
                  className="h-9 px-3 rounded-lg text-sm font-semibold text-tiza hover:bg-chapa-2 hover:text-tinta cursor-pointer"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
