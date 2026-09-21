'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { DetailSection, InfoRow, OpportunityMiniList } from '@/components/clients/DetailBits';
import { fetchCompany, fetchCompanyContacts, fetchOpportunities, fetchProjects } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { CLIENT_STATUS, PROJECT_STATUS } from '@/lib/catalogs';
import { formatDate, telHref } from '@/lib/format';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(async () => {
    const [company, contacts, opportunities, projects] = await Promise.all([
      fetchCompany(id),
      fetchCompanyContacts(id).catch(() => []),
      fetchOpportunities({ company_id: id }).catch(() => []),
      fetchProjects({ company_id: id }).catch(() => []),
    ]);
    return { company, contacts, opportunities: opportunities.filter((o) => o.company_id === id), projects };
  }, [id]);
  const { data, error, loading } = useLoad(load);

  if (loading) return <AppLayout><LoadingBlock label="Cargando empresa" rows={4} /></AppLayout>;
  if (error || !data)
    return (
      <AppLayout>
        <EmptyState illustration="clientes" title="No encontramos la empresa" action={<ButtonLink href="/companies" variant="secundario">Volver</ButtonLink>} />
      </AppLayout>
    );

  const { company: c, contacts, opportunities, projects } = data;
  const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.potencial;
  const tel = telHref(c.phone);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/companies', label: 'Clientes' }}
          meta={<Chip tone={st.tone}>{st.label}</Chip>}
          title={c.name}
          actions={
            <>
              <ButtonLink href={`/companies/${c.id}/editar`} variant="secundario">
                <Pencil className="w-4 h-4" aria-hidden />
                Editar
              </ButtonLink>
              <ButtonLink href={`/opportunities/nuevo?company_id=${c.id}`}>
                <Plus className="w-4 h-4" aria-hidden />
                Presupuesto
              </ButtonLink>
            </>
          }
        />
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <DetailSection title="Datos">
            <dl className="divide-y divide-linea">
              <InfoRow label="Teléfono">{c.phone ? tel ? <a href={tel} className="font-semibold hover:underline">{c.phone}</a> : c.phone : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Correo">{c.email ? <a href={`mailto:${c.email}`} className="break-all hover:underline">{c.email}</a> : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Dirección">{c.address || <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="CUIT">{c.cuit ? <span className="cifra">{c.cuit}</span> : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Rubro">{c.industry || <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Sitio web">{c.website ? <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="break-all hover:underline">{c.website}</a> : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Origen">{c.origin || <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Notas">{c.notes ? <span className="whitespace-pre-line">{c.notes}</span> : <span className="text-tiza">—</span>}</InfoRow>
              <InfoRow label="Alta">{formatDate(c.created_at)}</InfoRow>
            </dl>
          </DetailSection>
          <div className="space-y-6">
            <DetailSection title="Presupuestos" count={opportunities.length}>
              <OpportunityMiniList opportunities={opportunities} />
            </DetailSection>
            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <DetailSection title="Contactos" count={contacts.length} action={<Link href={`/contacts/nuevo?company_id=${c.id}`} className="text-sm font-semibold text-tiza hover:text-tinta">Agregar</Link>}>
                {contacts.length === 0 ? (
                  <p className="px-5 pb-5 text-[15px] text-tiza">Sin contactos.</p>
                ) : (
                  <ul className="divide-y divide-linea">
                    {contacts.map((ct) => (
                      <li key={ct.id} className="relative px-5 py-3 hover:bg-chapa-2/70">
                        <Link href={`/contacts/${ct.id}`} className="block truncate font-semibold after:absolute after:inset-0">
                          {ct.first_name} {ct.last_name}
                        </Link>
                        <p className="truncate text-sm text-tiza">{[ct.job_title, ct.phone].filter(Boolean).join(' · ')}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>
              <DetailSection title="Obras" count={projects.length}>
                {projects.length === 0 ? (
                  <p className="px-5 pb-5 text-[15px] text-tiza">Sin obras.</p>
                ) : (
                  <ul className="divide-y divide-linea">
                    {projects.map((p) => (
                      <li key={p.id} className="relative flex items-center gap-3 px-5 py-3 hover:bg-chapa-2/70">
                        <div className="min-w-0 flex-1">
                          <Link href={`/projects/${p.id}/editar`} className="block truncate font-semibold after:absolute after:inset-0">
                            {p.name}
                          </Link>
                          <p className="truncate text-sm text-tiza">{p.address}</p>
                        </div>
                        <Chip tone={PROJECT_STATUS[p.status]?.tone ?? 'neutro'}>{PROJECT_STATUS[p.status]?.label ?? p.status}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
