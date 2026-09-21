'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { ContactForm } from '@/components/clients/ContactForm';
import { fetchCompanies, fetchContact } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(async () => {
    const [contact, companies] = await Promise.all([fetchContact(id), fetchCompanies()]);
    return { contact, companies };
  }, [id]);
  const { data, error, loading } = useLoad(load);
  const name = data ? `${data.contact.first_name} ${data.contact.last_name}` : 'Contacto';
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader back={{ href: `/contacts/${id}`, label: name }} title="Editar contacto" />
        {loading ? <LoadingBlock label="Cargando" /> : error || !data ? <EmptyState illustration="clientes" title="No encontramos el contacto" /> : <ContactForm contact={data.contact} companies={data.companies} />}
      </div>
    </AppLayout>
  );
}
