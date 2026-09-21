'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Company, Contact, Project, ProjectFormData, ProjectStatus, ProjectType } from '@/types/crm';
import { createProject, updateProject } from '@/lib/api';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { FormActions, FormCard } from '@/components/ui/FormActions';
import { useToast } from '@/components/ui/Toast';
import { PROJECT_STATUS, PROJECT_TYPES } from '@/lib/catalogs';

const STATUS_ORDER: ProjectStatus[] = ['en_curso', 'planificacion', 'frenada', 'finalizada'];

interface ProjectFormProps {
  project?: Project | null;
  companies: Company[];
  contacts: Contact[];
  /** Si viene desde un presupuesto en armado, vuelve ahí con la obra nueva elegida. */
  returnTo?: string | null;
  presetCompanyId?: string | null;
  presetContactId?: string | null;
}

export function ProjectForm({ project, companies, contacts, returnTo, presetCompanyId, presetContactId }: ProjectFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});
  const [data, setData] = useState<ProjectFormData>({
    name: project?.name ?? '',
    company_id: project?.company_id ?? presetCompanyId ?? null,
    contact_id: project?.contact_id ?? presetContactId ?? null,
    address: project?.address ?? '',
    project_type: project?.project_type ?? 'vivienda_unifamiliar',
    status: project?.status ?? 'en_curso',
    observations: project?.observations ?? '',
  });
  const set = <K extends keyof ProjectFormData>(k: K, v: ProjectFormData[K]) => setData((d) => ({ ...d, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { name: data.name.trim() ? undefined : 'Poné un nombre', address: data.address.trim() ? undefined : 'Falta la dirección' };
    setErrors(next);
    if (next.name || next.address) return;
    setSaving(true);
    try {
      const saved = project ? await updateProject(project.id, data) : await createProject(data);
      toast.success(project ? 'Cambios guardados' : 'Obra registrada', data.name);
      router.push(returnTo && !project ? `${returnTo}?borrador=1&nueva_obra=${saved.id}` : '/projects');
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormCard>
        <Field label="Nombre de la obra" required error={errors.name} className="sm:col-span-2">
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="Torre Belgrano 450" />}
        </Field>
        <Field label="Dirección de descarga" required error={errors.address} className="sm:col-span-2">
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={data.address} onChange={(e) => set('address', e.target.value)} placeholder="Av. Rivadavia 12300, Ramos Mejía" />}
        </Field>
        <Field label="Empresa">
          {({ id }) => (
            <Select
              id={id}
              value={data.company_id || ''}
              onChange={(v) => set('company_id', v || null)}
              searchable
              options={[{ value: '', label: 'Particular (sin empresa)' }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
            />
          )}
        </Field>
        <Field label="Responsable en obra">
          {({ id }) => (
            <Select
              id={id}
              value={data.contact_id || ''}
              onChange={(v) => set('contact_id', v || null)}
              searchable
              options={[{ value: '', label: 'Sin responsable' }, ...contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}`, hint: c.company_name || undefined }))]}
            />
          )}
        </Field>
        <Field label="Tipo">
          {({ id }) => (
            <Select
              id={id}
              value={data.project_type}
              onChange={(v) => set('project_type', v as ProjectType)}
              options={(Object.keys(PROJECT_TYPES) as ProjectType[]).map((t) => ({ value: t, label: PROJECT_TYPES[t] }))}
            />
          )}
        </Field>
        <Field label="Estado">
          {({ id }) => (
            <Select id={id} value={data.status} onChange={(v) => set('status', v as ProjectStatus)} options={STATUS_ORDER.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))} />
          )}
        </Field>
        <Field label="Para la descarga" className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={3} value={data.observations || ''} onChange={(e) => set('observations', e.target.value)} placeholder="Hidrogrúa, horario, acceso" />}
        </Field>
      </FormCard>
      <FormActions
        cancelHref={returnTo && !project ? `${returnTo}?borrador=1` : '/projects'}
        submitLabel={project ? 'Guardar cambios' : returnTo ? 'Registrar y volver al presupuesto' : 'Registrar obra'}
        saving={saving}
      />
    </form>
  );
}
