'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Diálogo centrado, sólo para confirmar algo puntual (cerrar una venta, dar de baja).
 * Las tareas largas viven en su propia vista, no en paneles.
 */
export function Dialog({ title, icon, onClose, footer, children }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button:not([data-cerrar])');
      (target ?? panelRef.current)?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-aparecer">
      <div className="absolute inset-0 bg-pavonado/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full sm:w-[min(460px,100%)] max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-chapa shadow-alzada outline-none animate-subir"
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
          <h2 id={titleId} className="titular min-w-0 flex-1 text-xl">
            {title}
          </h2>
          <button
            type="button"
            data-cerrar
            onClick={onClose}
            className="-mr-2 -mt-1.5 h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg text-tiza hover:bg-chapa-2 hover:text-tinta cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children && <div className="px-6 pt-3">{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
