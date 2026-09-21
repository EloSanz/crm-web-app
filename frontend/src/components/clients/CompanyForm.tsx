'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Company, CompanyFormData, CompanyStatus } from '@/types/crm';
import { createCompany, updateCompany } from '@/lib/api';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { FormActions, FormCard } from '@/components/ui/FormActions';
import { useToast } from '@/components/ui/Toast';
import { CLIENT_STATUS, ORIGIN_OPTIONS } from '@/lib/catalogs';

const STATUS_OPTIONS = (Object.keys(CLIENT_STATUS) as CompanyStatus[]).map((s) => ({ value: s, label: CLIENT_STATUS[s].label }));
const ORIGINS = ORIGIN_OPTIONS.map((o) => ({ value: o, label: o }));

export function CompanyForm({ company }: { company?: Company | null }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompanyFormData>({
    name: company?.name ?? '',
    cuit: company?.cuit ?? '',
    industry: company?.industry ?? '',
    email: company?.email ?? '',
    phone: company?.phone ?? '',
    address: company?.address ?? '',
    website: company?.website ?? '',
    status: company?.status ?? 'potencial',
    origin: company?.origin ?? ORIGIN_OPTIONS[0],
    notes: company?.notes ?? '',
  });
  const set = <K extends keyof CompanyFormData>(k: K, v: CompanyFormData[K]) => setData((d) => ({ ...d, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) return setError('Poné la razón social');
    setSaving(true);
    try {
      const saved = company ? await updateCompany(company.id, data) : await createCompany(data);
      toast.success(company ? 'Cambios guardados' : 'Empresa registrada', data.name);
      router.push(`/companies/${saved.id ?? company?.id}`);
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormCard>
        <Field label="Razón social" required error={error ?? undefined} className="sm:col-span-2">
          {({ id, invalid }) => (
            <Input id={id} aria-invalid={invalid} value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="Construcciones del Oeste SRL" />
          )}
        </Field>
        <Field label="CUIT">
          {({ id }) => <Input id={id} className="cifra" value={data.cuit || ''} onChange={(e) => set('cuit', e.target.value)} placeholder="30-12345678-9" />}
        </Field>
        <Field label="Rubro">
          {({ id }) => <Input id={id} value={data.industry || ''} onChange={(e) => set('industry', e.target.value)} placeholder="Estructuras, viviendas" />}
        </Field>
        <Field label="Teléfono">
          {({ id }) => <Input id={id} type="tel" inputMode="tel" value={data.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="+54 11 4455-6677" />}
        </Field>
        <Field label="Correo">
          {({ id }) => <Input id={id} type="email" value={data.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="compras@empresa.com" />}
        </Field>
        <Field label="Dirección" className="sm:col-span-2">
          {({ id }) => <Input id={id} value={data.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Av. Rivadavia 1200, Morón" />}
        </Field>
        <Field label="Estado">
          {({ id }) => <Select id={id} value={data.status} onChange={(v) => set('status', v as CompanyStatus)} options={STATUS_OPTIONS} />}
        </Field>
        <Field label="Origen">
          {({ id }) => <Select id={id} value={data.origin || ''} onChange={(v) => set('origin', v)} options={ORIGINS} />}
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={3} value={data.notes || ''} onChange={(e) => set('notes', e.target.value)} />}
        </Field>
      </FormCard>
      <FormActions cancelHref={company ? `/companies/${company.id}` : '/companies'} submitLabel={company ? 'Guardar cambios' : 'Registrar empresa'} saving={saving} />
    </form>
  );
}
