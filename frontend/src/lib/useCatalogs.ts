'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { CatalogItem, CatalogKind } from '@/types/config';
import { fetchCatalog } from '@/lib/api-config';
import { ACTIVITY_TYPES, LOSS_REASONS, ORIGIN_OPTIONS } from '@/lib/catalogs';

/*
 * Catálogos configurables (tipos de actividad, orígenes, motivos de pérdida) con caché en memoria:
 * se piden una vez por sesión de la pestaña y se comparten entre todos los formularios.
 * Si la API falla, se usan los valores de respaldo de catalogs.ts.
 */

function fallbackItems(kind: CatalogKind, rows: { code: string; label: string }[]): CatalogItem[] {
  return rows.map((r, i) => ({
    id: `respaldo-${kind}-${r.code}`,
    kind,
    code: r.code,
    label: r.label,
    position: i + 1,
    is_active: true,
    is_system: kind === 'activity_type',
  }));
}

const FALLBACK: Record<CatalogKind, CatalogItem[]> = {
  activity_type: fallbackItems(
    'activity_type',
    ACTIVITY_TYPES.map((t) => ({ code: t.value, label: t.label }))
  ),
  origin: fallbackItems(
    'origin',
    ORIGIN_OPTIONS.map((label) => ({ code: label, label }))
  ),
  loss_reason: fallbackItems(
    'loss_reason',
    LOSS_REASONS.map((label) => ({ code: label, label }))
  ),
};

const cache = new Map<CatalogKind, CatalogItem[]>();
const inflight = new Map<CatalogKind, Promise<void>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function load(kind: CatalogKind): Promise<void> {
  if (cache.has(kind)) return Promise.resolve();
  const running = inflight.get(kind);
  if (running) return running;
  const p = fetchCatalog(kind)
    .then((items) => {
      cache.set(kind, items.length ? items : FALLBACK[kind]);
    })
    .catch(() => {
      // Sin API: se trabaja con el respaldo, y se reintenta en la próxima pantalla.
    })
    .finally(() => {
      inflight.delete(kind);
      notify();
    });
  inflight.set(kind, p);
  return p;
}

/** Fuerza a releer un catálogo (después de editarlo en Configuración). */
export function invalidateCatalog(kind: CatalogKind) {
  cache.delete(kind);
  notify();
  void load(kind);
}

/** Valores activos de un catálogo, en el orden que dejó el administrador. */
export function useCatalog(kind: CatalogKind): CatalogItem[] {
  const items = useSyncExternalStore(
    subscribe,
    () => cache.get(kind) ?? FALLBACK[kind],
    () => FALLBACK[kind]
  );
  useEffect(() => {
    void load(kind);
  }, [kind]);
  return items;
}

/**
 * Opciones para un select de orígenes o motivos (se guarda el texto). Si el registro tiene un valor
 * que ya no está activo (renombrado o desactivado), se agrega igual para que se siga viendo.
 */
export function withCurrent(items: CatalogItem[], current?: string | null): { value: string; label: string }[] {
  const options = items.map((i) => ({ value: i.label, label: i.label }));
  if (current && !options.some((o) => o.value === current)) options.unshift({ value: current, label: current });
  return options;
}
