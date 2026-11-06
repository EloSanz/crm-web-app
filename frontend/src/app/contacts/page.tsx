'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { Menu } from '@/components/ui/Menu';
import { FilterChips } from '@/components/ui/FilterChips';
import { CellActions, DataTable, type TableSetup } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ClientsNav } from '@/components/clients/ClientsNav';
import type { Contact, ContactStatus } from '@/types/crm';
import { deleteContact, fetchCompanies, fetchContacts } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { usePagination } from '@/lib/usePagination';
import { CLIENT_STATUS } from '@/lib/catalogs';
import { initials, matchesSearch, telHref } from '@/lib/format';

type Filter = 'all' | ContactStatus;
const helper = createColumnHelper<TableSetup, Contact>();
const fullName = (c: Contact) => `${c.first_name} ${c.last_name}`;
const load = async () => {
  const [contacts, companies] = await Promise.all([fetchContacts(), fetchCompanies()]);
  return { contacts, companies };
};

export default function ContactsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(load);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [company, setCompany] = useState('all');
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);

  const contacts = useMemo(() => data?.contacts ?? [], [data]);
  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const s = matchesSearch(search, [`${c.first_name} ${c.last_name}`, c.phone, c.email, c.company_name, c.document_number]);
      const co = company === 'all' || (company === 'none' ? !c.company_id : c.company_id === company);
      return s && co && (filter === 'all' || c.status === filter);
    });
  }, [contacts, search, filter, company]);
  // En el celular, por nombre (igual que el orden inicial de la tabla); 10 por vista.
  const sorted = useMemo(() => [...filtered].sort((a, b) => fullName(a).localeCompare(fullName(b), 'es')), [filtered]);
  const resetKey = `${search}|${filter}|${company}`;
  const paged = usePagination(sorted, { resetKey });
  const listRef = useRef<HTMLDivElement>(null);

  const actions = (c: Contact) => (
    <Menu
      label={`Acciones de ${fullName(c)}`}
      items={[
        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onSelect: () => router.push(`/contacts/${c.id}/editar`) },
        { label: 'Dar de baja', icon: <Trash2 className="w-4 h-4" />, tone: 'peligro', onSelect: () => setDeleting(c) },
      ]}
    />
  );

  const columns = helper.columns([
    helper.accessor(fullName, {
      id: 'nombre',
      header: 'Contacto',
      sortFn: 'text',
      cell: (info) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full bg-pavonado text-[13px] font-bold text-white">{initials(info.getValue())}</span>
          <p className="min-w-0 truncate leading-tight">
            <span className="font-bold">{info.getValue()}</span>
            {info.row.original.job_title && <span className="text-sm text-tiza"> · {info.row.original.job_title}</span>}
          </p>
        </div>
      ),
    }),
    helper.accessor((c) => c.company_name || 'Particular', {
      id: 'empresa',
      header: 'Empresa',
      sortFn: 'text',
      cell: (info) => <span className="block max-w-56 truncate text-sm">{info.getValue()}</span>,
    }),
    helper.accessor((c) => c.phone ?? '', {
      id: 'telefono',
      header: 'Teléfono',
      enableSorting: false,
      cell: (info) => {
        const tel = telHref(info.getValue());
        return tel ? (
          <CellActions>
            <a href={tel} className="cifra inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium hover:underline" aria-label={`Llamar a ${fullName(info.row.original)}`}>
              <Phone className="w-3.5 h-3.5 text-tiza" aria-hidden />
              {info.getValue()}
            </a>
          </CellActions>
        ) : (
          <span className="text-sm text-tiza">—</span>
        );
      },
    }),
    helper.accessor((c) => (CLIENT_STATUS[c.status] ?? CLIENT_STATUS.potencial).label, {
      id: 'estado',
      header: 'Estado',
      sortFn: 'text',
      cell: (info) => {
        const st = CLIENT_STATUS[info.row.original.status] ?? CLIENT_STATUS.potencial;
        return <Chip tone={st.tone}>{st.label}</Chip>;
      },
    }),
    helper.display({ id: 'acciones', header: () => <span className="sr-only">Acciones</span>, cell: (info) => <CellActions>{actions(info.row.original)}</CellActions> }),
  ]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteContact(deleting.id);
      toast.success('Contacto dado de baja', `${deleting.first_name} ${deleting.last_name}`);
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
            <ButtonLink href="/contacts/nuevo" size="lg">
              <Plus className="w-5 h-5" aria-hidden />
              Nuevo contacto
            </ButtonLink>
          }
        >
          <ClientsNav current="contacts" />
        </PageHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2.5 md:flex-row">
            <SearchInput
              icon={<Search className="w-4.5 h-4.5" />}
              className="flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o empresa"
              aria-label="Buscar contactos"
            />
            <div className="md:w-64">
              <Select
                value={company}
                onChange={setCompany}
                aria-label="Empresa"
                options={[
                  { value: 'all', label: 'Todas las empresas' },
                  { value: 'none', label: 'Particulares' },
                  ...(data?.companies ?? []).map((co) => ({ value: co.id, label: co.name })),
                ]}
              />
            </div>
          </div>
          <FilterChips<Filter>
            label="Estado"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos', count: contacts.length },
              ...(Object.keys(CLIENT_STATUS) as ContactStatus[]).map((s) => ({
                value: s,
                label: CLIENT_STATUS[s].label,
                count: contacts.filter((c) => c.status === s).length,
              })),
            ]}
          />
        </div>

        {loading ? (
          <LoadingBlock label="Cargando contactos" />
        ) : error ? (
          <EmptyState illustration="clientes" title="No pudimos cargar los contactos" description={error} action={<Button variant="secundario" onClick={() => reload()}>Reintentar</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState illustration="clientes"
            title={contacts.length ? 'Sin resultados' : 'Todavía no hay contactos'}
            action={
              contacts.length ? undefined : (
                <ButtonLink href="/contacts/nuevo">
                  <Plus className="w-4 h-4" aria-hidden />
                  Nuevo contacto
                </ButtonLink>
              )
            }
          />
        ) : (
          <>
            <div ref={listRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave xl:hidden">
              <ul className="divide-y divide-linea">
                {paged.pageItems.map((c) => {
                  const st = CLIENT_STATUS[c.status] ?? CLIENT_STATUS.potencial;
                  const name = `${c.first_name} ${c.last_name}`;
                  const tel = telHref(c.phone);
                  return (
                    <li key={c.id} className="relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-chapa-2/70 sm:gap-4 sm:px-5">
                      <span className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-pavonado text-sm font-bold text-white">{initials(name)}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/contacts/${c.id}`} className="line-clamp-2 text-[15px] font-bold leading-snug after:absolute after:inset-0 focus-visible:outline-none">
                          {name}
                        </Link>
                        <p className="truncate text-sm text-tiza">
                          <span className="sm:hidden">{st.label} · </span>
                          {[c.job_title, c.company_name || 'Particular'].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <Chip tone={st.tone} className="hidden sm:inline-flex">
                        {st.label}
                      </Chip>
                      {tel && (
                        <a
                          href={tel}
                          className="relative z-[1] h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-[10px] border border-linea text-tinta hover:border-linea-fuerte hover:bg-chapa-2"
                          aria-label={`Llamar a ${name}`}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      {actions(c)}
                    </li>
                  );
                })}
              </ul>
              <Pagination {...paged} onChange={paged.setPage} anchorRef={listRef} className="border-t border-linea px-4 py-3 sm:px-5" />
            </div>
            <div className="hidden xl:block">
              <DataTable
                data={filtered}
                columns={columns}
                caption="Contactos"
                initialSort={[{ id: 'nombre', desc: false }]}
                dense
                grow="nombre"
                resetKey={resetKey}
                onRowClick={(c) => router.push(`/contacts/${c.id}`)}
                rowLabel={(c) => `Abrir ${c.first_name} ${c.last_name}`}
              />
            </div>
          </>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          title={`¿Dar de baja a ${deleting.first_name} ${deleting.last_name}?`}
          description="Deja de aparecer en los listados. Su historial se conserva."
          confirmLabel="Dar de baja"
          submitting={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </AppLayout>
  );
}
