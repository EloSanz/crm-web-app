'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { Menu } from '@/components/ui/Menu';
import { FilterChips } from '@/components/ui/FilterChips';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Project, ProjectStatus, ProjectType } from '@/types/crm';
import { deleteProject, fetchProjects } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { PROJECT_STATUS, PROJECT_TYPES } from '@/lib/catalogs';

type Filter = 'all' | ProjectStatus;
const ORDER: ProjectStatus[] = ['en_curso', 'planificacion', 'frenada', 'finalizada'];

export default function ProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(fetchProjects);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [type, setType] = useState<'all' | ProjectType>('all');
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  const projects = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter(
        (p) =>
          (filter === 'all' || p.status === filter) &&
          (type === 'all' || p.project_type === type) &&
          (!q || [p.name, p.address, p.company_name, p.contact_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      )
      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  }, [projects, search, filter, type]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProject(deleting.id);
      toast.success('Obra dada de baja', deleting.name);
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
          title="Obras"
          actions={
            <ButtonLink href="/projects/nueva" size="lg">
              <Plus className="w-5 h-5" aria-hidden />
              Nueva obra
            </ButtonLink>
          }
        />
        <div className="space-y-3">
          <div className="flex flex-col gap-2.5 md:flex-row">
            <SearchInput
              icon={<Search className="w-4.5 h-4.5" />}
              className="flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar obra, dirección o cliente"
              aria-label="Buscar obras"
            />
            <div className="md:w-60">
              <Select
                value={type}
                onChange={(v) => setType(v as 'all' | ProjectType)}
                aria-label="Tipo de obra"
                options={[{ value: 'all', label: 'Todos los tipos' }, ...(Object.keys(PROJECT_TYPES) as ProjectType[]).map((t) => ({ value: t, label: PROJECT_TYPES[t] }))]}
              />
            </div>
          </div>
          <FilterChips<Filter>
            label="Estado"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todas', count: projects.length },
              ...ORDER.map((s) => ({ value: s, label: PROJECT_STATUS[s].label, count: projects.filter((p) => p.status === s).length })),
            ]}
          />
        </div>

        {loading ? (
          <LoadingBlock label="Cargando obras" />
        ) : error ? (
          <EmptyState illustration="obra" title="No pudimos cargar las obras" description={error} action={<Button variant="secundario" onClick={() => reload()}>Reintentar</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState illustration="obra"
            title={projects.length ? 'Sin resultados' : 'Todavía no hay obras'}
            action={
              projects.length ? undefined : (
                <ButtonLink href="/projects/nueva">
                  <Plus className="w-4 h-4" aria-hidden />
                  Nueva obra
                </ButtonLink>
              )
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((p) => {
              const st = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.en_curso;
              return (
                <li key={p.id} className="flex min-w-0 flex-col rounded-2xl border border-linea bg-chapa shadow-suave">
                  <div className="flex-1 p-5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/projects/${p.id}/editar`} className="block truncate text-base font-bold hover:underline">
                          {p.name}
                        </Link>
                        <p className="truncate text-sm text-tiza">{p.company_name || 'Particular'}</p>
                      </div>
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-[15px] font-medium">
                      <MapPin className="mt-0.5 w-4 h-4 shrink-0 text-tiza" aria-hidden />
                      <span className="min-w-0 break-words">{p.address}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 border-t border-linea px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate px-2 text-sm text-tiza">{PROJECT_TYPES[p.project_type] ?? p.project_type}</span>
                    <Menu
                      label={`Acciones de ${p.name}`}
                      items={[
                        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onSelect: () => router.push(`/projects/${p.id}/editar`) },
                        { label: 'Dar de baja', icon: <Trash2 className="w-4 h-4" />, tone: 'peligro', onSelect: () => setDeleting(p) },
                      ]}
                    />
                    <ButtonLink href={`/opportunities/nuevo?project_id=${p.id}`} size="sm" variant="secundario">
                      <ClipboardList className="w-4 h-4" aria-hidden />
                      Presupuestar
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          title={`¿Dar de baja ${deleting.name}?`}
          description="Deja de aparecer en los listados. Sus presupuestos conservan el historial."
          confirmLabel="Dar de baja"
          submitting={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </AppLayout>
  );
}
