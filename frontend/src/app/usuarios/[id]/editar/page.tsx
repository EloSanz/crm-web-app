'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { RequireRole } from '@/components/users/RequireRole';
import { UserForm } from '@/components/users/UserForm';
import { fetchUser } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => fetchUser(id), [id]);
  const { data, error, loading } = useLoad(load);
  return (
    <AppLayout>
      <RequireRole role="admin">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader back={{ href: '/usuarios', label: 'Usuarios' }} title={data?.full_name ?? 'Editar usuario'} />
          {loading ? <LoadingBlock label="Cargando" /> : error || !data ? <EmptyState illustration="clientes" title="No encontramos el usuario" /> : <UserForm user={data} />}
        </div>
      </RequireRole>
    </AppLayout>
  );
}
