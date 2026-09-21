'use client';

import React, { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  ImageIcon,
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
import type { Activity, ActivityAttachment, ActivityType, Contact, Opportunity } from '@/types/crm';
import { createActivity, uploadAttachment } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { DatePicker, toISODate } from '@/components/ui/DatePicker';
import { useToast } from '@/components/ui/Toast';
import { ACTIVITY_TYPES } from '@/lib/catalogs';
import { formatDateTime } from '@/lib/format';
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

const SHORT: Record<ActivityType, string> = {
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  visita_obra: 'Visita',
  mostrador: 'Local',
  email: 'Correo',
  presupuesto: 'Envío',
  reunion: 'Reunión',
  nota: 'Nota',
};

const PAGE = 5;
const MAX_MB = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

interface Pending {
  key: string;
  file: File;
  status: 'subiendo' | 'listo' | 'error';
  result?: ActivityAttachment;
}

interface ActivityLogProps {
  opp: Opportunity;
  activities: Activity[];
  contacts: Contact[];
  onSaved: () => Promise<void> | void;
}

/** Seguimiento: registrar lo que pasó (con quién, cuándo y con archivos) y recorrer el historial paginado. */
export function ActivityLog({ opp, activities, contacts, onSaved }: ActivityLogProps) {
  const toast = useToast();
  const [type, setType] = useState<ActivityType>('llamada');
  const [summary, setSummary] = useState('');
  const [contactId, setContactId] = useState(opp.contact_id ?? '');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<ActivityAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = toISODate(new Date());

  // Siempre del más nuevo al más viejo; ante la misma fecha, el último cargado primero.
  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime() || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [activities]
  );
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * PAGE, current * PAGE + PAGE);
  const contactName = (id?: string | null) => {
    const c = id ? contacts.find((x) => x.id === id) : null;
    return c ? `${c.first_name} ${c.last_name}` : null;
  };
  const uploading = pending.some((p) => p.status === 'subiendo');

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    for (const file of files) {
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
      setPage(0);
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
          className={clsx('@container relative mt-4 space-y-3.5 rounded-xl transition-shadow', dragOver && 'shadow-[0_0_0_2px_var(--color-pavonado)]')}
        >
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center rounded-xl bg-chapa/90 text-[15px] font-semibold">
              Soltá los archivos para adjuntarlos
            </div>
          )}
          <div role="radiogroup" aria-label="Tipo de contacto" className="grid grid-cols-3 gap-1.5 @[20rem]:grid-cols-4">
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
                    'flex min-w-0 flex-col items-center gap-1 rounded-[10px] border px-0.5 py-2 text-[12px] font-semibold tracking-[-0.01em] transition-colors cursor-pointer',
                    active ? 'border-pavonado bg-pavonado text-white' : 'border-linea text-tinta hover:border-linea-fuerte'
                  )}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span className="max-w-full truncate">{SHORT[t.value]}</span>
                </button>
              );
            })}
          </div>
          <Field label="Qué pasó">
            {({ id }) => <Input id={id} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Ej.: confirmó la losa para el lunes" />}
          </Field>
          <div className="grid grid-cols-1 gap-3 @[34rem]:grid-cols-2">
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
                  <span className="min-w-0 max-w-[180px] truncate font-medium">{p.file.name}</span>
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
              Adjuntar
            </Button>
            <Button type="submit" className="ml-auto" isLoading={saving} disabled={summary.trim().length < 2 || uploading}>
              {uploading ? 'Subiendo…' : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>

      <div className="border-t border-linea">
        {sorted.length === 0 ? (
          <p className="px-5 py-6 text-[15px] text-tiza">Sin contactos registrados.</p>
        ) : (
          <>
            <ol className="max-h-[440px] space-y-4 overflow-y-auto overscroll-contain px-5 py-5" aria-label="Historial de contactos">
              {visible.map((a) => {
                const Icon = ACTIVITY_ICON[a.activity_type] ?? FileText;
                const who = contactName(a.contact_id);
                return (
                  <li key={a.id} className="flex gap-3">
                    <span className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full border border-linea bg-chapa text-tinta">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug break-words">{a.summary}</p>
                      {a.description && <p className="mt-0.5 whitespace-pre-line text-sm leading-snug text-tiza break-words">{a.description}</p>}
                      <p className="mt-1 text-[13px] text-tiza">
                        {formatDateTime(a.activity_date)} · {a.user_name || 'Vendedor'}
                        {who && <> · con {who}</>}
                      </p>
                      {a.attachments && a.attachments.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {a.attachments.map((f) => (
                            <li key={f.url}>
                              <button
                                type="button"
                                onClick={() => setViewing(f)}
                                className="group flex items-center gap-2 overflow-hidden rounded-lg border border-linea bg-chapa-2 pr-2.5 text-left text-[13px] font-medium hover:border-linea-fuerte cursor-pointer"
                                aria-label={`Ver ${f.name}`}
                              >
                                <Thumb file={f} />
                                <span className="min-w-0 max-w-[160px] truncate">{f.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-linea px-5 py-2.5">
                <span className="cifra text-sm text-tiza">
                  {current * PAGE + 1}–{Math.min(sorted.length, current * PAGE + PAGE)} de {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(current - 1)}
                    disabled={current === 0}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-chapa-2 disabled:opacity-35 cursor-pointer"
                    aria-label="Más nuevos"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="cifra px-1 text-sm font-semibold">
                    {current + 1} / {pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(current + 1)}
                    disabled={current >= pages - 1}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-chapa-2 disabled:opacity-35 cursor-pointer"
                    aria-label="Más viejos"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {viewing && <AttachmentViewer file={viewing} onClose={() => setViewing(null)} />}
    </section>
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
