'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Company, Contact, ContactFormData, ContactStatus } from '@/types/crm';
import { createContact, updateContact } from '@/lib/api';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { FormActions, FormCard } from '@/components/ui/FormActions';
import { useToast } from '@/components/ui/Toast';
import { ReturnToQuoteDialog } from '@/components/opportunities/ReturnToQuoteDialog';
import { CLIENT_STATUS, CONTACT_ROLES, ORIGIN_OPTIONS } from '@/lib/catalogs';

const STATUS_OPTIONS = (Object.keys(CLIENT_STATUS) as ContactStatus[]).map((s) => ({ value: s, label: CLIENT_STATUS[s].label }));
const ORIGINS = ORIGIN_OPTIONS.map((o) => ({ value: o, label: o }));

interface ContactFormProps {
  contact?: Contact | null;
  companies: Company[];
  presetCompanyId?: string | null;
  /** Si viene desde un presupuesto en armado, vuelve ahí con el contacto nuevo elegido. */
  returnTo?: string | null;
}

export function ContactForm({ contact, companies, presetCompanyId, returnTo }: ContactFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ first?: string; last?: string; dni?: string; phone?: string; email?: string }>({});
  const [created, setCreated] = useState<Contact | null>(null);
  const [data, setData] = useState<ContactFormData>({
    first_name: contact?.first_name ?? '',
    last_name: contact?.last_name ?? '',
    company_id: contact?.company_id ?? presetCompanyId ?? '',
    job_title: contact?.job_title ?? CONTACT_ROLES[0],
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    document_number: contact?.document_number ?? '',
    status: contact?.status ?? 'potencial',
    origin: contact?.origin ?? ORIGIN_OPTIONS[0],
    notes: contact?.notes ?? '',
  });
  const set = <K extends keyof ContactFormData>(k: K, v: ContactFormData[K]) => setData((d) => ({ ...d, [k]: v }));
  const roleOptions = Array.from(new Set([...CONTACT_ROLES, data.job_title || ''])).filter(Boolean).map((r) => ({ value: r, label: r }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { first: data.first_name.trim() ? undefined : 'Falta el nombre', last: data.last_name.trim() ? undefined : 'Falta el apellido' };
    setErrors(next);
    if (next.first || next.last) return;
    setSaving(true);
    const payload = { ...data, company_id: data.company_id || undefined };
    const fullName = `${data.first_name} ${data.last_name}`;
    try {
      const saved = contact ? await updateContact(contact.id, payload) : await createContact(payload);
      toast.success(contact ? 'Cambios guardados' : 'Contacto registrado', fullName);
      // Vino desde un presupuesto a medio armar: preguntar si vuelve (con el contacto nuevo elegido).
      if (returnTo && !contact) {
        setCreated(saved);
        return;
      }
      router.push(`/contacts/${saved.id ?? contact?.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      // El backend rechaza DNI, teléfono o correo repetidos: se marca el campo.
      const field = message.startsWith('DNI') ? 'dni' : message.startsWith('Teléfono') ? 'phone' : message.startsWith('Correo') ? 'email' : null;
      if (field) setErrors((prev) => ({ ...prev, [field]: message }));
      else toast.error('No se pudo guardar', message || undefined);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormCard>
        <Field label="Nombre" required error={errors.first}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={data.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Juan" />}
        </Field>
        <Field label="Apellido" required error={errors.last}>
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={data.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Pérez" />}
        </Field>
        <Field label="Empresa">
          {({ id }) => (
            <Select
              id={id}
              value={data.company_id || ''}
              onChange={(v) => set('company_id', v)}
              searchable
              options={[{ value: '', label: 'Particular (sin empresa)' }, ...companies.map((c) => ({ value: c.id, label: c.name, hint: c.cuit || undefined }))]}
            />
          )}
        </Field>
        <Field label="Cargo">
          {({ id }) => <Select id={id} value={data.job_title || ''} onChange={(v) => set('job_title', v)} options={roleOptions} />}
        </Field>
        <Field label="Celular" error={errors.phone}>
          {({ id, invalid }) => (
            <Input
              id={id}
              aria-invalid={invalid}
              type="tel"
              inputMode="tel"
              value={data.phone || ''}
              onChange={(e) => {
                set('phone', e.target.value);
                setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              placeholder="+54 9 11 5566-7788"
            />
          )}
        </Field>
        <Field label="Correo" error={errors.email}>
          {({ id, invalid }) => (
            <Input
              id={id}
              aria-invalid={invalid}
              type="email"
              value={data.email || ''}
              onChange={(e) => {
                set('email', e.target.value);
                setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="juan@obras.com"
            />
          )}
        </Field>
        <Field label="DNI" error={errors.dni}>
          {({ id, invalid }) => (
            <Input
              id={id}
              aria-invalid={invalid}
              inputMode="numeric"
              className="cifra"
              value={data.document_number || ''}
              onChange={(e) => {
                set('document_number', e.target.value);
                setErrors((prev) => ({ ...prev, dni: undefined }));
              }}
              placeholder="32.123.456"
            />
          )}
        </Field>
        <Field label="Estado">
          {({ id }) => <Select id={id} value={data.status} onChange={(v) => set('status', v as ContactStatus)} options={STATUS_OPTIONS} />}
        </Field>
        <Field label="Origen" className="sm:col-span-2">
          {({ id }) => <Select id={id} value={data.origin || ''} onChange={(v) => set('origin', v)} options={ORIGINS} />}
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={3} value={data.notes || ''} onChange={(e) => set('notes', e.target.value)} />}
        </Field>
      </FormCard>
      <FormActions
        cancelHref={contact ? `/contacts/${contact.id}` : returnTo ? `${returnTo}?borrador=1` : '/contacts'}
        submitLabel={contact ? 'Guardar cambios' : returnTo ? 'Registrar y volver al presupuesto' : 'Registrar contacto'}
        saving={saving}
      />
      {created && returnTo && (
        <ReturnToQuoteDialog
          what="contacto"
          name={`${created.first_name} ${created.last_name}`}
          onBack={() => router.push(`${returnTo}?borrador=1&nuevo_contacto=${created.id}`)}
          onStay={() => router.push(`/contacts/${created.id}`)}
        />
      )}
    </form>
  );
}
