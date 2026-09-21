'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

interface PopoverOptions {
  /** Ancho mínimo del panel; por defecto, el ancho del disparador. */
  minWidth?: number;
  /** Alto máximo deseado antes de voltear el panel hacia arriba. */
  maxHeight?: number;
  align?: 'start' | 'end';
}

export interface PopoverPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'abajo' | 'arriba';
}

/**
 * Panel flotante anclado a un disparador: se posiciona en `fixed` a partir del rectángulo
 * del disparador, se voltea hacia arriba si no hay lugar y nunca se sale de la pantalla.
 */
export function usePopover<T extends HTMLElement = HTMLButtonElement>({ minWidth = 0, maxHeight = 340, align = 'start' }: PopoverOptions = {}) {
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPosition | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const margin = 8;
    const width = Math.min(Math.max(r.width, minWidth), vw - margin * 2);
    let left = align === 'end' ? r.right - width : r.left;
    left = Math.max(margin, Math.min(left, vw - width - margin));
    const below = vh - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    const placeBelow = below >= Math.min(maxHeight, 220) || below >= above;
    const room = placeBelow ? below : above;
    setPos({
      top: placeBelow ? r.bottom + gap : r.top - gap,
      left,
      width,
      maxHeight: Math.max(160, Math.min(maxHeight, room)),
      placement: placeBelow ? 'abajo' : 'arriba',
    });
  }, [align, maxHeight, minWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => measure();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, measure]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return { triggerRef, panelRef, open, setOpen, close, pos };
}

/** Estilo del panel flotante según la posición calculada. */
export function popoverStyle(pos: PopoverPosition | null): CSSProperties {
  if (!pos) return { position: 'fixed', visibility: 'hidden', top: 0, left: 0 };
  return {
    position: 'fixed',
    left: pos.left,
    width: pos.width,
    maxHeight: pos.maxHeight,
    ...(pos.placement === 'abajo' ? { top: pos.top } : { bottom: window.innerHeight - pos.top }),
  };
}
