'use client';

import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { MoreHorizontal } from 'lucide-react';
import { popoverStyle, usePopover } from './usePopover';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  tone?: 'normal' | 'peligro';
}

/** Menú de acciones "⋯": junta las acciones secundarias para que las filas respiren. */
export function Menu({ items, label, className }: { items: MenuItem[]; label: string; className?: string }) {
  const menuId = useId();
  const { triggerRef, panelRef, open, setOpen, close, pos } = usePopover<HTMLButtonElement>({ minWidth: 200, maxHeight: 320, align: 'end' });
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const focusItem = (i: number) => itemsRef.current[(i + items.length) % items.length]?.focus();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else {
            setOpen(true);
            requestAnimationFrame(() => focusItem(0));
          }
        }}
        className={clsx(
          'relative z-[1] h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-[10px] text-tiza hover:text-tinta hover:bg-chapa-2 cursor-pointer',
          open && 'bg-chapa-2 text-tinta',
          className
        )}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={label}
            style={popoverStyle(pos)}
            onKeyDown={(e) => {
              const idx = itemsRef.current.findIndex((el) => el === document.activeElement);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusItem(idx + 1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusItem(idx - 1);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
              } else if (e.key === 'Tab') {
                close(false);
              }
            }}
            className="z-[80] overflow-hidden rounded-xl border border-linea bg-chapa p-1.5 shadow-alzada animate-desplegar"
          >
            {items.map((item, i) => (
              <button
                key={item.label}
                ref={(el) => {
                  itemsRef.current[i] = el;
                }}
                role="menuitem"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                  item.onSelect();
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium outline-none cursor-pointer',
                  item.tone === 'peligro' ? 'text-rojo-tinta hover:bg-rojo-velo focus:bg-rojo-velo' : 'text-tinta hover:bg-chapa-2 focus:bg-chapa-2'
                )}
              >
                {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
