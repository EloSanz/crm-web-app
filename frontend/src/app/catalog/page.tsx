'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { History, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { FilterChips } from '@/components/ui/FilterChips';
import { CellActions, DataTable, type TableSetup } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { Product, ProductCategory } from '@/types/crm';
import { deleteProduct, fetchProducts } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { usePagination } from '@/lib/usePagination';
import { PRODUCT_CATEGORIES } from '@/lib/catalogs';
import { formatARSCents } from '@/lib/format';
import { formatUnitQty, hasWholesale } from '@/lib/pricing';
import { useCurrentUser } from '@/lib/useUser';
import { isAdmin } from '@/lib/roles';

type Filter = 'all' | ProductCategory;
const helper = createColumnHelper<TableSetup, Product>();
const CATEGORY_POSITION = new Map(PRODUCT_CATEGORIES.map((c, i) => [c.value, i]));
const CATEGORY_LABEL = new Map(PRODUCT_CATEGORIES.map((c) => [c.value as string, c.label]));
const categoryPosition = (p: Product) => CATEGORY_POSITION.get(p.category) ?? PRODUCT_CATEGORIES.length;

export default function CatalogPage() {
  const router = useRouter();
  const toast = useToast();
  const admin = isAdmin(useCurrentUser());
  const { data, error, loading, reload } = useLoad(fetchProducts);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const products = useMemo(() => data ?? [], [data]);
  // Filtrados y ordenados por rubro (en el orden del catálogo) y nombre: es el orden de la tabla
  // sin tocar encabezados y el de la lista del celular.
  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (filter === 'all' || p.category === filter) && (!q || [p.name, p.code, p.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))))
      .sort((a, b) => categoryPosition(a) - categoryPosition(b) || a.name.localeCompare(b.name, 'es'));
  }, [products, search, filter]);
  const resetKey = `${search}|${filter}`;
  const paged = usePagination(sorted, { resetKey });
  const listRef = useRef<HTMLDivElement>(null);
  // Los 10 de la página, agrupados por rubro para el celular.
  const pageGroups = PRODUCT_CATEGORIES.map((c) => ({ ...c, items: paged.pageItems.filter((p) => p.category === c.value) })).filter((g) => g.items.length);

  const actions = (p: Product) => (
    <Menu
      label={`Acciones de ${p.name}`}
      items={[
        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onSelect: () => router.push(`/catalog/${p.id}/editar`) },
        { label: 'Dar de baja', icon: <Trash2 className="w-4 h-4" />, tone: 'peligro', onSelect: () => setDeleting(p) },
      ]}
    />
  );

  const columns = helper.columns([
    helper.accessor('code', {
      header: 'Código',
      sortFn: 'alphanumeric',
      cell: (info) => <span className="cifra whitespace-nowrap text-[13px] font-bold text-tiza">{info.getValue()}</span>,
    }),
    helper.accessor('name', {
      header: 'Material',
      sortFn: 'text',
      cell: (info) => <span className="block truncate font-semibold">{info.getValue()}</span>,
    }),
    helper.accessor(categoryPosition, {
      id: 'rubro',
      header: 'Rubro',
      sortFn: 'basic',
      cell: (info) => <span className="whitespace-nowrap text-sm">{CATEGORY_LABEL.get(info.row.original.category) ?? info.row.original.category}</span>,
    }),
    helper.accessor('unit', {
      header: 'Unidad',
      sortFn: 'text',
      cell: (info) => <span className="whitespace-nowrap text-sm">{info.getValue()}</span>,
    }),
    helper.accessor((p) => Number(p.unit_price) || 0, {
      id: 'minorista',
      header: 'Minorista',
      sortFn: 'basic',
      cell: (info) => <span className="cifra whitespace-nowrap font-extrabold">{formatARSCents(info.row.original.unit_price)}</span>,
    }),
    helper.accessor((p) => (hasWholesale(p) ? Number(p.wholesale_price) : -1), {
      id: 'mayorista',
      header: 'Mayorista',
      sortFn: 'basic',
      cell: (info) =>
        hasWholesale(info.row.original) ? (
          <span className="cifra whitespace-nowrap font-semibold">{formatARSCents(info.row.original.wholesale_price)}</span>
        ) : (
          <span className="text-sm text-tiza">—</span>
        ),
    }),
    helper.accessor((p) => (hasWholesale(p) ? Number(p.wholesale_min_qty) : -1), {
      id: 'minimo',
      header: 'Mayorista desde',
      sortFn: 'basic',
      cell: (info) => {
        const p = info.row.original;
        return hasWholesale(p) ? <span className="cifra whitespace-nowrap text-sm">{formatUnitQty(p.wholesale_min_qty ?? 0, p.unit)}</span> : <span className="text-sm text-tiza">—</span>;
      },
    }),
    helper.display({ id: 'acciones', header: () => <span className="sr-only">Acciones</span>, cell: (info) => <CellActions>{actions(info.row.original)}</CellActions> }),
  ]);

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
            <>
              {admin && (
                <ButtonLink href="/catalog/historial" variant="secundario" size="lg">
                  <History className="w-5 h-5" aria-hidden />
                  Historial
                </ButtonLink>
              )}
              <ButtonLink href={filter === 'all' ? '/catalog/nuevo' : `/catalog/nuevo?rubro=${encodeURIComponent(filter)}`} size="lg">
                <Plus className="w-5 h-5" aria-hidden />
                Nuevo material
              </ButtonLink>
            </>
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
        ) : sorted.length === 0 ? (
          <EmptyState illustration="catalogo" title={products.length ? 'Sin resultados' : 'El catálogo está vacío'} />
        ) : (
          <>
            {/* Celular y tablet: lista compacta agrupada por rubro dentro de cada página de 10. */}
            <div ref={listRef} className="scroll-mt-24 space-y-5 xl:hidden">
              {pageGroups.map((g) => (
                <section key={g.value} aria-labelledby={`rubro-${g.value}`}>
                  <h2 id={`rubro-${g.value}`} className="mb-2 px-1 text-[15px] font-bold">
                    {g.label}
                  </h2>
                  <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
                    {g.items.map((p) => (
                      <li key={p.id} className="relative flex flex-wrap items-center gap-x-3 px-4 py-3 transition-colors hover:bg-chapa-2/70 sm:flex-nowrap sm:gap-x-4 sm:px-5">
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
                        <div className="shrink-0 text-right">
                          <p className="cifra text-[15px] font-extrabold">{formatARSCents(p.unit_price)}</p>
                          {hasWholesale(p) && <WholesaleLine product={p} className="hidden sm:block" />}
                        </div>
                        {actions(p)}
                        {hasWholesale(p) && <WholesaleLine product={p} className="basis-full pr-[52px] text-right sm:hidden" />}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <Pagination {...paged} onChange={paged.setPage} anchorRef={listRef} className="px-1" />
            </div>
            {/* Escritorio: tabla ordenable por columna. */}
            <div className="hidden xl:block">
              <DataTable
                data={sorted}
                columns={columns}
                caption="Catálogo de materiales"
                dense
                grow="name"
                alignRight={['minorista', 'mayorista', 'minimo']}
                resetKey={resetKey}
                onRowClick={(p) => router.push(`/catalog/${p.id}/editar`)}
                rowLabel={(p) => `Editar ${p.name}`}
              />
            </div>
          </>
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

/** "$ 8.900,00 desde 50 bolsas": el precio mayorista en una línea, debajo del minorista. */
function WholesaleLine({ product, className }: { product: Product; className?: string }) {
  return (
    <p className={`cifra truncate text-[13px] text-tiza ${className ?? ''}`}>
      <span className="sr-only">Mayorista: </span>
      <span className="font-semibold text-tinta">{formatARSCents(product.wholesale_price)}</span> desde {formatUnitQty(product.wholesale_min_qty ?? 0, product.unit)}
    </p>
  );
}
