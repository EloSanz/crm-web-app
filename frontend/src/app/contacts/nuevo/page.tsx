'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/EmptyState';
import { ContactForm } from '@/components/clients/ContactForm';
import { fetchCompanies } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

export default function NewContactPage() {
  const { data, loading } = useLoad(fetchCompanies);
  const [query] = useState(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)));
  const presetCompanyId = query?.get('company_id') ?? null;
  const returnTo = query?.get('volver')?.startsWith('/') ? query.get('volver') : null;
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={returnTo ? { href: `${returnTo}?borrador=1`, label: 'Volver al presupuesto' } : { href: '/contacts', label: 'Clientes' }} title="Nuevo contacto" />
        {loading || !data ? <LoadingBlock label="Cargando" /> : <ContactForm companies={data} presetCompanyId={presetCompanyId} returnTo={returnTo} />}
      </div>
    </AppLayout>
  );
}
