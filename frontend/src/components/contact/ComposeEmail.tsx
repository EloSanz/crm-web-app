'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Loader2, Paperclip, Plus, Send, TableProperties, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatBytes } from '@/components/opportunities/AttachmentViewer';
import { fetchCompany, fetchCompanyContacts, fetchContact, fetchOpportunity, uploadAttachment } from '@/lib/api';
import { sendEmail } from '@/lib/api-comms';
import { useLoad } from '@/lib/useLoad';
import { formatARS, formatARSCents, formatQty, shortRef } from '@/lib/format';
import type { ActivityAttachment, Company, Contact, Opportunity } from '@/types/crm';
import { EmailChipsInput, isValidEmail } from './EmailChipsInput';
import { MailEditor, insertPresupuestoTabla, useMailEditor, type PresupuestoTablaData } from './MailEditor';
import { safeBackHref, useLeaveGuard } from './useLeaveGuard';

const MAX_MB = 10;
const MAX_FILES = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export interface ComposeParams {
  opportunityId?: string;
  contactId?: string;
  companyId?: string;
  to?: string;
  back?: string;
}

interface Loaded {
  opp: Opportunity | null;
  contact: Contact | null;
  company: Company | null;
  companyContacts: Contact[];
}

interface Pending {
  key: string;
  file: File;
  status: 'subiendo' | 'listo' | 'error';
  result?: ActivityAttachment;
}

const fullName = (c: Pick<Contact, 'first_name' | 'last_name'>) => `${c.first_name} ${c.last_name}`.trim();

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}

/** Tabla del presupuesto para el cuerpo del correo: materiales, cantidades, precios y total. */
function presupuestoData(opp: Opportunity): PresupuestoTablaData {
  const subtotal = opp.items.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
  const discount = Number((opp as { discount_pct?: number | null }).discount_pct ?? 0);
  const total = Number(opp.estimated_value || 0);
  const extras =
    discount > 0 && subtotal > total
      ? [
          { label: 'Subtotal', value: formatARS(subtotal) },
          { label: `Descuento ${discount.toLocaleString('es-AR')} %`, value: `− ${formatARS(subtotal - total)}` },
        ]
      : [];
  return {
    title: opp.title,
    reference: shortRef(opp.id),
    rows: opp.items.map((it) => ({
      material: it.product_name,
      cantidad: formatQty(it.quantity, it.unit),
      precio: formatARSCents(it.unit_price),
      subtotal: formatARS(it.subtotal),
    })),
    extras,
    total: formatARS(total),
  };
}

/** Redactar un correo al cliente, con formato y adjuntos, desde el presupuesto o la ficha. */
export function ComposeEmail(params: ComposeParams) {
  const { opportunityId, contactId, companyId } = params;
  const load = useCallback(async (): Promise<Loaded> => {
    const opp = opportunityId ? await fetchOpportunity(opportunityId).catch(() => null) : null;
    const cId = contactId || opp?.contact_id || null;
    const coId = companyId || opp?.company_id || null;
    const [contact, company, companyContacts] = await Promise.all([
      cId ? fetchContact(cId).catch(() => null) : Promise.resolve(null),
      coId ? fetchCompany(coId).catch(() => null) : Promise.resolve(null),
      coId ? fetchCompanyContacts(coId).catch(() => [] as Contact[]) : Promise.resolve([] as Contact[]),
    ]);
    return { opp, contact, company: company ?? null, companyContacts };
  }, [opportunityId, contactId, companyId]);
  const { data, loading } = useLoad(load);

  if (loading || !data) {
    return (
      <AppLayout>
        <LoadingBlock label="Preparando el correo" />
      </AppLayout>
    );
  }
  return <ComposeForm params={params} loaded={data} />;
}

function ComposeForm({ params, loaded }: { params: ComposeParams; loaded: Loaded }) {
  const router = useRouter();
  const toast = useToast();
  const { opp, contact, company, companyContacts } = loaded;

  const backHref = safeBackHref(
    params.back,
    opp ? `/opportunities/${opp.id}` : contact ? `/contacts/${contact.id}` : company ? `/companies/${company.id}` : '/opportunities'
  );
  const initialTo = useMemo(() => {
    const first = params.to || contact?.email;
    return first ? [first] : [];
  }, [params.to, contact?.email]);
  const initialSubject = opp ? `Presupuesto ${opp.title} · Corralap` : '';
  const initialHtml = contact?.first_name ? `<p>Hola ${escapeHtml(contact.first_name)},</p><p></p>` : '';

  const [to, setTo] = useState<string[]>(initialTo);
  const [cc, setCc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState({ html: initialHtml, empty: !initialHtml });
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tried, setTried] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onBodyChange = useCallback((html: string, empty: boolean) => setBody({ html, empty }), []);
  const editor = useMailEditor(initialHtml, onBodyChange);

  // Destinatarios sugeridos: el contacto, los otros contactos de la empresa y el correo de la empresa.
  const suggestions = useMemo(() => {
    const list: { email: string; label: string }[] = [];
    const push = (email: string | null | undefined, label: string) => {
      if (email && !list.some((s) => s.email.toLowerCase() === email.toLowerCase())) list.push({ email, label });
    };
    if (contact) push(contact.email, fullName(contact));
    companyContacts.forEach((c) => push(c.email, fullName(c)));
    if (company) push(company.email, company.name);
    const used = new Set([...to, ...cc].map((e) => e.toLowerCase()));
    return list.filter((s) => !used.has(s.email.toLowerCase()));
  }, [contact, companyContacts, company, to, cc]);

  const uploading = pending.some((p) => p.status === 'subiendo');
  const ready = pending.filter((p) => p.status === 'listo' && p.result).map((p) => p.result as ActivityAttachment);
  const invalidTo = to.filter((e) => !isValidEmail(e));
  const invalidCc = cc.filter((e) => !isValidEmail(e));
  const toError = to.length === 0 ? 'Agregá al menos un destinatario' : invalidTo.length ? 'Revisá los correos marcados' : undefined;
  const ccError = invalidCc.length ? 'Revisá los correos marcados' : undefined;
  const subjectError = subject.trim() ? undefined : 'Escribí un asunto';
  const bodyError = body.empty && ready.length === 0 ? 'Escribí el mensaje o adjuntá un archivo' : undefined;

  const dirty =
    !sent &&
    (to.join(',') !== initialTo.join(',') || cc.length > 0 || subject !== initialSubject || body.html !== initialHtml || pending.length > 0);
  const guard = useLeaveGuard(dirty);

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    let slots = MAX_FILES - pending.length;
    for (const file of files) {
      if (slots <= 0) {
        toast.warning('Demasiados adjuntos', `Hasta ${MAX_FILES} archivos por correo.`);
        break;
      }
      if (!ACCEPT.split(',').includes(file.type)) {
        toast.warning('Formato no admitido', `${file.name}: subí fotos (JPG, PNG, WEBP) o PDF.`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.warning('Archivo muy pesado', `${file.name} supera ${MAX_MB} MB.`);
        continue;
      }
      slots -= 1;
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

  const insertDetail = () => {
    if (!editor || !opp) return;
    insertPresupuestoTabla(editor, presupuestoData(opp));
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTried(true);
    if (sending || uploading || toError || ccError || subjectError || bodyError || !editor) return;
    setSending(true);
    try {
      const msg = await sendEmail({
        to,
        cc,
        subject: subject.trim(),
        html: body.empty ? '' : editor.getHTML(),
        attachments: ready,
        opportunity_id: opp?.id ?? null,
        contact_id: contact?.id ?? null,
        company_id: company?.id ?? null,
      });
      setSent(true);
      if (msg.status === 'simulado') toast.info('Correo simulado', 'Falta configurar el proveedor de correo. Quedó en el seguimiento.');
      else toast.success('Correo enviado', to.join(', '));
      if (msg.warnings?.length) toast.warning('Algunos adjuntos no se enviaron', msg.warnings.join(' · '));
      router.push(backHref);
    } catch (err) {
      toast.error('No se pudo enviar', err instanceof Error ? err.message : undefined);
      setSending(false);
    }
  };

  const clientName = contact ? fullName(contact) : company?.name;

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader back={{ href: backHref, label: opp?.title || clientName || 'Volver' }} title="Nuevo correo" />

        <form
          noValidate
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
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
          className="space-y-6"
        >
          <div
            className={clsx(
              'relative space-y-5 rounded-2xl border border-linea bg-chapa p-4 shadow-suave transition-shadow sm:p-6',
              dragOver && 'shadow-[0_0_0_2px_var(--color-pavonado)]'
            )}
          >
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center rounded-2xl bg-chapa/90 text-[15px] font-semibold">
                Soltá los archivos para adjuntarlos
              </div>
            )}

            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="correo-para" className="text-sm font-semibold text-tinta">
                  Para
                </label>
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)} className="rounded-md px-1.5 py-0.5 text-sm font-semibold text-tiza hover:bg-chapa-2 hover:text-tinta cursor-pointer">
                    CC
                  </button>
                )}
              </div>
              <EmailChipsInput
                id="correo-para"
                value={to}
                onChange={setTo}
                placeholder="correo@cliente.com"
                describedBy={tried && toError ? 'correo-para-error' : undefined}
                invalid={Boolean((tried && toError) || invalidTo.length)}
              />
              {tried && toError && (
                <p id="correo-para-error" className="mt-1.5 text-[13px] font-semibold text-rojo-tinta">
                  {toError}
                </p>
              )}
              {suggestions.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Destinatarios sugeridos">
                  {suggestions.map((s) => (
                    <li key={s.email} className="min-w-0 max-w-full">
                      <button
                        type="button"
                        onClick={() => setTo((prev) => [...prev, s.email])}
                        className="flex h-8 max-w-full items-center gap-1.5 rounded-full border border-dashed border-linea-fuerte px-2.5 text-[13px] text-tinta transition-colors hover:border-tiza hover:bg-chapa-2 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0 text-tiza" aria-hidden />
                        <span className="shrink-0 font-semibold">{s.label}</span>
                        <span className="min-w-0 truncate text-tiza">{s.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {showCc && (
              <Field label="CC" error={ccError}>
                {({ id, describedBy }) => (
                  <EmailChipsInput id={id} value={cc} onChange={setCc} describedBy={describedBy} invalid={Boolean(ccError)} placeholder="correo@cliente.com" />
                )}
              </Field>
            )}

            <Field label="Asunto" error={tried ? subjectError : undefined}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} maxLength={255} />
              )}
            </Field>

            <div className="min-w-0">
              <MailEditor editor={editor} />
              {tried && bodyError && <p className="mt-1.5 text-[13px] font-semibold text-rojo-tinta">{bodyError}</p>}
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
                    {p.status === 'subiendo' ? (
                      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" aria-label="Subiendo" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 max-w-[200px] truncate font-medium">{p.file.name}</span>
                    <span className="shrink-0 text-tiza">{p.status === 'error' ? 'falló' : p.status === 'subiendo' ? 'subiendo…' : formatBytes(p.file.size)}</span>
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

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button variant="secundario" onClick={() => fileRef.current?.click()}>
                <Paperclip className="w-4 h-4" aria-hidden />
                Adjuntar
              </Button>
              {opp && opp.items.length > 0 && (
                <Button variant="secundario" onMouseDown={(e) => e.preventDefault()} onClick={insertDetail} disabled={!editor}>
                  <TableProperties className="w-4 h-4" aria-hidden />
                  Insertar detalle del presupuesto
                </Button>
              )}
            </div>
          </div>

          <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-4 flex justify-end gap-2 border-t border-linea bg-suelo/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
            <ButtonLink href={backHref} variant="fantasma">
              Descartar
            </ButtonLink>
            <Button type="submit" isLoading={sending} disabled={uploading}>
              {!sending && <Send className="w-4 h-4" aria-hidden />}
              {uploading ? 'Subiendo…' : 'Enviar'}
            </Button>
          </div>
        </form>
      </div>

      {guard.pendingHref && (
        <ConfirmDialog
          title="¿Descartar el correo?"
          description="Se pierde lo que escribiste."
          confirmLabel="Descartar"
          onCancel={guard.cancel}
          onConfirm={() => {
            const href = guard.pendingHref as string;
            setSent(true);
            guard.cancel();
            router.push(href);
          }}
        />
      )}
    </AppLayout>
  );
}
