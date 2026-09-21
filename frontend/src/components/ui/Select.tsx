'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Check, ChevronDown, Search } from 'lucide-react';
import { popoverStyle, usePopover } from './usePopover';

export interface SelectOption {
  value: string;
  label: string;
  /** Texto secundario debajo de la opción (CUIT, precio, dirección…). */
  hint?: string;
  group?: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Muestra buscador arriba de la lista. Por defecto, cuando hay más de 7 opciones. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'sm';
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Desplegable propio: lista con búsqueda, grupos, teclado completo y panel que nunca se corta. */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Elegí una opción',
  searchable,
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  id,
  invalid,
  disabled,
  className,
  size = 'md',
  ...aria
}: SelectProps) {
  const listId = useId();
  const { triggerRef, panelRef, open, setOpen, close, pos } = usePopover<HTMLButtonElement>({ minWidth: 260, maxHeight: 360 });
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const withSearch = searchable ?? options.length > 7;

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return q ? options.filter((o) => norm(`${o.label} ${o.hint ?? ''} ${o.group ?? ''}`).includes(q)) : options;
  }, [options, query]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(idx);
    setOpen(true);
    requestAnimationFrame(() => {
      if (withSearch) searchRef.current?.focus();
      else listRef.current?.focus();
      listRef.current?.querySelector<HTMLElement>(`[data-index="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  };

  const choose = (opt: SelectOption) => {
    onChange(opt.value);
    close();
  };

  const move = (delta: number) => {
    if (filtered.length === 0) return;
    const next = (active + delta + filtered.length) % filtered.length;
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={aria['aria-label']}
        aria-describedby={aria['aria-describedby']}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openList();
          }
        }}
        className={clsx(
          'group relative flex w-full min-w-0 items-center gap-2 rounded-[10px] border bg-chapa text-left transition-[border-color,box-shadow] duration-150 cursor-pointer',
          'hover:border-tiza focus-visible:outline-none focus-visible:border-tinta focus-visible:shadow-[0_0_0_3px_rgb(22_33_43/0.14)]',
          'disabled:cursor-not-allowed disabled:bg-chapa-2 disabled:text-tiza',
          size === 'md' ? 'h-11 pl-3.5 pr-10 text-[15px]' : 'h-9 pl-3 pr-9 text-sm',
          open ? 'border-tinta shadow-[0_0_0_3px_rgb(22_33_43/0.14)]' : invalid ? 'border-rojo' : 'border-linea-fuerte',
          className
        )}
      >
        {selected?.icon}
        <span className={clsx('min-w-0 flex-1 truncate', selected ? 'text-tinta font-medium' : 'text-[#7d8a92]')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={clsx(
            'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tiza transition-transform duration-150',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={popoverStyle(pos)}
            className="z-[80] flex flex-col overflow-hidden rounded-xl border border-linea bg-chapa shadow-alzada animate-desplegar"
            onKeyDown={onKeyDown}
          >
            {withSearch && (
              <div className="relative border-b border-linea p-2">
                <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-tiza" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                  className="h-10 w-full rounded-lg bg-chapa-2 pl-9 pr-3 text-[15px] outline-none placeholder:text-[#7d8a92] focus:bg-chapa focus:shadow-[inset_0_0_0_1.5px_var(--color-tinta)]"
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-activedescendant={!withSearch && filtered[active] ? `${listId}-${active}` : undefined}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 outline-none"
            >
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-[15px] text-tiza">{emptyText}</li>}
              {filtered.map((opt, i) => {
                const header = opt.group && (i === 0 || filtered[i - 1].group !== opt.group) ? opt.group : null;
                const isSel = opt.value === value;
                return (
                  <React.Fragment key={opt.value}>
                    {header && (
                      <li role="presentation" className="rotulo px-2.5 pt-3 pb-1.5 text-tiza first:pt-1.5">
                        {header}
                      </li>
                    )}
                    <li
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={isSel}
                      data-index={i}
                      onPointerMove={() => active !== i && setActive(i)}
                      onClick={() => choose(opt)}
                      className={clsx(
                        'flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-[15px]',
                        i === active ? 'bg-chapa-2' : '',
                        isSel ? 'font-semibold text-tinta' : 'text-tinta'
                      )}
                    >
                      {opt.icon && <span className="mt-0.5 shrink-0">{opt.icon}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug break-words">{opt.label}</span>
                        {opt.hint && <span className="block text-[13px] font-normal text-tiza leading-snug break-words">{opt.hint}</span>}
                      </span>
                      <Check className={clsx('mt-0.5 w-4 h-4 shrink-0 text-pavonado', isSel ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
