'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowUp, FileText, Flag, ImageIcon, Layers, Loader2 } from 'lucide-react';
import type { Activity, ActivityAttachment, Contact, Opportunity, SystemActivityType, TimelineEvent } from '@/types/crm';
import { formatARSCompact } from '@/lib/format';
import { AttachmentViewer, isImage } from './AttachmentViewer';
import { ActivityForm } from './ActivityForm';
import { ACTIVITY_ICON, DEFAULT_ACTIVITY_ICON } from './activityIcons';

export { ACTIVITY_ICON, DEFAULT_ACTIVITY_ICON };

const STEP = 8;

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

type Entry = { key: string; at: Date; order: number } & ({ kind: 'actividad'; activity: Activity } | { kind: 'hito'; event: TimelineEvent });

interface ActivityLogProps {
  opp: Opportunity;
  activities: Activity[];
  events?: TimelineEvent[];
  contacts: Contact[];
  onSaved: () => Promise<void> | void;
  /** Abre el historial de versiones (lo maneja la página del presupuesto). */
  onShowVersions?: () => void;
}

/** Seguimiento: registrar lo que pasó (con quién, cuándo y con archivos) y recorrer el historial con sus hitos. */
export function ActivityLog({ opp, activities, events = [], contacts, onSaved, onShowVersions }: ActivityLogProps) {
  const [shown, setShown] = useState(STEP);
  const [away, setAway] = useState(false);
  const [viewing, setViewing] = useState<{ files: ActivityAttachment[]; index: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Todo junto, del más nuevo al más viejo: lo registrado y los hitos (etapas, versiones).
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...activities.map((a) => ({ key: `a-${a.id}`, at: new Date(a.activity_date), order: new Date(a.created_at).getTime(), kind: 'actividad' as const, activity: a })),
      ...events.map((e) => ({ key: `h-${e.id}`, at: new Date(e.at), order: new Date(e.at).getTime(), kind: 'hito' as const, event: e })),
    ];
    return list.sort((x, y) => y.at.getTime() - x.at.getTime() || y.order - x.order);
  }, [activities, events]);

  // Una cita de «Ponete al día» llega con ?ver=actividad-<id> (o etapa-, version-): se muestra y se resalta.
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => {
    const ver = new URLSearchParams(window.location.search).get('ver');
    if (!ver) return;
    const [kind, ...rest] = ver.split('-');
    const id = rest.join('-');
    const key = kind === 'actividad' ? `a-${id}` : kind === 'etapa' || kind === 'version' ? `h-${kind}-${id}` : null;
    const index = key ? entries.findIndex((e) => e.key === key) : -1;
    if (index < 0) return;
    const timer = window.setTimeout(() => {
      setShown((n) => Math.max(n, index + 1));
      setHighlight(key);
      window.requestAnimationFrame(() => {
        document.getElementById('seguimiento')?.scrollIntoView({ block: 'start' });
        listRef.current?.querySelector(`[data-entry="${key}"]`)?.scrollIntoView({ block: 'center' });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entries]);

  const total = entries.length;
  const visible = entries.slice(0, shown);
  const done = shown >= total;
  const contactName = (id?: string | null) => {
    const c = id ? contacts.find((x) => x.id === id) : null;
    return c ? `${c.first_name} ${c.last_name}` : null;
  };

  // Carga progresiva al llegar al final del historial (scroll propio de la lista).
  useEffect(() => {
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target || done) return;
    const io = new IntersectionObserver((items) => items[0]?.isIntersecting && setShown((n) => n + STEP), { root, rootMargin: '160px' });
    io.observe(target);
    return () => io.disconnect();
  }, [done, total]);

  const toLatest = () => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  // Al registrar, el historial vuelve al principio para mostrar lo nuevo.
  const saved = async () => {
    setShown(STEP);
    listRef.current?.scrollTo({ top: 0 });
    await onSaved();
  };

  return (
    <section aria-labelledby="seguimiento" className="flex min-w-0 flex-col rounded-2xl border border-linea bg-chapa shadow-suave">
      <div className="p-5 pb-4">
        <h2 id="seguimiento" className="titular text-lg">
          Seguimiento
        </h2>

        <ActivityForm
          className="mt-3"
          opportunityId={opp.id}
          companyId={opp.company_id}
          contacts={contacts}
          defaultContactId={opp.contact_id}
          onSaved={saved}
        />
      </div>

      <div className="relative border-t border-linea">
        {total === 0 ? (
          <p className="px-5 py-6 text-[15px] text-tiza">Sin contactos registrados.</p>
        ) : (
          <>
            <div
              ref={listRef}
              onScroll={(e) => setAway(e.currentTarget.scrollTop > 240)}
              className="max-h-[360px] overflow-y-auto overscroll-contain px-5 pb-4"
              aria-label="Historial del presupuesto"
              role="region"
              tabIndex={0}
            >
              <ol className="space-y-3.5">
                {visible.map((entry, i) => {
                  const label = dayLabel(entry.at);
                  const header = i === 0 || dayLabel(visible[i - 1].at) !== label;
                  return (
                    <li
                      key={entry.key}
                      data-entry={entry.key}
                      className={clsx(highlight === entry.key && '-mx-2 rounded-xl bg-amarillo/25 px-2 py-1.5 ring-2 ring-amarillo')}
                    >
                      {header && (
                        <p className="sticky top-0 z-[1] -mx-5 mb-2 bg-chapa/95 px-5 pb-1 pt-3 text-[13px] font-bold text-tiza backdrop-blur-[2px]">{label}</p>
                      )}
                      {entry.kind === 'hito' ? (
                        <Milestone event={entry.event} onShowVersions={onShowVersions} />
                      ) : (
                        <ActivityItem
                          activity={entry.activity}
                          who={contactName(entry.activity.contact_id)}
                          onOpen={(files, index) => setViewing({ files, index })}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
              {done ? (
                total > STEP && <p className="pt-4 text-center text-[13px] text-tiza">Principio del seguimiento</p>
              ) : (
                <div ref={sentinelRef} className="flex justify-center pt-4 text-tiza" aria-hidden>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
            {away && (
              <button
                type="button"
                onClick={toLatest}
                className="absolute bottom-3 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-pavonado px-3.5 text-[13px] font-semibold text-white shadow-alzada animate-aparecer cursor-pointer hover:bg-pavonado-3"
              >
                <ArrowUp className="w-4 h-4" aria-hidden />
                Ir al último
              </button>
            )}
          </>
        )}
      </div>
      {viewing && <AttachmentViewer files={viewing.files} index={viewing.index} onClose={() => setViewing(null)} />}
    </section>
  );
}

function ActivityItem({ activity: a, who, onOpen }: { activity: Activity; who: string | null; onOpen: (files: ActivityAttachment[], index: number) => void }) {
  const Icon = ACTIVITY_ICON[a.activity_type as SystemActivityType] ?? DEFAULT_ACTIVITY_ICON;
  const files = a.attachments ?? [];
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full border border-linea bg-chapa text-tinta">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug break-words">{a.summary}</p>
        {a.description && <p className="mt-0.5 whitespace-pre-line text-sm leading-snug text-tiza break-words">{a.description}</p>}
        {a.result && (
          <p className="mt-0.5 text-sm leading-snug break-words">
            <span className="font-semibold">Resultado:</span> {a.result}
          </p>
        )}
        <p className="mt-0.5 text-[13px] text-tiza">
          <span className="cifra">{TIME.format(new Date(a.activity_date))}</span> · {a.user_name || 'Vendedor'}
          {who && <> · con {who}</>}
        </p>
        {files.length > 0 && (
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label={`${files.length} ${files.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'}`}>
            {files.map((f, i) => (
              <li key={`${f.url}-${i}`} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onOpen(files, i)}
                  className="group flex w-[132px] items-center gap-2 overflow-hidden rounded-lg border border-linea bg-chapa-2 pr-2 text-left text-[13px] font-medium hover:border-linea-fuerte cursor-pointer"
                  aria-label={`Ver ${f.name}`}
                  title={f.name}
                >
                  <Thumb file={f} />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Hito: cambio de etapa o nueva versión de materiales, con fecha y hora exactas. */
function Milestone({ event: e, onShowVersions }: { event: TimelineEvent; onShowVersions?: () => void }) {
  const Icon = e.kind === 'version' ? Layers : Flag;
  const delta = e.kind === 'version' && e.total != null && e.previous_total != null ? Number(e.total) - Number(e.previous_total) : null;
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full bg-pavonado text-white">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1 rounded-lg bg-chapa-2 px-3 py-2">
        <p className="text-[14px] font-bold leading-snug break-words">{e.title}</p>
        {(e.detail || delta !== null) && (
          <p className="text-[13px] leading-snug text-tiza break-words">
            {delta !== null && (
              <span className="cifra font-semibold text-tinta">
                {formatARSCompact(e.previous_total)} → {formatARSCompact(e.total)} ({delta >= 0 ? '+' : '−'}
                {formatARSCompact(Math.abs(delta))})
              </span>
            )}
            {delta !== null && e.detail ? ' · ' : ''}
            {e.detail}
          </p>
        )}
        <p className="text-[13px] text-tiza">
          <span className="cifra">{TIME.format(new Date(e.at))}</span>
          {e.user_name && <> · {e.user_name}</>}
          {e.kind === 'version' && onShowVersions && (
            <>
              {' · '}
              <button type="button" onClick={onShowVersions} className="font-semibold text-tinta underline decoration-linea-fuerte underline-offset-2 hover:decoration-tinta cursor-pointer">
                Ver versiones
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Miniatura del adjunto; si la foto no carga, queda el ícono del tipo de archivo. */
function Thumb({ file }: { file: ActivityAttachment }) {
  const [broken, setBroken] = useState(false);
  if (isImage(file) && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt="" onError={() => setBroken(true)} className="h-10 w-10 shrink-0 bg-linea object-cover" />;
  }
  const Icon = isImage(file) ? ImageIcon : FileText;
  return (
    <span className="h-10 w-10 shrink-0 inline-flex items-center justify-center bg-linea text-tinta">
      <Icon className="w-4 h-4" />
    </span>
  );
}
