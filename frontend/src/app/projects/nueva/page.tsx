'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/EmptyState';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { fetchCompanies, fetchContacts } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

const load = async () => {
  const [companies, contacts] = await Promise.all([fetchCompanies(), fetchContacts()]);
  return { companies, contacts };
};

export default function NewProjectPage() {
  const { data, loading } = useLoad(load);
  const [query] = useState(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)));
  const returnTo = query?.get('volver')?.startsWith('/') ? query.get('volver') : null;
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={returnTo ? { href: `${returnTo}?borrador=1`, label: 'Volver al presupuesto' } : { href: '/projects', label: 'Obras' }} title="Nueva obra" />
        {loading || !data ? (
          <LoadingBlock label="Cargando" />
        ) : (
          <ProjectForm
            companies={data.companies}
            contacts={data.contacts}
            returnTo={returnTo}
            presetCompanyId={query?.get('company_id')}
            presetContactId={query?.get('contact_id')}
          />
        )}
      </div>
    </AppLayout>
  );
}
