'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  ClipboardList,
  FilePlus2,
  FileText,
  Flag,
  Inbox,
  Layers,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RotateCw,
  Store,
  Users,
} from 'lucide-react';
import type { HistoryEntry, HistoryKind, HistoryPage, HistoryScope } from '@/types/history';
import { fetchClientHistory } from '@/lib/api-history';
import { useCatalog } from '@/lib/useCatalogs';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { LogoLoader } from '@/components/brand/LogoLoader';
import { DetailSection } from './DetailBits';

const STEP = 20;

type Filter = 'todo' | HistoryKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'actividad', label: 'Actividades' },
  { value: 'presupuesto', label: 'Presupuestos' },
  { value: 'etapa', label: 'Etapas' },
  { value: 'version', label: 'Versiones' },
  { value: 'mensaje', label: 'Mensajes' },
];

type Icon = React.ComponentType<{ className?: string }>;

const KIND_ICON: Record<HistoryKind, Icon> = {
  actividad: FileText,
  presupuesto: FilePlus2,
  etapa: Flag,
  version: Layers,
  mensaje: Inbox,
};

const ACTIVITY_ICON: Record<string, Icon> = {
  llamada: Phone,
  whatsapp: MessageSquare,
  visita_obra: MapPin,
  mostrador: Store,
  email: Mail,
  presupuesto: ClipboardList,
  reunion: Users,
  nota: FileText,
};

/** Hitos del presupuesto (alta, etapa, versión): se destacan como en el seguimiento. */
const MILESTONES: HistoryKind[] = ['presupuesto', 'etapa', 'version'];

const TIME = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const DAY_YEAR = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return (d.getFullYear() === today.getFullYear() ? DAY : DAY_YEAR).format(d).replace('.', '');
}

/** Suma ?volver=<ruta> al link del seguimiento, respetando su query (?ver=) y su ancla (#seguimiento). */
function withBack(link: string, back: string): string {
  const [path, hash] = link.split('#');
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}volver=${encodeURIComponent(back)}${hash ? `#${hash}` : ''}`;
}

interface Result {
  key: string;
  page?: HistoryPage;
  error?: string;
}

/** Historial comercial de una empresa o un contacto: actividades, hitos de sus presupuestos y mensajes. */
export function ClientHistory({ scope, id, refreshKey = 0 }: { scope: HistoryScope; id: string; /** Cambiarlo vuelve a pedir el historial (ej.: al registrar una actividad). */ refreshKey?: number }) {
  const pathname = usePathname() || `/${scope}/${id}`;
  const [filter, setFilter] = useState<Filter>('todo');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Cada pedido tiene su clave: si el resultado no es del pedido actual, se está cargando.
  const baseKey = `${scope}:${id}:${filter}:${attempt}`;
  const reqKey = `${baseKey}:${refreshKey}`;
  const kind = filter === 'todo' ? null : filter;

  useEffect(() => {
    let alive = true;
    fetchClientHistory(scope, id, { kind, limit: STEP })
      .then((page) => alive && setResult({ key: reqKey, page }))
      .catch((err: unknown) => alive && setResult({ key: reqKey, error: err instanceof Error ? err.message : 'No se pudo cargar el historial' }));
    return () => {
      alive = false;
    };
  }, [scope, id, kind, reqKey]);

  const pendingReq = result?.key !== reqKey;
  // Al refrescar (misma vista, nuevo refreshKey) se mantiene lo que ya se veía hasta que llega lo nuevo.
  const refreshing = pendingReq && Boolean(result?.page) && Boolean(result?.key.startsWith(`${baseKey}:`));
  const loading = pendingReq && !refreshing;
  const page = !pendingReq || refreshing ? result?.page : undefined;
  // Los conteos por tipo no dependen del filtro: se mantienen mientras carga otro.
  const counts = result?.page?.counts;
  const all = counts ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) : undefined;

  const loadMore = async () => {
    if (!page) return;
    setLoadingMore(true);
    try {
      const next = await fetchClientHistory(scope, id, { kind, limit: STEP, offset: page.items.length });
      setResult((prev) =>
        prev?.key === reqKey && prev.page ? { key: reqKey, page: { ...next, items: [...prev.page.items, ...next.items], offset: 0 } } : prev
      );
    } catch {
      // Sin cambios: el botón queda para volver a intentar.
    } finally {
      setLoadingMore(false);
    }
  };

  const options = FILTERS.filter((f) => f.value === 'todo' || f.value === filter || (counts?.[f.value as HistoryKind] ?? 0) > 0).map((f) => ({
    ...f,
    count: f.value === 'todo' ? all : counts?.[f.value as HistoryKind],
  }));

  return (
    <DetailSection title="Historial" count={all}>
      {(all ?? 0) > 0 && (
        <div className="px-5 pb-3">
          <FilterChips label="Filtrar el historial por tipo" options={options} value={filter} onChange={setFilter} />
        </div>
      )}
      <div className="border-t border-linea">
        {loading ? (
          <div className="flex justify-center px-5 py-10">
            <LogoLoader label="Cargando historial" showLabel className="h-10 w-10" />
          </div>
        ) : result?.error ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <p className="text-[15px] text-tiza">{result.error}</p>
            <Button variant="secundario" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              <RotateCw className="w-4 h-4" aria-hidden />
              Reintentar
            </Button>
          </div>
        ) : !page || page.items.length === 0 ? (
          <EmptyState
            illustration="clientes"
            className="m-5"
            title={filter === 'todo' ? 'Todavía no hay historial' : 'No hay hechos de este tipo'}
            description={
              filter === 'todo'
                ? 'Acá van a aparecer los presupuestos, sus cambios de etapa y versiones, las actividades registradas y los mensajes del cliente.'
                : 'Probá con otro filtro para ver el resto del historial.'
            }
          />
        ) : (
          <div className="px-5 pb-5">
            <ol className="space-y-3.5" aria-label="Historial comercial, del más nuevo al más viejo">
              {page.items.map((entry, i) => {
                const at = new Date(entry.at);
                const label = dayLabel(at);
                const header = i === 0 || dayLabel(new Date(page.items[i - 1].at)) !== label;
                return (
                  <li key={entry.id}>
                    {header && <p className="mb-2 pt-3 text-[13px] font-bold text-tiza">{label}</p>}
                    <HistoryItem entry={entry} at={at} back={pathname} />
                  </li>
                );
              })}
            </ol>
            {page.has_more ? (
              <div className="flex justify-center pt-4">
                <Button variant="secundario" size="sm" isLoading={loadingMore} onClick={loadMore}>
                  Ver más ({page.total - page.items.length})
                </Button>
              </div>
            ) : (
              page.total > STEP && <p className="pt-4 text-center text-[13px] text-tiza">Principio del historial</p>
            )}
          </div>
        )}
      </div>
    </DetailSection>
  );
}

function HistoryItem({ entry: e, at, back }: { entry: HistoryEntry; at: Date; back: string }) {
  const milestone = MILESTONES.includes(e.kind);
  const activityTypes = useCatalog('activity_type');
  const activityType = e.kind === 'actividad' && e.activity_type ? activityTypes.find((t) => t.code === e.activity_type) : undefined;
  const Icon = (e.activity_type && ACTIVITY_ICON[e.activity_type]) || KIND_ICON[e.kind] || FileText;
  const typeLabel = activityType?.label ?? e.kind_label;
  return (
    <div className="flex gap-3">
      <span
        title={typeLabel}
        className={clsx(
          'mt-0.5 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full',
          milestone ? 'bg-pavonado text-white' : 'border border-linea bg-chapa text-tinta'
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="sr-only">{typeLabel}</span>
      </span>
      <div className={clsx('min-w-0 flex-1', milestone && 'rounded-lg bg-chapa-2 px-3 py-2')}>
        <p className={clsx('leading-snug break-words', milestone ? 'text-[14px] font-bold' : 'text-[15px] font-semibold')}>{e.title}</p>
        {e.detail && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm leading-snug text-tiza break-words">{e.detail}</p>}
        {e.result && (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug break-words">
            <span className="font-semibold">Resultado:</span> {e.result}
          </p>
        )}
        <p className="mt-0.5 text-[13px] text-tiza">
          <span className="cifra">{TIME.format(at)}</span>
          {e.user_name && (
            <>
              {' · '}
              {e.kind === 'mensaje' ? `de ${e.user_name}` : e.user_name}
            </>
          )}
          {e.link && (
            <>
              {' · '}
              <Link
                href={withBack(e.link, back)}
                className="font-semibold text-tinta underline decoration-linea-fuerte underline-offset-2 hover:decoration-tinta"
              >
                {e.kind === 'presupuesto' ? 'Ver seguimiento' : `Presupuesto «${e.opportunity_title || 'sin título'}»`}
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
