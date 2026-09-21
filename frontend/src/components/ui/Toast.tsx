'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

type ToastTone = 'exito' | 'error' | 'aviso' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONES: Record<ToastTone, { shell: string; badge: string; icon: React.ReactNode }> = {
  exito: {
    shell: 'bg-verde-velo border-verde/35 text-verde-tinta',
    badge: 'bg-verde text-white',
    icon: <Check className="w-4 h-4" strokeWidth={3} />,
  },
  error: {
    shell: 'bg-rojo-velo border-rojo/35 text-rojo-tinta',
    badge: 'bg-rojo text-white',
    icon: <X className="w-4 h-4" strokeWidth={3} />,
  },
  aviso: {
    shell: 'bg-ambar-velo border-ambar/45 text-ambar-tinta',
    badge: 'bg-ambar text-pavonado',
    icon: <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />,
  },
  info: {
    shell: 'bg-chapa border-linea text-tinta',
    badge: 'bg-pavonado text-white',
    icon: <Info className="w-4 h-4" strokeWidth={2.5} />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: ToastTone, title: string, message?: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-2), { id, tone, title, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, m) => push('exito', t, m),
      error: (t, m) => push('error', t, m),
      warning: (t, m) => push('aviso', t, m),
      info: (t, m) => push('info', t, m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 z-[90] flex flex-col gap-2 bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-auto lg:right-6 lg:w-[400px]"
      >
        {items.map((t) => {
          const tone = TONES[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={clsx('pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border px-4 py-3.5 shadow-alzada animate-subir', tone.shell)}
            >
              <span className={clsx('mt-px h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-full', tone.badge)} aria-hidden>
                {tone.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-snug break-words">{t.title}</p>
                {t.message && <p className="mt-0.5 text-sm leading-snug text-tinta/80 break-words">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-mr-1.5 -mt-1 h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 cursor-pointer"
                aria-label="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
