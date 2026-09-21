'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { FilterChips } from '@/components/ui/FilterChips';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Product, ProductCategory } from '@/types/crm';
import { deleteProduct, fetchProducts } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { PRODUCT_CATEGORIES } from '@/lib/catalogs';
import { formatARSCents } from '@/lib/format';

type Filter = 'all' | ProductCategory;

export default function CatalogPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(fetchProducts);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const products = useMemo(() => data ?? [], [data]);
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = products.filter(
      (p) => (filter === 'all' || p.category === filter) && (!q || [p.name, p.code, p.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    );
    return PRODUCT_CATEGORIES.map((c) => ({ ...c, items: match.filter((p) => p.category === c.value).sort((a, b) => a.name.localeCompare(b.name, 'es')) })).filter(
      (g) => g.items.length
    );
  }, [products, search, filter]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProduct(deleting.id);
      toast.success('Material dado de baja', deleting.name);
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
          title="Catálogo"
          actions={
            <ButtonLink href={filter === 'all' ? '/catalog/nuevo' : `/catalog/nuevo?rubro=${encodeURIComponent(filter)}`} size="lg">
              <Plus className="w-5 h-5" aria-hidden />
              Nuevo material
            </ButtonLink>
          }
        />
        <div className="space-y-3">
          <SearchInput
            icon={<Search className="w-4.5 h-4.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código o nombre"
            aria-label="Buscar materiales"
          />
          <FilterChips<Filter>
            label="Rubro"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos', count: products.length },
              ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label, count: products.filter((p) => p.category === c.value).length })),
            ]}
          />
        </div>

        {loading ? (
          <LoadingBlock label="Cargando catálogo" />
        ) : error ? (
          <EmptyState illustration="catalogo" title="No pudimos cargar el catálogo" description={error} action={<Button variant="secundario" onClick={() => reload()}>Reintentar</Button>} />
        ) : groups.length === 0 ? (
          <EmptyState illustration="catalogo" title={products.length ? 'Sin resultados' : 'El catálogo está vacío'} />
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.value} aria-labelledby={`rubro-${g.value}`}>
                <h2 id={`rubro-${g.value}`} className="mb-2 px-1 text-[15px] font-bold">
                  {g.label}
                </h2>
                <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
                  {g.items.map((p) => (
                    <li key={p.id} className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-chapa-2/70 sm:gap-4 sm:px-5">
                      <span className="cifra hidden w-20 shrink-0 text-[13px] font-bold text-tiza sm:block">{p.code}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/catalog/${p.id}/editar`} className="block truncate text-[15px] font-semibold after:absolute after:inset-0 focus-visible:outline-none">
                          {p.name}
                        </Link>
                        <p className="truncate text-[13px] text-tiza">
                          <span className="sm:hidden">{p.code} · </span>
                          {p.unit}
                        </p>
                      </div>
                      <span className="cifra shrink-0 text-[15px] font-extrabold">{formatARSCents(p.unit_price)}</span>
                      <Menu
                        label={`Acciones de ${p.name}`}
                        items={[
                          { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onSelect: () => router.push(`/catalog/${p.id}/editar`) },
                          { label: 'Dar de baja', icon: <Trash2 className="w-4 h-4" />, tone: 'peligro', onSelect: () => setDeleting(p) },
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          title={`¿Sacar ${deleting.name} del catálogo?`}
          description="No aparece en presupuestos nuevos. Los que ya lo incluyen no cambian."
          confirmLabel="Dar de baja"
          submitting={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </AppLayout>
  );
}
