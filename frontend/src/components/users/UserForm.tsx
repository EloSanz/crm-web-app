'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import type { CrmRole, CrmUser, CrmUserFormData } from '@/types/crm';
import { createUser, resetUserPassword, updateUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { FormActions, FormCard } from '@/components/ui/FormActions';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { ROLE_OPTIONS } from '@/lib/catalogs';

const MIN_PASSWORD = 8;

/** Reglas mínimas de la contraseña (el backend valida lo mismo). */
function passwordErrors(password: string, confirm: string): { password?: string; confirm?: string } {
  return {
    password: password.length >= MIN_PASSWORD ? undefined : `Tiene que tener al menos ${MIN_PASSWORD} caracteres`,
    confirm: confirm === password ? undefined : 'Las contraseñas no coinciden',
  };
}

export function UserForm({ user }: { user?: CrmUser | null }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; name?: string; password?: string; confirm?: string }>({});
  const [data, setData] = useState<CrmUserFormData>({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    role: user?.role ?? 'ejecutivo_ventas',
    is_active: user?.is_active ?? true,
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      name: data.full_name.trim().length >= 2 ? undefined : 'Poné nombre y apellido',
      email: /^\S+@\S+\.\S+$/.test(data.email) ? undefined : 'Ingresá un correo válido',
      ...(user ? {} : passwordErrors(password, confirm)),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    try {
      if (user) await updateUser(user.id, data);
      else await createUser({ ...data, password });
      toast.success(user ? 'Usuario actualizado' : 'Usuario creado', data.full_name);
      router.push('/usuarios');
    } catch (err) {
      toast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
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
          {!user && (
            <>
              <Field label="Contraseña inicial" required hint={`Mínimo ${MIN_PASSWORD} caracteres. Pasásela al usuario por un canal privado.`} error={errors.password}>
                {({ id, invalid, describedBy }) => (
                  <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} aria-describedby={describedBy} value={password} onChange={(e) => setPassword(e.target.value)} />
                )}
              </Field>
              <Field label="Repetí la contraseña" required error={errors.confirm}>
                {({ id, invalid, describedBy }) => (
                  <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} aria-describedby={describedBy} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                )}
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-semibold">Estado</p>
            <Switch checked={data.is_active} onChange={(v) => setData({ ...data, is_active: v })} label={data.is_active ? 'Activo' : 'Dado de baja'} />
          </div>
        </FormCard>
        <FormActions cancelHref="/usuarios" submitLabel={user ? 'Guardar cambios' : 'Crear usuario'} saving={saving} />
      </form>
      {user && <ResetPassword user={user} />}
    </div>
  );
}

/** Sección aparte (otro formulario) para que el administrador defina una contraseña nueva. */
function ResetPassword({ user }: { user: CrmUser }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = passwordErrors(password, confirm);
    setErrors(next);
    if (next.password || next.confirm) return;
    setSaving(true);
    try {
      await resetUserPassword(user.id, password);
      toast.success('Contraseña restablecida', `${user.full_name} ya puede entrar con la contraseña nueva.`);
      setPassword('');
      setConfirm('');
    } catch (err) {
      toast.error('No se pudo cambiar la contraseña', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="restablecer-titulo" className="space-y-4 rounded-2xl border border-linea bg-chapa p-5 shadow-suave sm:p-6">
      <div>
        <h2 id="restablecer-titulo" className="titular text-lg">
          Restablecer contraseña
        </h2>
        <p className="mt-1 text-sm text-tiza">La contraseña actual deja de valer. Pasale la nueva al usuario por un canal privado.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Contraseña nueva" required hint={`Mínimo ${MIN_PASSWORD} caracteres.`} error={errors.password}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} aria-describedby={describedBy} value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Field label="Repetí la contraseña" required error={errors.confirm}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} type="password" autoComplete="new-password" aria-invalid={invalid} aria-describedby={describedBy} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          )}
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secundario" isLoading={saving}>
          <KeyRound className="w-4 h-4" aria-hidden />
          Restablecer contraseña
        </Button>
      </div>
    </form>
  );
}
