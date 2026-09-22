'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContactMenu } from '@/components/contact/ContactMenu';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { DetailSection, InfoRow, OpportunityMiniList } from '@/components/clients/DetailBits';
import { fetchContact, fetchOpportunities } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { CLIENT_STATUS } from '@/lib/catalogs';
import { formatDate, telHref } from '@/lib/format';

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(async () => {
    const [contact, opportunities] = await Promise.all([fetchContact(id), fetchOpportunities({ contact_id: id }).catch(() => [])]);
    return { contact, opportunities: opportunities.filter((o) => o.contact_id === id) };
  }, [id]);
  const { data, error, loading } = useLoad(load);

  if (loading) return <AppLayout><LoadingBlock label="Cargando contacto" rows={4} /></AppLayout>;
  if (error || !data)
    return (
      <AppLayout>
        <EmptyState illustration="clientes" title="No encontramos el contacto" action={<ButtonLink href="/contacts" variant="secundario">Volver</ButtonLink>} />
      </AppLayout>
    );

  const { contact: c, opportunities } = data;
  const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.potencial;
  const tel = telHref(c.phone);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/contacts', label: 'Clientes' }}
          meta={
            <>
              <Chip tone={st.tone}>{st.label}</Chip>
              {c.job_title && <span className="text-sm font-semibold text-tiza">{c.job_title}</span>}
            </>
          }
          title={`${c.first_name} ${c.last_name}`}
          actions={
            <>
              <ContactMenu contact={c} />
              <ButtonLink href={`/contacts/${c.id}/editar`} variant="secundario">
                <Pencil className="w-4 h-4" aria-hidden />
                Editar
              </ButtonLink>
              <ButtonLink href={`/opportunities/nuevo?contact_id=${c.id}`}>
                <Plus className="w-4 h-4" aria-hidden />
                Presupuesto
              </ButtonLink>
            </>
          }
        />
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <DetailSection title="Datos">
            <dl className="divide-y divide-linea">
              <InfoRow label="Empresa">
                {c.company_id ? (
                  <Link href={`/companies/${c.company_id}`} className="font-semibold underline decoration-linea-fuerte hover:decoration-tinta">
                    {c.company_name || 'Ver empresa'}
                  </Link>
                ) : (
                  'Particular'
                )}
              </InfoRow>
              <InfoRow label="Cargo">{c.job_title || <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Celular">{c.phone ? tel ? <a href={tel} className="font-semibold hover:underline">{c.phone}</a> : c.phone : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Correo">{c.email ? <a href={`mailto:${c.email}`} className="break-all hover:underline">{c.email}</a> : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="DNI">{c.document_number ? <span className="cifra">{c.document_number}</span> : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Origen">{c.origin || <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Notas">{c.notes ? <span className="whitespace-pre-line">{c.notes}</span> : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Alta">{formatDate(c.created_at)}</InfoRow>
            </dl>
          </DetailSection>
          <DetailSection title="Presupuestos" count={opportunities.length}>
            <OpportunityMiniList opportunities={opportunities} />
          </DetailSection>
        </div>
      </div>
    </AppLayout>
  );
}
