'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CrmRole, CrmUser, CrmUserFormData } from '@/types/crm';
import { createUser, updateUser } from '@/lib/api';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { FormActions, FormCard } from '@/components/ui/FormActions';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { ROLE_OPTIONS } from '@/lib/catalogs';

export function UserForm({ user }: { user?: CrmUser | null }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; name?: string }>({});
  const [data, setData] = useState<CrmUserFormData>({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    role: user?.role ?? 'ejecutivo_ventas',
    is_active: user?.is_active ?? true,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      name: data.full_name.trim().length >= 2 ? undefined : 'Poné nombre y apellido',
      email: /^\S+@\S+\.\S+$/.test(data.email) ? undefined : 'Ingresá un correo válido',
    };
    setErrors(next);
    if (next.name || next.email) return;
    setSaving(true);
    try {
      if (user) await updateUser(user.id, data);
      else await createUser(data);
      toast.success(user ? 'Usuario actualizado' : 'Usuario creado', data.full_name);
      router.push('/usuarios');
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormCard>
        <Field label="Nombre y apellido" required error={errors.name} className="sm:col-span-2">
          {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={data.full_name} onChange={(e) => setData({ ...data, full_name: e.target.value })} placeholder="María Gómez" />}
        </Field>
        <Field label="Correo" required error={errors.email}>
          {({ id, invalid }) => (
            <Input id={id} type="email" aria-invalid={invalid} value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="maria@corralon.com" />
          )}
        </Field>
        <Field label="Rol">
          {({ id }) => (
            <Select id={id} value={data.role} onChange={(v) => setData({ ...data, role: v as CrmRole })} options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold">Estado</p>
          <Switch checked={data.is_active} onChange={(v) => setData({ ...data, is_active: v })} label={data.is_active ? 'Activo' : 'Dado de baja'} />
        </div>
      </FormCard>
      <FormActions cancelHref="/usuarios" submitLabel={user ? 'Guardar cambios' : 'Crear usuario'} saving={saving} />
    </form>
  );
}
