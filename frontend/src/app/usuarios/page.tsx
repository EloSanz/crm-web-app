'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Chip } from '@/components/ui/Chip';
import { Menu } from '@/components/ui/Menu';
import { DataTable, type TableSetup } from '@/components/ui/DataTable';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { RequireRole } from '@/components/users/RequireRole';
import type { CrmUser } from '@/types/crm';
import { fetchUsers, updateUser } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { useCurrentUser } from '@/lib/useUser';
import { ROLE_LABELS } from '@/lib/catalogs';
import { formatDate, initials } from '@/lib/format';

const helper = createColumnHelper<TableSetup, CrmUser>();
const ROLE_TONE = { admin: 'tinta', gerente_comercial: 'tinta', ejecutivo_ventas: 'neutro' } as const;

export default function UsersPage() {
  return (
    <AppLayout>
      <RequireRole role="admin">
        <UsersList />
      </RequireRole>
    </AppLayout>
  );
}

function UsersList() {
  const router = useRouter();
  const toast = useToast();
  const me = useCurrentUser();
  const { data, error, loading, reload } = useLoad(fetchUsers);
  const [search, setSearch] = useState('');

  const toggle = async (u: CrmUser) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? 'Usuario dado de baja' : 'Usuario reactivado', u.full_name);
      await reload();
    } catch (err) {
      toast.error('No se pudo actualizar', err instanceof Error ? err.message : undefined);
    }
  };

  const users = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((u) => !q || `${u.full_name} ${u.email}`.toLowerCase().includes(q));
  }, [data, search]);

  const actions = (u: CrmUser) => (
    <Menu
      label={`Acciones de ${u.full_name}`}
      items={[
        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onSelect: () => router.push(`/usuarios/${u.id}/editar`) },
        ...(u.id === me?.id
          ? []
          : [
              u.is_active
                ? { label: 'Dar de baja', icon: <UserX className="w-4 h-4" />, tone: 'peligro' as const, onSelect: () => toggle(u) }
                : { label: 'Reactivar', icon: <UserCheck className="w-4 h-4" />, onSelect: () => toggle(u) },
            ]),
      ]}
    />
  );

  const columns = helper.columns([
    helper.accessor('full_name', {
      header: 'Usuario',
      sortFn: 'text',
      cell: (info) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full bg-pavonado text-[13px] font-bold text-white">{initials(info.getValue())}</span>
          <div className="min-w-0">
            <p className="truncate font-bold">{info.getValue()}</p>
            <p className="truncate text-sm text-tiza">{info.row.original.email}</p>
          </div>
        </div>
      ),
    }),
    helper.accessor((u) => ROLE_LABELS[u.role] ?? u.role, {
      id: 'rol',
      header: 'Rol',
      sortFn: 'text',
      cell: (info) => <Chip tone={ROLE_TONE[info.row.original.role] ?? 'neutro'}>{info.getValue()}</Chip>,
    }),
    helper.accessor((u) => (u.is_active ? 1 : 0), {
      id: 'estado',
      header: 'Estado',
      sortFn: 'basic',
      cell: (info) => <Chip tone={info.row.original.is_active ? 'fuerte' : 'neutro'}>{info.row.original.is_active ? 'Activo' : 'De baja'}</Chip>,
    }),
    helper.accessor((u) => u.created_at ?? '', {
      id: 'alta',
      header: 'Alta',
      sortFn: 'text',
      cell: (info) => <span className="whitespace-nowrap text-sm text-tiza">{info.getValue() ? formatDate(info.getValue()) : '—'}</span>,
    }),
    helper.display({ id: 'acciones', header: '', cell: (info) => <div className="flex justify-end">{actions(info.row.original)}</div> }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        actions={
          <ButtonLink href="/usuarios/nuevo" size="lg">
            <Plus className="w-5 h-5" aria-hidden />
            Nuevo usuario
          </ButtonLink>
        }
      />
      <SearchInput icon={<Search className="w-4.5 h-4.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios" />
      {loading ? (
        <LoadingBlock label="Cargando usuarios" />
      ) : error ? (
        <EmptyState illustration="clientes" title="No pudimos cargar los usuarios" description={error} action={<Button variant="secundario" onClick={() => reload()}>Reintentar</Button>} />
      ) : users.length === 0 ? (
        <EmptyState illustration="clientes" title="Sin resultados" />
      ) : (
        <>
          <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave xl:hidden">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-pavonado text-sm font-bold text-white">{initials(u.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-bold leading-snug">{u.full_name}</p>
                  <p className="truncate text-sm text-tiza">
                    {ROLE_LABELS[u.role]} · {u.is_active ? 'Activo' : 'De baja'}
                  </p>
                </div>
                {actions(u)}
              </li>
            ))}
          </ul>
          <div className="hidden xl:block">
            <DataTable data={users} columns={columns} caption="Usuarios del CRM" initialSort={[{ id: 'full_name', desc: false }]} />
          </div>
        </>
      )}
    </div>
  );
}
