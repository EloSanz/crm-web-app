'use client';

import React, { useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Loader2, Paperclip, X } from 'lucide-react';
import type { ActivityAttachment, ActivityType, Contact, SystemActivityType } from '@/types/crm';
import { createActivity, uploadAttachment } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { DatePicker, toISODate } from '@/components/ui/DatePicker';
import { useToast } from '@/components/ui/Toast';
import { useCatalog } from '@/lib/useCatalogs';
import { formatBytes } from './AttachmentViewer';
import { ACTIVITY_ICON, DEFAULT_ACTIVITY_ICON } from './activityIcons';

const PLACEHOLDER: Record<SystemActivityType, string> = {
  llamada: 'Llamada: ¿qué se habló?',
  whatsapp: 'WhatsApp: ¿qué respondió?',
  visita_obra: 'Visita a la obra: ¿qué viste?',
  mostrador: 'En el local: ¿qué pidió?',
  email: 'Correo: ¿qué se envió?',
  presupuesto: 'Envío del presupuesto: ¿por dónde?',
  reunion: 'Reunión: ¿qué se acordó?',
  nota: 'Nota interna',
};

const MAX_MB = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
/** Mismo margen que el backend para relojes desfasados. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

interface Pending {
  key: string;
  file: File;
  status: 'subiendo' | 'listo' | 'error';
  result?: ActivityAttachment;
}

interface ActivityFormProps {
  /** Presupuesto al que se vincula; sin él, la actividad queda en la ficha de la empresa o el contacto. */
  opportunityId?: string;
  companyId?: string | null;
  /** Contactos para elegir «Con quién». Vacío: no se muestra el selector. */
  contacts?: Contact[];
  defaultContactId?: string | null;
  onSaved: () => Promise<void> | void;
  className?: string;
}

/** Registrar un contacto o actividad: tipo, qué pasó, con quién, fecha y hora, detalle, resultado y adjuntos. */
export function ActivityForm({ opportunityId, companyId, contacts = [], defaultContactId, onSaved, className }: ActivityFormProps) {
  const toast = useToast();
  const [type, setType] = useState<ActivityType>('llamada');
  // Tipos activos en el orden de Configuración.
  const activityTypes = useCatalog('activity_type');
  const typeLabel = activityTypes.find((t) => t.code === type)?.label;
  const [summary, setSummary] = useState('');
  const [contactId, setContactId] = useState(defaultContactId ?? '');
  const [date, setDate] = useState(() => toISODate(new Date()));
  // Hora: arranca en la actual; mientras no se toque, se registra el momento de guardar.
  const [time, setTime] = useState(() => hhmm(new Date()));
  const [timeTouched, setTimeTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const moreId = useId();
  const today = toISODate(new Date());
  const uploading = pending.some((p) => p.status === 'subiendo');
  const extraCount = [description, result].filter((v) => v.trim()).length;

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
        .then((res) => setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'listo', result: res } : p))))
        .catch((err) => {
          setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'error' } : p)));
          toast.error('No se pudo subir el archivo', err instanceof Error ? err.message : file.name);
        });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (summary.trim().length < 2 || uploading) return;
    const now = new Date();
    const when = date === today && !timeTouched ? now : new Date(`${date || today}T${time || '12:00'}:00`);
    if (Number.isNaN(when.getTime())) {
      toast.warning('Revisá la fecha y la hora');
      return;
    }
    // La actividad es algo que ya pasó: no se registra a futuro.
    if (when.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
      toast.warning('La hora todavía no llegó', 'Registrá algo que ya pasó: elegí una fecha y hora anteriores.');
      return;
    }
    setSaving(true);
    try {
      await createActivity({
        opportunity_id: opportunityId || undefined,
        company_id: companyId || undefined,
        contact_id: contactId || defaultContactId || undefined,
        activity_type: type,
        summary: summary.trim(),
        description: description.trim() || undefined,
        result: result.trim() || undefined,
        activity_date: when.toISOString(),
        attachments: pending.filter((p) => p.status === 'listo' && p.result).map((p) => p.result as ActivityAttachment),
      });
      setSummary('');
      setDescription('');
      setResult('');
      setMoreOpen(false);
      setPending([]);
      setDate(toISODate(new Date()));
      setTime(hhmm(new Date()));
      setTimeTouched(false);
      toast.success('Contacto registrado', opportunityId ? 'El seguimiento quedó al día.' : 'Quedó en el historial del cliente.');
      await onSaved();
    } catch (err) {
      toast.error('No se pudo registrar', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
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
      className={clsx('@container relative space-y-3 rounded-xl transition-shadow', dragOver && 'shadow-[0_0_0_2px_var(--color-pavonado)]', className)}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center rounded-xl bg-chapa/90 text-[15px] font-semibold">
          Soltá los archivos para adjuntarlos
        </div>
      )}
      <div
        role="radiogroup"
        aria-label="Tipo de contacto"
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(activityTypes.length, 1), 8)}, minmax(0, 1fr))` }}
      >
        {activityTypes.map((t) => {
          const Icon = ACTIVITY_ICON[t.code as SystemActivityType] ?? DEFAULT_ACTIVITY_ICON;
          const active = type === t.code;
          return (
            <button
              key={t.code}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t.label}
              title={t.label}
              onClick={() => setType(t.code)}
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
      <Field label={typeLabel ?? 'Qué pasó'}>
        {({ id }) => (
          <Input
            id={id}
            value={summary}
            maxLength={255}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={PLACEHOLDER[type as SystemActivityType] ?? (typeLabel ? `${typeLabel}: ¿qué pasó?` : '¿Qué pasó?')}
          />
        )}
      </Field>
      <div className={clsx('grid grid-cols-1 gap-3', contacts.length > 0 && '@[30rem]:grid-cols-2')}>
        {contacts.length > 0 && (
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
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
          <Field label="Fecha">
            {({ id }) => <DatePicker id={id} value={date} onChange={setDate} max={today} clearable={false} />}
          </Field>
          <Field label="Hora">
            {({ id }) => (
              <Input
                id={id}
                type="time"
                className="cifra px-2.5"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setTimeTouched(true);
                }}
              />
            )}
          </Field>
        </div>
      </div>

      <div className="rounded-[10px] border border-linea">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls={moreId}
          onClick={() => setMoreOpen((v) => !v)}
          className="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3.5 py-2 text-left text-sm font-semibold text-tinta hover:bg-chapa-2 cursor-pointer"
        >
          Más detalle
          <span className="font-normal text-tiza">{extraCount > 0 && !moreOpen ? `· ${extraCount === 2 ? 'descripción y resultado' : description.trim() ? 'descripción' : 'resultado'}` : '· descripción y resultado'}</span>
          <ChevronDown className={clsx('ml-auto w-4 h-4 shrink-0 text-tiza transition-transform', moreOpen && 'rotate-180')} aria-hidden />
        </button>
        {moreOpen && (
          <div id={moreId} className="space-y-3 border-t border-linea p-3.5">
            <Field label="Descripción">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  maxLength={4000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Lo que se habló, lo que viste en la obra, lo que pidió…"
                />
              )}
            </Field>
            <Field label="Resultado">
              {({ id }) => (
                <Input
                  id={id}
                  maxLength={1000}
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Ej.: acepta si se entrega el lunes; vuelvo a llamar el jueves"
                />
              )}
            </Field>
          </div>
        )}
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
  );
}
