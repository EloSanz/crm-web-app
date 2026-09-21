'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { RequireRole } from '@/components/users/RequireRole';
import { UserForm } from '@/components/users/UserForm';

export default function NewUserPage() {
  return (
    <AppLayout>
      <RequireRole role="admin">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader back={{ href: '/usuarios', label: 'Usuarios' }} title="Nuevo usuario" />
          <UserForm />
        </div>
      </RequireRole>
    </AppLayout>
  );
}
