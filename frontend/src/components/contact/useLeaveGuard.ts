'use client';

import { useEffect, useState } from 'react';

/**
 * Avisa antes de salir con cambios sin guardar: al recargar o cerrar la pestaña (beforeunload)
 * y al tocar un enlace interno (se frena la navegación y se pide confirmación).
 */
export function useLeaveGuard(active: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);

  return { pendingHref, cancel: () => setPendingHref(null) };
}

/** Sólo rutas internas ("/opportunities/…"): evita redirigir a otro sitio con ?volver=. */
export function safeBackHref(value: string | null | undefined, fallback: string): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
