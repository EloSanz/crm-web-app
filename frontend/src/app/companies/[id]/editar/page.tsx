'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { CompanyForm } from '@/components/clients/CompanyForm';
import { fetchCompany } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => fetchCompany(id), [id]);
  const { data, error, loading } = useLoad(load);
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={{ href: `/companies/${id}`, label: data?.name ?? 'Empresa' }} title="Editar empresa" />
        {loading ? <LoadingBlock label="Cargando" /> : error || !data ? <EmptyState illustration="clientes" title="No encontramos la empresa" /> : <CompanyForm company={data} />}
      </div>
    </AppLayout>
  );
}
