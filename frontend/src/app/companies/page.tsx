'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Chip } from '@/components/ui/Chip';
import { Menu } from '@/components/ui/Menu';
import { FilterChips } from '@/components/ui/FilterChips';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ClientsNav } from '@/components/clients/ClientsNav';
import type { Company, CompanyStatus } from '@/types/crm';
import { deleteCompany, fetchCompanies } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { CLIENT_STATUS } from '@/lib/catalogs';
import { initials } from '@/lib/format';

type Filter = 'all' | CompanyStatus;

export default function CompaniesPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(fetchCompanies);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);

  const companies = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter(
      (c) => (filter === 'all' || c.status === filter) && (!q || [c.name, c.cuit, c.industry, c.address].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [companies, search, filter]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCompany(deleting.id);
      toast.success('Empresa dada de baja', deleting.name);
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.error('No se pudo dar de baja', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <PageHeader
          title="Clientes"
          actions={
            <ButtonLink href="/companies/nueva" size="lg">
              <Plus className="w-5 h-5" aria-hidden />
              Nueva empresa
            </ButtonLink>
          }
        >
          <ClientsNav current="companies" />
        </PageHeader>

        <div className="space-y-3">
          <SearchInput
            icon={<Search className="w-4.5 h-4.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, CUIT o rubro"
            aria-label="Buscar empresas"
          />
          <FilterChips<Filter>
            label="Estado"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todas', count: companies.length },
              ...(Object.keys(CLIENT_STATUS) as CompanyStatus[]).map((s) => ({
                value: s,
                label: CLIENT_STATUS[s].label,
                count: companies.filter((c) => c.status === s).length,
              })),
            ]}
          />
        </div>

        {loading ? (
          <LoadingBlock label="Cargando empresas" />
        ) : error ? (
          <EmptyState illustration="clientes" title="No pudimos cargar las empresas" description={error} action={<Button variant="secundario" onClick={() => reload()}>Reintentar</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState illustration="clientes"
            title={companies.length ? 'Sin resultados' : 'Todavía no hay empresas'}
            action={
              companies.length ? undefined : (
                <ButtonLink href="/companies/nueva">
                  <Plus className="w-4 h-4" aria-hidden />
                  Nueva empresa
                </ButtonLink>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
            {filtered.map((c) => {
              const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.potencial;
              return (
                <li key={c.id} className="relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-chapa-2/70 sm:gap-4 sm:px-5">
                  <span className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl bg-[#e3e8ed] text-sm font-bold text-tinta">{initials(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/companies/${c.id}`} className="line-clamp-2 text-[15px] font-bold leading-snug after:absolute after:inset-0 focus-visible:outline-none">
                      {c.name}
                    </Link>
                    <p className="truncate text-sm text-tiza">
                      <span className="sm:hidden">{st.label} · </span>
                      {[c.industry, c.phone].filter(Boolean).join(' · ') || 'Sin datos'}
                    </p>
                  </div>
                  <Chip tone={st.tone} className="hidden sm:inline-flex">
                    {st.label}
                  </Chip>
                  <Menu
                    label={`Acciones de ${c.name}`}
                    items={[
                      { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onSelect: () => router.push(`/companies/${c.id}/editar`) },
                      { label: 'Dar de baja', icon: <Trash2 className="w-4 h-4" />, tone: 'peligro', onSelect: () => setDeleting(c) },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          title={`¿Dar de baja ${deleting.name}?`}
          description="Deja de aparecer en los listados. Su historial de presupuestos se conserva."
          confirmLabel="Dar de baja"
          submitting={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </AppLayout>
  );
}
