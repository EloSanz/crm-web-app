'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, LoadingBlock } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import type { CrmUser, Product } from '@/types/crm';
import type { CatalogAuditAction, CatalogAuditEntry, CatalogAuditField, CatalogAuditValue } from '@/types/catalog';
import { fetchUsers } from '@/lib/api';
import { fetchAllMaterials, fetchCatalogAudit } from '@/lib/api-catalog';
import { useLoad } from '@/lib/useLoad';
import { PRODUCT_CATEGORIES, type Tone } from '@/lib/catalogs';
import { formatARSCents, formatDateTime } from '@/lib/format';
import { formatUnitQty } from '@/lib/pricing';

const PAGE_SIZE = 30;
/** Opción "todos" de los filtros: con el filtro vacío el desplegable muestra su rótulo corto. */
const ALL = '__todos';

const ACTIONS: Record<CatalogAuditAction, { label: string; tone: Tone }> = {
  alta: { label: 'Alta', tone: 'fuerte' },
  edicion: { label: 'Edición', tone: 'neutro' },
  baja: { label: 'Baja', tone: 'pausa' },
};

const FIELDS: { key: CatalogAuditField; label: string }[] = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Nombre' },
  { key: 'category', label: 'Rubro' },
  { key: 'unit', label: 'Unidad' },
  { key: 'unit_price', label: 'Precio minorista' },
  { key: 'wholesale_price', label: 'Precio mayorista' },
  { key: 'wholesale_min_qty', label: 'Mayorista desde' },
  { key: 'description', label: 'Descripción' },
  { key: 'is_active', label: 'Habilitado' },
];

const NUMERIC_FIELDS: CatalogAuditField[] = ['unit_price', 'wholesale_price', 'wholesale_min_qty'];

/** En un alta el nombre y el código ya están en el título del renglón, y "Habilitado: Sí" es lo normal. */
function hiddenOnAlta(field: CatalogAuditField, value: CatalogAuditValue): boolean {
  return field === 'code' || field === 'name' || (field === 'is_active' && value === true);
}

function formatValue(field: CatalogAuditField, value: CatalogAuditValue, unit?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (field) {
    case 'unit_price':
    case 'wholesale_price':
      return formatARSCents(value as number);
    case 'wholesale_min_qty':
      return formatUnitQty(value as number, unit);
    case 'is_active':
      return value ? 'Sí' : 'No';
    case 'category':
      return PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? String(value);
    default:
      return String(value);
  }
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'No se pudo conectar con la API');

interface Results {
  key: string;
  items: CatalogAuditEntry[];
  hasMore: boolean;
  error: string | null;
}

export function CatalogHistory() {
  const toast = useToast();
  const users = useLoad(fetchUsers);
  const materials = useLoad(fetchAllMaterials);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [productId, setProductId] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = `${query}|${userId}|${productId}`;
  useEffect(() => {
    let alive = true;
    fetchCatalogAudit({ q: query, user_id: userId, product_id: productId, limit: PAGE_SIZE, offset: 0 })
      .then((items) => alive && setResults({ key, items, hasMore: items.length === PAGE_SIZE, error: null }))
      .catch((err: unknown) => alive && setResults({ key, items: [], hasMore: false, error: errorText(err) }));
    return () => {
      alive = false;
    };
  }, [key, query, userId, productId]);

  const refreshing = results !== null && results.key !== key;
  const filtered = Boolean(query || userId || productId);

  const loadMore = async () => {
    if (!results) return;
    setLoadingMore(true);
    try {
      const items = await fetchCatalogAudit({ q: query, user_id: userId, product_id: productId, limit: PAGE_SIZE, offset: results.items.length });
      setResults((prev) => {
        if (!prev || prev.key !== key) return prev;
        const seen = new Set(prev.items.map((i) => i.id));
        return { ...prev, items: [...prev.items, ...items.filter((i) => !seen.has(i.id))], hasMore: items.length === PAGE_SIZE };
      });
    } catch (err) {
      toast.error('No se pudo cargar más', errorText(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const productById = useMemo(() => new Map((materials.data ?? []).map((p) => [p.id, p])), [materials.data]);

  const userOptions = useMemo(
    () => [{ value: ALL, label: 'Todos los usuarios' }, ...(users.data ?? []).map((u: CrmUser) => ({ value: u.id, label: u.full_name }))],
    [users.data]
  );
  const materialOptions = useMemo(
    () => [
      { value: ALL, label: 'Todos los materiales' },
      ...[...(materials.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((p: Product) => ({ value: p.id, label: p.name, hint: p.code })),
    ],
    [materials.data]
  );

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/catalog', label: 'Catálogo' }} title="Historial del catálogo" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_13rem_16rem]">
        <SearchInput
          className="col-span-2 md:col-span-1"
          icon={<Search className="w-4.5 h-4.5" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar material o usuario"
          aria-label="Buscar en el historial"
        />
        <Select
          value={userId}
          onChange={(v) => setUserId(v === ALL ? '' : v)}
          options={userOptions}
          placeholder="Usuario"
          aria-label="Usuario"
          searchPlaceholder="Buscar usuario…"
        />
        <Select
          value={productId}
          onChange={(v) => setProductId(v === ALL ? '' : v)}
          options={materialOptions}
          searchable
          placeholder="Material"
          aria-label="Material"
          searchPlaceholder="Buscar material…"
        />
      </div>

      {results === null ? (
        <LoadingBlock label="Cargando historial" />
      ) : results.error ? (
        <EmptyState illustration="catalogo" title="No pudimos cargar el historial" description={results.error} />
      ) : results.items.length === 0 ? (
        <EmptyState illustration={filtered ? 'busqueda' : 'catalogo'} title={filtered ? 'Sin resultados' : 'Todavía no hay cambios'} />
      ) : (
        <div className={refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={refreshing || undefined}>
          <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-chapa shadow-suave">
            {results.items.map((entry) => (
              <ChangeRow key={entry.id} entry={entry} product={entry.product_id ? productById.get(entry.product_id) : undefined} />
            ))}
          </ul>
          {results.hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="secundario" onClick={loadMore} isLoading={loadingMore} className="w-full sm:w-auto">
                Ver más
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeRow({ entry, product }: { entry: CatalogAuditEntry; product?: Product }) {
  const action = ACTIONS[entry.action] ?? ACTIONS.edicion;
  const name = entry.product_name || product?.name || 'Material';
  const unit = product?.unit ?? (entry.changes.unit?.despues as string | undefined);
  const rows = FIELDS.flatMap(({ key, label }) => {
    const change = entry.changes[key];
    return change && !(entry.action === 'alta' && hiddenOnAlta(key, change.despues)) ? [{ key, label, change }] : [];
  });
  // Sólo se enlaza si el material sigue en el catálogo.
  const href = product && entry.action !== 'baja' ? `/catalog/${product.id}/editar` : null;

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Chip tone={action.tone} className="shrink-0">
          {action.label}
        </Chip>
        {entry.product_code && <span className="cifra hidden shrink-0 text-[13px] font-bold text-tiza sm:inline">{entry.product_code}</span>}
        {href ? (
          <Link href={href} className="min-w-0 truncate text-[15px] font-bold hover:underline underline-offset-2">
            {name}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-[15px] font-bold">{name}</span>
        )}
      </div>
      <p className="mt-1 truncate text-[13px] text-tiza">
        <span className="font-semibold text-tinta">{entry.user_name || 'Usuario'}</span>
        {' · '}
        <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
      </p>
      {rows.length > 0 && (
        <dl className="mt-2.5 space-y-1.5">
          {rows.map(({ key, label, change }) => {
            const numeric = NUMERIC_FIELDS.includes(key);
            return (
              <div key={key} className="min-w-0 sm:grid sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-x-4">
                <dt className="text-[13px] font-semibold text-tiza">{label}</dt>
                <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
                  {entry.action === 'edicion' && (
                    <>
                      <span className="sr-only">Antes: </span>
                      <span className={clsx('line-clamp-2 break-words text-tiza line-through decoration-linea-fuerte', numeric && 'cifra')}>{formatValue(key, change.antes, unit)}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 self-center text-tiza" aria-hidden />
                      <span className="sr-only">Ahora: </span>
                    </>
                  )}
                  <span className={clsx('line-clamp-2 break-words font-semibold text-tinta', numeric && 'cifra')}>{formatValue(key, change.despues, unit)}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </li>
  );
}
