'use client';

import React, { useCallback } from 'react';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { fetchUsers } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { useCurrentUser } from '@/lib/useUser';
import { isManager } from '@/lib/roles';
import type { CrmUser } from '@/types/crm';

const ROLE_HINT: Record<string, string> = {
  ejecutivo_ventas: 'Vendedor',
  gerente_comercial: 'Responsable comercial',
  admin: 'Administrador',
};

/**
 * Responsable de un cliente (empresa o contacto). Sólo admin y responsable comercial lo asignan o
 * reasignan; el vendedor lo ve en solo lectura (lo que carga queda a su nombre).
 */
export function AssigneeField({
  value,
  onChange,
  creating,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  creating: boolean;
  className?: string;
}) {
  const me = useCurrentUser();
  const manager = isManager(me);
  const load = useCallback(() => fetchUsers().catch(() => [] as CrmUser[]), []);
  const { data: users } = useLoad(load);

  if (!manager) {
    const name = value ? (value === me?.id ? 'Vos' : users?.find((u) => u.id === value)?.full_name ?? 'Otro vendedor') : creating ? 'Vos' : 'Sin responsable';
    return (
      <Field label="Responsable" hint="Sólo el administrador o el responsable comercial lo cambian." className={className}>
        {({ id }) => (
          <p id={id} className="flex h-11 items-center text-[15px] font-medium">
            {name}
          </p>
        )}
      </Field>
    );
  }

  const options = [
    { value: '', label: 'Sin responsable', hint: 'Cartera libre: lo ven todos los vendedores' },
    ...(users ?? [])
      .filter((u) => u.is_active || u.id === value)
      .map((u) => ({ value: u.id, label: u.full_name, hint: ROLE_HINT[u.role] ?? u.role })),
  ];
  return (
    <Field label="Responsable" className={className}>
      {({ id }) => <Select id={id} value={value} onChange={onChange} options={options} placeholder="Sin responsable" />}
    </Field>
  );
}

/** Nombre del responsable para el detalle de un cliente. */
export function AssigneeName({ userId }: { userId?: string | null }) {
  const me = useCurrentUser();
  const load = useCallback(() => fetchUsers().catch(() => [] as CrmUser[]), []);
  const { data: users } = useLoad(load);
  if (!userId) return <span className="text-tiza">Sin responsable (cartera libre)</span>;
  const name = users?.find((u) => u.id === userId)?.full_name;
  return <>{userId === me?.id ? `${name ?? 'Vos'} (vos)` : name ?? '—'}</>;
}
