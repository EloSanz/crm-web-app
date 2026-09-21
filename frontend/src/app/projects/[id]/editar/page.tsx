'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { fetchCompanies, fetchContacts, fetchProject } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(async () => {
    const [project, companies, contacts] = await Promise.all([fetchProject(id), fetchCompanies(), fetchContacts()]);
    return { project, companies, contacts };
  }, [id]);
  const { data, error, loading } = useLoad(load);
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={{ href: '/projects', label: 'Obras' }} title={data?.project.name ?? 'Editar obra'} />
        {loading ? (
          <LoadingBlock label="Cargando" />
        ) : error || !data ? (
          <EmptyState illustration="obra" title="No encontramos la obra" />
        ) : (
          <ProjectForm project={data.project} companies={data.companies} contacts={data.contacts} />
        )}
      </div>
    </AppLayout>
  );
}
