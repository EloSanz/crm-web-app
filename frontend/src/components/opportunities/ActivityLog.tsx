'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowUp,
  ClipboardList,
  FileText,
  Flag,
  ImageIcon,
  Layers,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  Store,
  Users,
  X,
} from 'lucide-react';
import type { Activity, ActivityAttachment, ActivityType, Contact, Opportunity, TimelineEvent } from '@/types/crm';
import { createActivity, uploadAttachment } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { DatePicker, toISODate } from '@/components/ui/DatePicker';
import { useToast } from '@/components/ui/Toast';
import { ACTIVITY_TYPES } from '@/lib/catalogs';
import { formatARSCompact } from '@/lib/format';
import { AttachmentViewer, formatBytes, isImage } from './AttachmentViewer';

export const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  llamada: Phone,
  whatsapp: MessageSquare,
  visita_obra: MapPin,
  mostrador: Store,
  email: Mail,
  presupuesto: ClipboardList,
  reunion: Users,
  nota: FileText,
};

const PLACEHOLDER: Record<ActivityType, string> = {
  llamada: 'Llamada: ¿qué se habló?',
  whatsapp: 'WhatsApp: ¿qué respondió?',
  visita_obra: 'Visita a la obra: ¿qué viste?',
  mostrador: 'En el local: ¿qué pidió?',
  email: 'Correo: ¿qué se envió?',
  presupuesto: 'Envío del presupuesto: ¿por dónde?',
  reunion: 'Reunión: ¿qué se acordó?',
  nota: 'Nota interna',
};

const STEP = 8;
const MAX_MB = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

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

interface Pending {
  key: string;
  file: File;
  status: 'subiendo' | 'listo' | 'error';
  result?: ActivityAttachment;
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
  const toast = useToast();
  const [type, setType] = useState<ActivityType>('llamada');
  const [summary, setSummary] = useState('');
  const [contactId, setContactId] = useState(opp.contact_id ?? '');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState(STEP);
  const [away, setAway] = useState(false);
  const [viewing, setViewing] = useState<{ files: ActivityAttachment[]; index: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const today = toISODate(new Date());

  // Todo junto, del más nuevo al más viejo: lo registrado y los hitos (etapas, versiones).
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...activities.map((a) => ({ key: `a-${a.id}`, at: new Date(a.activity_date), order: new Date(a.created_at).getTime(), kind: 'actividad' as const, activity: a })),
      ...events.map((e) => ({ key: `h-${e.id}`, at: new Date(e.at), order: new Date(e.at).getTime(), kind: 'hito' as const, event: e })),
    ];
    return list.sort((x, y) => y.at.getTime() - x.at.getTime() || y.order - x.order);
  }, [activities, events]);

  const total = entries.length;
  const visible = entries.slice(0, shown);
  const done = shown >= total;
  const contactName = (id?: string | null) => {
    const c = id ? contacts.find((x) => x.id === id) : null;
    return c ? `${c.first_name} ${c.last_name}` : null;
  };
  const uploading = pending.some((p) => p.status === 'subiendo');

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

  const addFiles = (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      if (!ACCEPT.split(',').includes(file.type)) {
        toast.warning('Formato no admitido', `${file.name}: subí fotos (JPG, PNG, WEBP) o PDF.`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.warning('Archivo muy pesado', `${file.name} supera ${MAX_MB} MB.`);
        continue;
      }
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setPending((prev) => [...prev, { key, file, status: 'subiendo' }]);
      uploadAttachment(file)
        .then((result) => setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'listo', result } : p))))
        .catch((err) => {
          setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'error' } : p)));
          toast.error('No se pudo subir el archivo', err instanceof Error ? err.message : file.name);
        });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (summary.trim().length < 2 || uploading) return;
    setSaving(true);
    try {
      const when = !date || date === today ? new Date() : new Date(`${date}T12:00:00`);
      await createActivity({
        opportunity_id: opp.id,
        company_id: opp.company_id || undefined,
        contact_id: contactId || opp.contact_id || undefined,
        activity_type: type,
        summary: summary.trim(),
        activity_date: when.toISOString(),
        attachments: pending.filter((p) => p.status === 'listo' && p.result).map((p) => p.result as ActivityAttachment),
      });
      setSummary('');
      setPending([]);
      setShown(STEP);
      listRef.current?.scrollTo({ top: 0 });
      toast.success('Contacto registrado', 'El seguimiento quedó al día.');
      await onSaved();
    } catch (err) {
      toast.error('No se pudo registrar', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="seguimiento" className="flex min-w-0 flex-col rounded-2xl border border-linea bg-chapa shadow-suave">
      <div className="p-5 pb-4">
        <h2 id="seguimiento" className="titular text-lg">
          Seguimiento
        </h2>

        <form
          onSubmit={submit}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={clsx('@container relative mt-3 space-y-3 rounded-xl transition-shadow', dragOver && 'shadow-[0_0_0_2px_var(--color-pavonado)]')}
        >
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center rounded-xl bg-chapa/90 text-[15px] font-semibold">
              Soltá los archivos para adjuntarlos
            </div>
          )}
          <div role="radiogroup" aria-label="Tipo de contacto" className="grid grid-cols-8 gap-1">
            {ACTIVITY_TYPES.map((t) => {
              const Icon = ACTIVITY_ICON[t.value];
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => setType(t.value)}
                  className={clsx(
                    'flex h-10 min-w-0 items-center justify-center rounded-[10px] border transition-colors cursor-pointer',
                    active ? 'border-pavonado bg-pavonado text-white' : 'border-linea text-tinta hover:border-linea-fuerte'
                  )}
                >
                  <Icon className="w-4.5 h-4.5" />
                </button>
              );
            })}
          </div>
          <Field label={ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? 'Qué pasó'}>
            {({ id }) => <Input id={id} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={PLACEHOLDER[type]} />}
          </Field>
          <div className="grid grid-cols-1 gap-3 @[30rem]:grid-cols-2">
            <Field label="Con quién">
              {({ id }) => (
                <Select
                  id={id}
                  value={contactId}
                  onChange={setContactId}
                  placeholder="Sin especificar"
                  options={[{ value: '', label: 'Sin especificar' }, ...contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, hint: c.job_title || undefined }))]}
                />
              )}
            </Field>
            <Field label="Fecha">
              {({ id }) => <DatePicker id={id} value={date} onChange={setDate} max={today} clearable={false} />}
            </Field>
          </div>

          {pending.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Archivos adjuntos">
              {pending.map((p) => (
                <li
                  key={p.key}
                  className={clsx(
                    'flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px]',
                    p.status === 'error' ? 'border-rojo/40 bg-rojo-velo text-rojo-tinta' : 'border-linea bg-chapa-2'
                  )}
                >
                  {p.status === 'subiendo' ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Paperclip className="w-3.5 h-3.5 shrink-0" />}
                  <span className="min-w-0 max-w-[160px] truncate font-medium">{p.file.name}</span>
                  <span className="shrink-0 text-tiza">{p.status === 'error' ? 'falló' : formatBytes(p.file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setPending((prev) => prev.filter((x) => x.key !== p.key))}
                    className="-mr-1 h-6 w-6 shrink-0 inline-flex items-center justify-center rounded text-tiza hover:bg-linea hover:text-tinta cursor-pointer"
                    aria-label={`Quitar ${p.file.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button variant="secundario" onClick={() => fileRef.current?.click()}>
              <Paperclip className="w-4 h-4" aria-hidden />
              {pending.length ? `Adjuntar (${pending.length})` : 'Adjuntar'}
            </Button>
            <Button type="submit" className="ml-auto" isLoading={saving} disabled={summary.trim().length < 2 || uploading}>
              {uploading ? 'Subiendo…' : 'Registrar'}
            </Button>
          </div>
        </form>
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
                    <li key={entry.key}>
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
  const Icon = ACTIVITY_ICON[a.activity_type] ?? FileText;
  const files = a.attachments ?? [];
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full border border-linea bg-chapa text-tinta">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug break-words">{a.summary}</p>
        {a.description && <p className="mt-0.5 whitespace-pre-line text-sm leading-snug text-tiza break-words">{a.description}</p>}
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
